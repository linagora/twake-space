import type { ResourceKind, Space } from '@/application/spaces'

export const TABS = [
  'feed',
  'chat',
  'tasks',
  'drive',
  'mail',
  'calendar',
  'members'
] as const

export type Tab = (typeof TABS)[number]

export type TabState = 'off' | 'preparing' | 'ready'

const RESOURCE: Record<Exclude<Tab, 'members'>, ResourceKind> = {
  feed: 'matrix_space',
  chat: 'matrix_space',
  tasks: 'project',
  drive: 'drive',
  mail: 'mailbox',
  calendar: 'calendar'
}

function isOn(space: Space, tab: Tab): boolean {
  if (tab === 'feed' || tab === 'chat') return space.chat
  if (tab === 'mail') return space.mail
  return true
}

export function spaceTabs(space: Space): { tab: Tab; state: TabState }[] {
  return TABS.map(tab => {
    if (tab === 'members') return { tab, state: 'ready' }
    if (!isOn(space, tab)) return { tab, state: 'off' }
    const resource = space.resources.find(r => r.kind === RESOURCE[tab])
    const ready =
      Boolean(resource?.id) &&
      (RESOURCE[tab] !== 'matrix_space' || space.homeserverUrl !== null)
    return { tab, state: ready ? 'ready' : 'preparing' }
  })
}
