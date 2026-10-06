import { describe, expect, it } from 'vitest'

import { spaceTabs } from '@/application/spaceTabs'
import type { Space } from '@/application/spaces'

const space: Space = {
  id: 'a1',
  name: 'Roadmap',
  role: 'editor',
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
    expect(spaceTabs(space)).toEqual([
      { tab: 'feed', state: 'ready' },
      { tab: 'chat', state: 'ready' },
      { tab: 'tasks', state: 'ready' },
      { tab: 'drive', state: 'preparing' },
      { tab: 'mail', state: 'ready' },
      { tab: 'calendar', state: 'ready' }
    ])
  })

  it('prepares Feed and Chat until the homeserver is known', () => {
    const states = spaceTabs({ ...space, homeserverUrl: null })

    expect(states.slice(0, 2)).toEqual([
      { tab: 'feed', state: 'preparing' },
      { tab: 'chat', state: 'preparing' }
    ])
  })

  it('turns Feed and Chat off without chat, and Mail off without mail', () => {
    const states = spaceTabs({ ...space, chat: false, mail: false })

    expect(states.filter(t => t.state === 'off').map(t => t.tab)).toEqual([
      'feed',
      'chat',
      'mail'
    ])
  })

  it('shows a resource missing from the answer as being prepared', () => {
    expect(spaceTabs({ ...space, resources: [] })).toContainEqual({
      tab: 'tasks',
      state: 'preparing'
    })
  })
})
