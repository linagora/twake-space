import {
  NO_SETTINGS,
  type CommonSettings,
  type SettingsService
} from '@/application/settings'

export function fakeSettings(
  initial: Partial<CommonSettings> = {}
): SettingsService & { set: (changes: Partial<CommonSettings>) => void } {
  let settings = { ...NO_SETTINGS, ...initial }
  return {
    get: () => Promise.resolve(settings),
    set: changes => {
      settings = { ...settings, ...changes }
    }
  }
}
