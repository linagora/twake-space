import { createContext, use } from 'react'

import type { SpacesService } from '@/application/spaces'

export interface Services {
  spaces: SpacesService
}

export const ServicesContext = createContext<Services | null>(null)

export function useServices(): Services {
  const services = use(ServicesContext)
  if (!services) throw new Error('useServices must be used inside Services')
  return services
}
