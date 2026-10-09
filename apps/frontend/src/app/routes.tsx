import type { RouteObject } from 'react-router'

import { HomeScreen } from '@/ui/home/HomeScreen'
import { AppShell } from '@/ui/shell/AppShell'
import { ErrorScreen } from '@/ui/shell/ErrorScreen'
import { ShelfScreen } from '@/ui/shelves/ShelfScreen'
import { SpaceScreen } from '@/ui/space/SpaceScreen'
import { SpaceSettingsScreen } from '@/ui/space/SpaceSettingsScreen'
import { ApiTokensScreen } from '@/ui/tokens/ApiTokensScreen'

export const routes: RouteObject[] = [
  {
    element: <AppShell />,
    errorElement: <ErrorScreen />,
    children: [
      {
        // Catches errors below the shell so the page keeps its navigation
        errorElement: <ErrorScreen />,
        children: [
          { path: '/', element: <HomeScreen /> },
          { path: '/archives', element: <ShelfScreen state="archived" /> },
          { path: '/bin', element: <ShelfScreen state="trashed" /> },
          {
            path: '/spaces/:spaceId/settings',
            element: <SpaceSettingsScreen />
          },
          { path: '/spaces/:spaceId/:tab?/*', element: <SpaceScreen /> },
          {
            path: '/settings/api-tokens/:owner?',
            element: <ApiTokensScreen />
          },
          { path: '*', element: <ErrorScreen /> }
        ]
      }
    ]
  }
]
