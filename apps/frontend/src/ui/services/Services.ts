import { createContext, use } from 'react'

import type { DirectoryService } from '@/application/directory'
import type { FeedService } from '@/application/feed'
import type { LiveService } from '@/application/live'
import type { MatrixService } from '@/application/matrix'
import type { SpacesService } from '@/application/spaces'

export interface Services {
  spaces: SpacesService
  directory: DirectoryService
  live: LiveService
  matrix: MatrixService
  feed: FeedService
  tasksUrl: string | null
  mailUrl: string | null
}

export const ServicesContext = createContext<Services | null>(null)

export function useServices(): Services {
  const services = use(ServicesContext)
  if (!services) throw new Error('useServices must be used inside Services')
  return services
}
