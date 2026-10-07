import { createContext, use } from 'react'

import type { DirectoryService } from '@/application/directory'
import type { FeedbackService } from '@/application/feedback'
import type { FeedService } from '@/application/feed'
import type { LiveService } from '@/application/live'
import type { SettingsService } from '@/application/settings'
import type { SpacesService } from '@/application/spaces'
import type { TokensService } from '@/application/tokens'

export interface Services {
  spaces: SpacesService
  tokens: TokensService
  settings: SettingsService
  directory: DirectoryService
  live: LiveService
  feed: FeedService
  // Null without a Sentry DSN
  feedback: FeedbackService | null
  // The backend's base URL, shown to API token users
  apiUrl: string
  tasksUrl: string | null
  mailUrl: string | null
  driveUrlTemplate: string | null
  chatUrl: string | null
}

export const ServicesContext = createContext<Services | null>(null)

export function useServices(): Services {
  const services = use(ServicesContext)
  if (!services) throw new Error('useServices must be used inside Services')
  return services
}
