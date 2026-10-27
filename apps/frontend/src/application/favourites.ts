import type { MetadataSnapshots } from '@/application/metadata'

// The last favourite Chat reported for each Matrix space, 1 or 0
export type SeenFavourites = Readonly<Record<string, number>>

export function chatFavourites(
  snapshots: MetadataSnapshots
): Map<string, number> {
  const favourites = new Map<string, number>()
  for (const [resourceId, metadata] of snapshots.chat) {
    const value = metadata.get('favourite')
    if (typeof value === 'number') favourites.set(resourceId, value)
  }
  return favourites
}

// Twake Space cannot set a favourite in Chat, so only a change in Chat moves
// a pin: a pin set or removed in Twake Space stays until Chat changes. A space
// never seen counts as not favourite.
export function favouriteChanges(
  seen: SeenFavourites,
  reported: ReadonlyMap<string, number>
): { pin: string[]; unpin: string[] } {
  const pin: string[] = []
  const unpin: string[] = []
  for (const [id, value] of reported) {
    if (value === (seen[id] ?? 0)) continue
    if (value === 1) pin.push(id)
    else unpin.push(id)
  }
  return { pin, unpin }
}
