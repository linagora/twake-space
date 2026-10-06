import type { KyInstance } from 'ky'

import type { CommonSettings, SettingsService } from '@/application/settings'

export function httpSettings(api: KyInstance): SettingsService {
  return {
    get: () => api.get('settings').json<CommonSettings>()
  }
}
