/** What the person set in Twake Workplace; null where they set nothing. */
export interface CommonSettings {
  language: string | null
  timezone: string | null
  theme: 'light' | 'dark' | 'auto' | null
  avatar: string | null
  displayName: string | null
}

export interface SettingsService {
  get: () => Promise<CommonSettings>
}

export const NO_SETTINGS: CommonSettings = {
  language: null,
  timezone: null,
  theme: null,
  avatar: null,
  displayName: null
}
