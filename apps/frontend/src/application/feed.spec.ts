import { describe, expect, it } from 'vitest'

import {
  cardAction,
  cardApp,
  toEventState,
  toFeedChange,
  type FeedCard
} from '@/application/feed'

const card: FeedCard = {
  id: 'c1',
  kind: 'card',
  category: 'activities',
  time: '2026-10-07T08:00:00.000Z',
  updatedAt: '2026-10-07T09:00:00.000Z',
  reactions: [],
  type: 'com.twake.tasks.task.moved.v1',
  actor: { type: 'user', id: 'u1', name: 'Bob' },
  object: {
    type: 'task',
    id: 'T-1',
    title: 'Write the brief',
    container: { kind: 'project', id: 'p1' }
  },
  preview: null,
  state: {}
}

describe('toFeedChange', () => {
  it('reads a feed live event', () => {
    expect(
      toFeedChange({ spaceId: 'a1', itemId: 'c1', change: 'removed' })
    ).toEqual({ spaceId: 'a1', itemId: 'c1', change: 'removed' })
  })

  it('ignores one it cannot read', () => {
    expect(toFeedChange({ spaceId: 'a1', itemId: 'c1' })).toBeNull()
    expect(toFeedChange({ spaceId: 'a1', change: 'added' })).toBeNull()
    expect(toFeedChange(null)).toBeNull()
  })
})

describe('cards', () => {
  it('read their app and their latest action from the event type', () => {
    expect(cardApp(card)).toBe('tasks')
    expect(cardAction(card)).toBe('moved')
  })

  it('leave both unknown on a type they cannot read', () => {
    const other = { ...card, type: 'other' }
    expect(cardApp(other)).toBeNull()
    expect(cardAction(other)).toBeNull()
  })
})

describe('toEventState', () => {
  it("reads a calendar card's times, place and answers", () => {
    expect(
      toEventState({
        start: '2026-10-08T09:00:00Z',
        end: '2026-10-08T10:00:00Z',
        allDay: false,
        location: 'Room 4',
        previous: {
          start: '2026-10-08T08:00:00Z',
          end: '2026-10-08T09:00:00Z'
        },
        rsvp: { accepted: 2, declined: 1 }
      })
    ).toEqual({
      start: '2026-10-08T09:00:00Z',
      end: '2026-10-08T10:00:00Z',
      allDay: false,
      location: 'Room 4',
      previous: { start: '2026-10-08T08:00:00Z', end: '2026-10-08T09:00:00Z' },
      proposed: null,
      rsvp: { accepted: 2, declined: 1, tentative: 0, pending: 0 }
    })
  })

  it('reads a proposed new time with who proposed it', () => {
    expect(
      toEventState({
        start: '2026-10-08',
        end: '2026-10-09',
        allDay: true,
        proposed: {
          start: '2026-10-10',
          end: '2026-10-11',
          by: 'carol@acme.test'
        }
      })
    ).toMatchObject({
      allDay: true,
      proposed: {
        start: '2026-10-10',
        end: '2026-10-11',
        by: 'carol@acme.test'
      }
    })
  })

  it('has nothing to show without times', () => {
    expect(toEventState({})).toBeNull()
  })
})
