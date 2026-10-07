import type { Badge } from '@linagora/twake-embed'
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

type Action =
  | { type: 'replace'; app: EmbeddedApp; badges: readonly Badge[] }
  | { type: 'reset'; app: EmbeddedApp }

function reduce(snapshots: BadgeSnapshots, action: Action): BadgeSnapshots {
  return action.type === 'replace'
    ? replaceSnapshot(snapshots, action.app, action.badges)
    : resetSnapshot(snapshots, action.app)
}

export interface BadgeActions {
  // The app's whole snapshot of counts
  replace: (app: EmbeddedApp, badges: readonly Badge[]) => void
  // The app's frame is gone or its document reloaded
  reset: (app: EmbeddedApp) => void
}

const SnapshotsContext = createContext<BadgeSnapshots>(emptySnapshots())
const ActionsContext = createContext<BadgeActions>({
  replace: () => undefined,
  reset: () => undefined
})

// What the embedded apps report for the tabs and the list of spaces. The
// frames write it; the screens read it.
export function BadgesProvider({
  children
}: {
  children: ReactNode
}): ReactElement {
  const [snapshots, dispatch] = useReducer(reduce, undefined, emptySnapshots)
  const actions = useMemo<BadgeActions>(
    () => ({
      replace: (app, badges) => {
        dispatch({ type: 'replace', app, badges })
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
  return use(SnapshotsContext)
}

export function useBadgeActions(): BadgeActions {
  return use(ActionsContext)
}
