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

export type TabState = 'off' | 'preparing' | 'stalled' | 'ready'

/** How long an app may take to prepare a new space's resource. */
export const PREPARING_MS = 2 * 60_000

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

export function spaceTabs(
  space: Space,
  now: number
): { tab: Tab; state: TabState }[] {
  const waiting =
    now < Date.parse(space.createdAt) + PREPARING_MS ? 'preparing' : 'stalled'
  return TABS.flatMap((tab): { tab: Tab; state: TabState }[] => {
    if (tab === 'members') return [{ tab, state: 'ready' }]
    const resource = space.resources.find(r => r.kind === RESOURCE[tab])
    if (!resource || !space.apps.includes(tab)) return []
    if (!isOn(space, tab)) return [{ tab, state: 'off' }]
    const ready =
      resource.id !== null &&
      (resource.kind !== 'matrix_space' || space.homeserverUrl !== null)
    return [{ tab, state: ready ? 'ready' : waiting }]
  })
}

/** The tab a card about an object in this container opens, if the space shows it. */
export function containerTab(space: Space, kind: ResourceKind): Tab | null {
  const tab = TABS.find(
    t => t !== 'feed' && t !== 'members' && RESOURCE[t] === kind
  )
  // Preparing or stalled, the tab is shown all the same.
  const shown = spaceTabs(space, Date.now()).some(
    item => item.tab === tab && item.state !== 'off'
  )
  return tab && shown ? tab : null
}
