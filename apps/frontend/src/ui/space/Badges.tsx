import type { Badge, Metadata } from '@linagora/twake-embed'
import {
  createContext,
  use,
  useMemo,
  useReducer,
  type ReactElement,
  type ReactNode
} from 'react'

import {
  emptySnapshots,
  replaceSnapshot,
  resetSnapshot,
  type BadgeSnapshots
} from '@/application/badges'
import type { EmbeddedApp } from '@/application/embeddedApps'
import {
  emptyMetadata,
  replaceMetadata,
  resetMetadata,
  type MetadataSnapshots
} from '@/application/metadata'

interface Snapshots {
  badges: BadgeSnapshots
  metadata: MetadataSnapshots
}

type Action =
  | { type: 'replace'; app: EmbeddedApp; badges: readonly Badge[] }
  | { type: 'metadata'; app: EmbeddedApp; metadata: readonly Metadata[] }
  | { type: 'reset'; app: EmbeddedApp }

function reduce(snapshots: Snapshots, action: Action): Snapshots {
  switch (action.type) {
    case 'replace':
      return {
        ...snapshots,
        badges: replaceSnapshot(snapshots.badges, action.app, action.badges)
      }
    case 'metadata':
      return {
        ...snapshots,
        metadata: replaceMetadata(
          snapshots.metadata,
          action.app,
          action.metadata
        )
      }
    case 'reset':
      return {
        badges: resetSnapshot(snapshots.badges, action.app),
        metadata: resetMetadata(snapshots.metadata, action.app)
      }
  }
}

function empty(): Snapshots {
  return { badges: emptySnapshots(), metadata: emptyMetadata() }
}

export interface BadgeActions {
  // The app's whole snapshot of counts
  replace: (app: EmbeddedApp, badges: readonly Badge[]) => void
  // The app's whole snapshot of metadata
  metadata: (app: EmbeddedApp, metadata: readonly Metadata[]) => void
  // The app's frame is gone or its document reloaded
  reset: (app: EmbeddedApp) => void
}

const SnapshotsContext = createContext<Snapshots>(empty())
const ActionsContext = createContext<BadgeActions>({
  replace: () => undefined,
  metadata: () => undefined,
  reset: () => undefined
})

// What the embedded apps report for the tabs, the list of spaces and the
// space home. The frames write it; the screens read it.
export function BadgesProvider({
  children
}: {
  children: ReactNode
}): ReactElement {
  const [snapshots, dispatch] = useReducer(reduce, undefined, empty)
  const actions = useMemo<BadgeActions>(
    () => ({
      replace: (app, badges) => {
        dispatch({ type: 'replace', app, badges })
      },
      metadata: (app, metadata) => {
        dispatch({ type: 'metadata', app, metadata })
      },
      reset: app => {
        dispatch({ type: 'reset', app })
      }
    }),
    []
  )
  return (
    <ActionsContext value={actions}>
      <SnapshotsContext value={snapshots}>{children}</SnapshotsContext>
    </ActionsContext>
  )
}

export function useBadges(): BadgeSnapshots {
  return use(SnapshotsContext).badges
}

export function useMetadata(): MetadataSnapshots {
  return use(SnapshotsContext).metadata
}

export function useBadgeActions(): BadgeActions {
  return use(ActionsContext)
}
