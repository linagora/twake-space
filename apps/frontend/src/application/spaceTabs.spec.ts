import { describe, expect, it } from 'vitest'

import type { FeedCard, FeedPost } from '@/application/feed'
import {
  containerTab,
  itemPlace,
  PREPARING_MS,
  spaceTabs
} from '@/application/spaceTabs'
import type { Space } from '@/application/spaces'

const CREATED = Date.UTC(2026, 9, 1, 8)
const SOON = CREATED + 1000

const space: Space = {
  id: 'a1',
  name: 'Roadmap',
  role: 'editor',
  createdAt: new Date(CREATED).toISOString(),
  color: null,
  description: '',
  apps: ['chat', 'tasks', 'drive', 'mail', 'calendar'],
  chat: true,
  mail: true,
  homeserverUrl: 'https://matrix.acme.test',
  members: [],
  groups: [],
  resources: [
    { kind: 'matrix_space', id: '!room:acme' },
    { kind: 'project', id: 'project-1' },
    { kind: 'drive', id: null },
    { kind: 'mailbox', id: 'roadmap@acme' },
    { kind: 'calendar', id: 'cal-1' }
  ]
}

describe('spaceTabs', () => {
  it("gives each tab its app's resource state", () => {
    expect(spaceTabs(space, SOON)).toEqual([
      { tab: 'feed', state: 'ready' },
      { tab: 'chat', state: 'ready' },
      { tab: 'tasks', state: 'ready' },
      { tab: 'drive', state: 'preparing' },
      { tab: 'mail', state: 'ready' },
      { tab: 'calendar', state: 'ready' }
    ])
  })

  it('prepares Chat until the homeserver is known', () => {
    const states = spaceTabs({ ...space, homeserverUrl: null }, SOON)

    expect(states.slice(0, 2)).toEqual([
      { tab: 'feed', state: 'ready' },
      { tab: 'chat', state: 'preparing' }
    ])
  })

  it('turns Chat off without chat, and Mail off without mail', () => {
    const states = spaceTabs({ ...space, chat: false, mail: false }, SOON)

    expect(states.filter(t => t.state === 'off').map(t => t.tab)).toEqual([
      'chat',
      'mail'
    ])
  })

  it('leaves out the apps the space does not use, never the feed', () => {
    const tabs = spaceTabs({ ...space, apps: ['drive'] }, SOON)

    expect(tabs).toEqual([
      { tab: 'feed', state: 'ready' },
      { tab: 'drive', state: 'preparing' }
    ])
  })

  it('has no tab for an app this deployment does not provide', () => {
    const tabs = spaceTabs(
      {
        ...space,
        resources: space.resources.filter(
          r => r.kind !== 'drive' && r.kind !== 'matrix_space'
        )
      },
      SOON
    )

    expect(tabs.map(t => t.tab)).toEqual(['feed', 'tasks', 'mail', 'calendar'])
  })

  it('says a resource still missing after a while is not ready', () => {
    expect(spaceTabs(space, CREATED + PREPARING_MS)).toContainEqual({
      tab: 'drive',
      state: 'stalled'
    })
  })
})

describe('containerTab', () => {
  it("opens each container in its app's tab, and a Matrix space in Chat", () => {
    expect(
      (
        ['project', 'drive', 'mailbox', 'calendar', 'matrix_space'] as const
      ).map(kind => containerTab(space, kind))
    ).toEqual(['tasks', 'drive', 'mail', 'calendar', 'chat'])
  })

  it('opens no tab the space does not show', () => {
    expect(containerTab({ ...space, mail: false }, 'mailbox')).toBeNull()
    expect(containerTab({ ...space, apps: ['chat'] }, 'project')).toBeNull()
  })
})

describe('itemPlace', () => {
  const card: FeedCard = {
    id: 'card-1',
    kind: 'card',
    category: 'activities',
    time: '2026-10-07T08:00:00.000Z',
    updatedAt: '2026-10-07T08:00:00.000Z',
    reactions: [],
    type: 'com.twake.tasks.task.created.v1',
    actor: null,
    object: {
      type: 'task',
      id: 'T-1',
      title: 'Ship it',
      container: { kind: 'project', id: 'project-1' }
    },
    preview: null,
    state: {}
  }
  const post: FeedPost = {
    id: 'post-1',
    kind: 'post',
    category: 'messages',
    time: '2026-10-07T08:00:00.000Z',
    updatedAt: '2026-10-07T08:00:00.000Z',
    reactions: [],
    author: { type: 'deleted_user' },
    body: 'Hello',
    editedAt: null
  }

  it("opens a card in its container's tab", () => {
    expect(itemPlace(space, card)).toEqual({ tab: 'tasks', feedItem: null })
  })

  it('opens a post, or a card with no tab, in the feed at the item', () => {
    expect(itemPlace(space, post)).toEqual({ tab: 'feed', feedItem: 'post-1' })
    expect(itemPlace({ ...space, apps: ['chat'] }, card)).toEqual({
      tab: 'feed',
      feedItem: 'card-1'
    })
  })
})
