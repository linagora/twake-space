import { EventEmitter } from 'node:events'

import {
  MatrixEvent,
  MatrixEventEvent,
  RoomEvent,
  type Filter
} from 'matrix-js-sdk'
import { describe, expect, it, vi } from 'vitest'

import { matrixFeed, type FeedClient } from '@/adapters/matrix/matrixFeed'
import type { FeedPage } from '@/application/feed'

const ROOM = '!space:acme.test'

function message(id: string, body: string, ts: number) {
  return new MatrixEvent({
    event_id: id,
    room_id: ROOM,
    type: 'm.room.message',
    sender: '@bob:acme.test',
    origin_server_ts: ts,
    content: { msgtype: 'm.text', body }
  })
}

function setUp() {
  const events = [message('$2', 'Second', 2)]
  const older = [message('$1', 'First', 1)]
  const filters: Filter[] = []
  let timeline = { getEvents: () => events }
  const timelineSet = { getLiveTimeline: () => timeline }
  const room = Object.assign(new EventEmitter(), {
    getOrCreateFilteredTimelineSet: (filter: Filter) => {
      filters.push(filter)
      return timelineSet
    }
  })
  // A gappy sync swaps in an empty live timeline.
  const reset = () => {
    events.splice(0)
    older.push(message('$1', 'First', 1), message('$2', 'Second', 2))
    timeline = { getEvents: () => events }
    room.emit(RoomEvent.TimelineReset, room, timelineSet, true)
  }
  const paginate = vi.fn(() => {
    events.unshift(...older.splice(0))
    return Promise.resolve(false)
  })
  const client: FeedClient & EventEmitter = Object.assign(new EventEmitter(), {
    getUserId: () => '@alice:acme.test',
    getRoom: (id: string) => (id === ROOM ? room : null),
    paginateEventTimeline: paginate
  })
  const pages: FeedPage[] = []
  const open = (roomId = ROOM) =>
    matrixFeed(() => Promise.resolve(client)).open(roomId, 'messages', page =>
      pages.push(page)
    )
  return { events, room, client, paginate, filters, pages, open, reset }
}

describe('matrixFeed', () => {
  it("reads the filter's event types and a first page of older ones", async () => {
    const { filters, pages, open } = setUp()

    await open()

    expect(filters[0]?.getDefinition()).toEqual({
      room: {
        timeline: { types: ['m.room.message', 'com.twake.feed.messages'] }
      }
    })
    expect(pages.at(-1)).toEqual({
      entries: [
        expect.objectContaining({ id: '$1', body: 'First' }),
        expect.objectContaining({ id: '$2', body: 'Second' })
      ],
      hasOlder: false
    })
  })

  it('follows new events, edits and redactions until closed', async () => {
    const { events, room, client, pages, open } = setUp()
    const view = await open()

    events.push(message('$3', 'Third', 3))
    room.emit(RoomEvent.Timeline)
    client.emit(MatrixEventEvent.Replaced, message('$x', 'x', 4))
    room.emit(RoomEvent.Redaction)
    const followed = pages.length
    view.close()
    room.emit(RoomEvent.Timeline)

    expect(followed).toBe(5)
    expect(pages).toHaveLength(5)
    expect(pages.at(-1)?.entries.map(entry => entry.id)).toEqual([
      '$1',
      '$2',
      '$3'
    ])
  })

  it('reloads a first page when the homeserver resets the timeline', async () => {
    const { paginate, pages, open, reset } = setUp()
    await open()

    reset()

    await vi.waitFor(() => {
      expect(paginate).toHaveBeenCalledTimes(2)
      expect(pages.at(-1)?.entries.map(entry => entry.id)).toEqual(['$1', '$2'])
    })
  })

  it('ignores an older page that arrives after a reset', async () => {
    const { paginate, pages, open, reset } = setUp()
    const view = await open()
    let reachStart: () => void = () => undefined
    paginate.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          reachStart = () => {
            resolve(false)
          }
        })
    )
    paginate.mockImplementationOnce(() => Promise.resolve(true))
    const stale = view.loadOlder()

    reset()
    await vi.waitFor(() => {
      expect(paginate).toHaveBeenCalledTimes(3)
    })
    reachStart()
    await stale

    expect(pages.at(-1)?.hasOlder).toBe(true)
  })

  it('refuses a Matrix space the user is not in', async () => {
    const { open } = setUp()

    await expect(open('!other:acme.test')).rejects.toThrow(/!other/)
  })
})
