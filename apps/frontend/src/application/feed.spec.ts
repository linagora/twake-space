import { describe, expect, it } from 'vitest'

import { FEED_TYPES, toFeedEntry, type RoomEvent } from '@/application/feed'

const card: RoomEvent = {
  id: '$card',
  type: 'com.twake.feed.activities',
  sender: '@twake-space:acme.test',
  ts: 1_000,
  content: {
    type: 'com.twake.tasks.task.created.v1',
    id: 'evt-1',
    actor: { type: 'user', id: 'u-1', email: 'bob@acme.test' },
    object: {
      type: 'task',
      id: 'T-1',
      title: 'Write the brief',
      url: 'https://tasks.test/T-1'
    },
    preview: 'Due Friday',
    state: {},
    body: 'Write the brief\nDue Friday'
  }
}

describe('FEED_TYPES', () => {
  it('reads each filter from its own event types', () => {
    expect(FEED_TYPES.messages).toEqual([
      'm.room.message',
      'com.twake.feed.messages'
    ])
    expect(FEED_TYPES.files).toEqual(['com.twake.feed.files'])
    expect(FEED_TYPES.all).toEqual([
      'm.room.message',
      'com.twake.feed.messages',
      'com.twake.feed.files',
      'com.twake.feed.activities',
      'com.twake.feed.events'
    ])
  })
})

describe('toFeedEntry', () => {
  it('reads a card', () => {
    expect(toFeedEntry(card)).toEqual({
      kind: 'card',
      id: '$card',
      ts: 1_000,
      category: 'activities',
      actor: { type: 'user', id: 'u-1', email: 'bob@acme.test' },
      object: {
        type: 'task',
        id: 'T-1',
        title: 'Write the brief',
        url: 'https://tasks.test/T-1'
      },
      preview: 'Due Friday'
    })
  })

  it('reads a text message', () => {
    expect(
      toFeedEntry({
        id: '$m',
        type: 'm.room.message',
        sender: '@bob:acme.test',
        ts: 2_000,
        content: { msgtype: 'm.text', body: 'Hello' }
      })
    ).toEqual({
      kind: 'message',
      id: '$m',
      ts: 2_000,
      sender: '@bob:acme.test',
      body: 'Hello'
    })
  })

  it('skips an edit, which its card already shows', () => {
    expect(
      toFeedEntry({
        ...card,
        content: {
          ...card.content,
          'm.relates_to': { rel_type: 'm.replace', event_id: '$card' }
        }
      })
    ).toBeNull()
  })

  it('skips a card it cannot read', () => {
    expect(toFeedEntry({ ...card, content: { body: 'x' } })).toBeNull()
  })

  it('skips a redacted message', () => {
    expect(
      toFeedEntry({
        id: '$m',
        type: 'm.room.message',
        sender: '@bob:acme.test',
        ts: 2_000,
        content: {}
      })
    ).toBeNull()
  })

  it('skips other event types', () => {
    expect(toFeedEntry({ ...card, type: 'm.reaction' })).toBeNull()
  })
})
