import { createContext, use } from 'react'

import type { LiveService } from '@/application/live'
import type { SpacesService } from '@/application/spaces'

export interface Services {
  spaces: SpacesService
  live: LiveService
  tasksUrl: string | null
}

export const ServicesContext = createContext<Services | null>(null)

export function useServices(): Services {
  const services = use(ServicesContext)
  if (!services) throw new Error('useServices must be used inside Services')
  return services
}
