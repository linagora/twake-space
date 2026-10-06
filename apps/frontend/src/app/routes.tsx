import type { RouteObject } from 'react-router'

import { HomeScreen } from '@/ui/home/HomeScreen'
import { AppShell } from '@/ui/shell/AppShell'
import { SpaceScreen } from '@/ui/space/SpaceScreen'

export const routes: RouteObject[] = [
  {
    element: <AppShell />,
    children: [
      { path: '/', element: <HomeScreen /> },
      { path: '/spaces/:spaceId/:tab?/*', element: <SpaceScreen /> }
    ]
  }
]
