import { describe, expect, it } from 'vitest'

import { containerTab, PREPARING_MS, spaceTabs } from '@/application/spaceTabs'
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
  apps: ['feed', 'chat', 'tasks', 'drive', 'mail', 'calendar'],
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
      { tab: 'calendar', state: 'ready' },
      { tab: 'members', state: 'ready' }
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

  it('leaves out the tabs of the apps the space does not use', () => {
    const tabs = spaceTabs({ ...space, apps: ['feed', 'drive'] }, SOON)

    expect(tabs.map(t => t.tab)).toEqual(['feed', 'drive', 'members'])
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

    expect(tabs.map(t => t.tab)).toEqual([
      'feed',
      'tasks',
      'mail',
      'calendar',
      'members'
    ])
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
    expect(
      containerTab({ ...space, apps: ['feed', 'chat'] }, 'project')
    ).toBeNull()
  })
})
