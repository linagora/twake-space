import { describe, expect, it } from 'vitest'

import type { FeedCard, FeedPost } from '@/application/feed'
import { newsBrief } from '@/application/newsBrief'

const post = (body: string): FeedPost => ({
  kind: 'post',
  id: 'p1',
  category: 'messages',
  time: '2026-10-05T11:00:00.000Z',
  updatedAt: '2026-10-05T11:00:00.000Z',
  reactions: [],
  author: { type: 'user', id: 'u-bob', name: 'Bob' },
  body,
  editedAt: null,
  poll: null,
  approval: null,
  announcement: null,
  feedback: null,
  form: null
})

const card: FeedCard = {
  kind: 'card',
  id: 'c1',
  category: 'activities',
  time: '2026-10-05T10:00:00.000Z',
  updatedAt: '2026-10-05T10:00:00.000Z',
  reactions: [],
  type: 'com.twake.tasks.task.moved.v1',
  actor: { type: 'deleted_user' },
  object: { type: 'task', id: 't1', title: 'Ship v2', container: null },
  preview: 'Moved to Done',
  state: {},
  files: null
}

describe('newsBrief', () => {
  it('lists each space with its mentions and its items', () => {
    expect(
      newsBrief([
        {
          name: 'Roadmap',
          mentions: 2,
          items: [post('Release\non Friday'), card]
        },
        { name: 'Quiet', mentions: 0, items: [] }
      ])
    ).toBe(
      [
        '## Roadmap',
        'The user has 2 unread mention(s).',
        '- 2026-10-05T11:00:00.000Z Bob posted: Release on Friday',
        '- 2026-10-05T10:00:00.000Z Someone, task moved, "Ship v2": Moved to Done',
        '',
        '## Quiet'
      ].join('\n')
    )
  })

  it('cuts a long text', () => {
    const line = newsBrief([
      { name: 'Roadmap', mentions: 0, items: [post('a'.repeat(300))] }
    ]).split('\n')[1]

    expect(line).toBe(
      `- 2026-10-05T11:00:00.000Z Bob posted: ${'a'.repeat(280)}…`
    )
  })
})
