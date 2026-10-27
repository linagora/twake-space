import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import { spaceResourceId } from '@/application/badges'
import {
  chatFavourites,
  favouriteChanges,
  type SeenFavourites
} from '@/application/favourites'
import { useMetadata } from '@/ui/space/Badges'
import { useServices } from '@/ui/services/Services'
import { useSession } from '@/ui/session/SessionGate'
import { SPACES, useSpaceList, useSpaces } from '@/ui/spaces/queries'

// By user: a space two people share has the same Matrix space for both.
const seenKey = (userId: string | null) =>
  `twake-space:chat-favourites:${userId ?? ''}`

function readSeen(key: string): SeenFavourites {
  try {
    const seen: unknown = JSON.parse(localStorage.getItem(key) ?? '{}')
    return typeof seen === 'object' && seen !== null
      ? (seen as SeenFavourites)
      : {}
  } catch {
    return {}
  }
}

function writeSeen(key: string, seen: SeenFavourites): void {
  try {
    localStorage.setItem(key, JSON.stringify({ ...readSeen(key), ...seen }))
  } catch {
    // Without storage the next report counts as new again
  }
}

// Pins and unpins the spaces whose favourite changed in Chat. The list holds
// no resources, so the spaces are read once Chat reported any.
export function ChatFavourites(): null {
  const reported = chatFavourites(useMetadata())
  const list = useSpaceList().data ?? []
  const details = useSpaces(
    list.map(space => space.id),
    reported.size > 0
  )
  const { spaces } = useServices()
  const { user } = useSession()
  const queryClient = useQueryClient()
  const loaded = details.every(detail => !detail.isPending)
  const key = JSON.stringify([[...reported], list.map(space => space.id)])

  useEffect(() => {
    if (reported.size === 0 || !loaded) return
    const storage = seenKey(user.id)
    const byRoom = new Map<string, { id: string; pinned: boolean }>()
    list.forEach((space, index) => {
      const detail = details[index]?.data
      const room = detail && spaceResourceId(detail, 'chat')
      if (room)
        byRoom.set(room, { id: space.id, pinned: space.pinnedAt !== null })
    })
    const known = new Map([...reported].filter(([room]) => byRoom.has(room)))
    const { pin, unpin } = favouriteChanges(readSeen(storage), known)
    const writes = [
      ...pin.map(room => [room, true] as const),
      ...unpin.map(room => [room, false] as const)
    ].filter(([room, pinned]) => byRoom.get(room)?.pinned !== pinned)
    // A room is seen once its pin follows Chat, so a failed write is tried
    // again on the next report.
    const pending = new Set(writes.map(([room]) => room))
    writeSeen(
      storage,
      Object.fromEntries([...known].filter(([room]) => !pending.has(room)))
    )
    if (writes.length === 0) return
    void Promise.allSettled(
      writes.map(async ([room, pinned]) => {
        const space = byRoom.get(room)
        if (!space) return
        await spaces.setPinned(space.id, pinned)
        writeSeen(storage, { [room]: known.get(room) ?? 0 })
      })
    ).then(() => queryClient.invalidateQueries({ queryKey: SPACES }))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reported, list and details are read through key and loaded
  }, [key, loaded])

  return null
}
