import type { Badge } from '@linagora/twake-embed'

import { EMBEDDED_APPS, type EmbeddedApp } from '@/application/embeddedApps'
import type { Space } from '@/application/spaces'
import { isTabReady } from '@/application/spaceTabs'

// What each app last reported: its counts by resource id, for every space the
// user has, not only the one shown. One snapshot per app.
export type BadgeSnapshots = Record<EmbeddedApp, ReadonlyMap<string, number>>

const MAX_SHOWN = 99

export function emptySnapshots(): BadgeSnapshots {
  return {
    chat: new Map(),
    tasks: new Map(),
    drive: new Map(),
    mail: new Map(),
    calendar: new Map()
  }
}

// A message is the app's whole snapshot: it replaces the previous one.
export function replaceSnapshot(
  snapshots: BadgeSnapshots,
  app: EmbeddedApp,
  badges: readonly Badge[]
): BadgeSnapshots {
  return {
    ...snapshots,
    [app]: new Map(badges.map(badge => [badge.resourceId, badge.count]))
  }
}

// The app's frame is gone or its document reloaded: what it reported is too.
export function resetSnapshot(
  snapshots: BadgeSnapshots,
  app: EmbeddedApp
): BadgeSnapshots {
  return snapshots[app].size === 0
    ? snapshots
    : { ...snapshots, [app]: new Map() }
}

export function hasCounts(snapshots: BadgeSnapshots): boolean {
  return Object.values(snapshots).some(snapshot => snapshot.size > 0)
}

// The count of an app for the resource this space has for it, never the
// resource the app's frame happens to show. Null while the app has not
// reported a count for it.
export function spaceCount(
  snapshots: BadgeSnapshots,
  space: Pick<Space, 'resources'>,
  app: EmbeddedApp
): number | null {
  const id = space.resources.find(
    r => r.kind === EMBEDDED_APPS[app].resource
  )?.id
  return id === undefined || id === null
    ? null
    : (snapshots[app].get(id) ?? null)
}

// What the tabs of the space show: its ready embedded tabs, with a count.
export function tabCount(
  snapshots: BadgeSnapshots,
  space: Space,
  app: EmbeddedApp
): number {
  return isTabReady(space, app) ? (spaceCount(snapshots, space, app) ?? 0) : 0
}

// The sum, over the apps, of the counts of a space's resources, as long as
// the app has reported one for them.
export function spaceTotal(snapshots: BadgeSnapshots, space: Space): number {
  return (Object.keys(EMBEDDED_APPS) as EmbeddedApp[]).reduce(
    (total, app) => total + tabCount(snapshots, space, app),
    0
  )
}

// Nothing at 0, then the count, and 99+ above 99.
export function badgeLabel(count: number): string | null {
  if (count <= 0) return null
  return count > MAX_SHOWN ? `${String(MAX_SHOWN)}+` : String(count)
}
