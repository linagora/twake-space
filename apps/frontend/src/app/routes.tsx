import type { RouteObject } from 'react-router'

import { HomeScreen } from '@/ui/home/HomeScreen'
import { SpaceScreen } from '@/ui/space/SpaceScreen'

export const routes: RouteObject[] = [
  { path: '/', element: <HomeScreen /> },
  { path: '/spaces/:spaceId/:tab?/*', element: <SpaceScreen /> }
]
