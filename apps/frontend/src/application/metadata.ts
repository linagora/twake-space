import type { Badge, Metadata } from '@linagora/twake-embed'

import { spaceResourceId } from '@/application/badges'
import type { EmbeddedApp } from '@/application/embeddedApps'
import type { Space } from '@/application/spaces'

type Value = number | string
type ResourceMetadata = ReadonlyMap<string, Value>

// What each app last reported, by resource id then name. An app that sends
// metadata reports its tab counts in it too, under `badge`.
export type MetadataSnapshots = Record<
  EmbeddedApp,
  ReadonlyMap<string, ResourceMetadata>
>

export function emptyMetadata(): MetadataSnapshots {
  return {
    chat: new Map(),
    tasks: new Map(),
    drive: new Map(),
    mail: new Map(),
    calendar: new Map()
  }
}

// A message is the app's whole snapshot: it replaces the previous one.
export function replaceMetadata(
  snapshots: MetadataSnapshots,
  app: EmbeddedApp,
  metadata: readonly Metadata[]
): MetadataSnapshots {
  const byResource = new Map<string, Map<string, Value>>()
  for (const { resourceId, name, value } of metadata) {
    const entries = byResource.get(resourceId) ?? new Map<string, Value>()
    entries.set(name, value)
    byResource.set(resourceId, entries)
  }
  return { ...snapshots, [app]: byResource }
}

export function resetMetadata(
  snapshots: MetadataSnapshots,
  app: EmbeddedApp
): MetadataSnapshots {
  return snapshots[app].size === 0
    ? snapshots
    : { ...snapshots, [app]: new Map() }
}

// The tab counts carried by the metadata, as the badges message has them
export function badgesOf(metadata: readonly Metadata[]): Badge[] {
  return metadata.flatMap(({ resourceId, name, value }) =>
    name === 'badge' && typeof value === 'number'
      ? [{ resourceId, count: value }]
      : []
  )
}

export type HomeFigure = 'tasks' | 'files' | 'events'

const numberOf = (metadata: ResourceMetadata, name: string) => {
  const value = metadata.get(name)
  return typeof value === 'number' ? value : undefined
}

export const HOME_FIGURES: Record<
  HomeFigure,
  {
    app: EmbeddedApp
    read: (metadata: ResourceMetadata) => number | null | undefined
  }
> = {
  tasks: {
    app: 'tasks',
    read: metadata => {
      const done = numberOf(metadata, 'tasks.done')
      const total = numberOf(metadata, 'tasks.total')
      if (done === undefined || total === undefined) return undefined
      return total === 0
        ? null
        : Math.round((Math.min(done, total) / total) * 100)
    }
  },
  files: { app: 'drive', read: metadata => numberOf(metadata, 'files.count') },
  events: {
    app: 'calendar',
    read: metadata => numberOf(metadata, 'events.upcoming')
  }
}

// The figure the app reported for the resource this space has for it:
// undefined while it has not, null when it has none to show.
export function homeFigure(
  snapshots: MetadataSnapshots,
  space: Pick<Space, 'resources'>,
  figure: HomeFigure
): number | null | undefined {
  const { app, read } = HOME_FIGURES[figure]
  const id = spaceResourceId(space, app)
  const metadata = id === null ? undefined : snapshots[app].get(id)
  return metadata && read(metadata)
}
