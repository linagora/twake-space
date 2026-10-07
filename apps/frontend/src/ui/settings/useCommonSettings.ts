import { useQuery } from '@tanstack/react-query'

import { NO_SETTINGS, type CommonSettings } from '@/application/settings'
import { useServices } from '@/ui/services/Services'

export const SETTINGS = ['settings'] as const

// Until read, or when they cannot be, the app keeps its own defaults.
export function useCommonSettings(): {
  settings: CommonSettings
  isSuccess: boolean
} {
  const { settings } = useServices()
  const query = useQuery({
    queryKey: SETTINGS,
    queryFn: () => settings.get(),
    // People change them in another Twake Workplace app, then come back.
    refetchOnWindowFocus: true,
    select: withKnownTimeZone
  })
  return { settings: query.data ?? NO_SETTINGS, isSuccess: query.isSuccess }
}

function withKnownTimeZone(settings: CommonSettings): CommonSettings {
  if (!settings.timezone) return settings
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: settings.timezone })
    return settings
  } catch {
    return { ...settings, timezone: null }
  }
}
