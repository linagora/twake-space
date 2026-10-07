import { useColorScheme } from '@linagora/twake-mui'
import { act, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { fakeSettings } from '@/testing/fakeSettings'
import { renderWithProviders } from '@/testing/renderWithProviders'
import { useI18n } from '@/ui/i18n/useI18n'

function Shown() {
  const { t } = useI18n()
  const { mode } = useColorScheme()
  return (
    <p>
      {t('app.name')} in {mode}
    </p>
  )
}

describe('FollowCommonSettings', () => {
  it('speaks the language set in Twake Workplace', async () => {
    renderWithProviders(<Shown />, {
      settings: fakeSettings({ language: 'fr' })
    })

    await waitFor(() => {
      expect(document.documentElement.lang).toBe('fr')
    })
  })

  it('rereads the settings when the tab comes back into focus', async () => {
    const settings = fakeSettings({ language: 'de' })
    renderWithProviders(<Shown />, { settings })
    await waitFor(() => {
      expect(document.documentElement.lang).toBe('de')
    })

    settings.set({ language: 'fr' })
    act(() => {
      window.dispatchEvent(new Event('visibilitychange'))
    })

    await waitFor(() => {
      expect(document.documentElement.lang).toBe('fr')
    })
  })

  it('keeps the language it had when Twake Workplace sets one it lacks', async () => {
    renderWithProviders(<Shown />, {
      lang: 'de',
      settings: fakeSettings({ language: 'ja' })
    })

    await screen.findByText(/Twake Space in/)
    expect(document.documentElement.lang).toBe('de')
  })

  it('takes the theme set in Twake Workplace', async () => {
    renderWithProviders(<Shown />, {
      settings: fakeSettings({ theme: 'dark' })
    })

    expect(await screen.findByText('Twake Space in dark')).toBeInTheDocument()
  })

  it('follows the system when Twake Workplace sets auto or nothing', async () => {
    renderWithProviders(<Shown />, {
      settings: fakeSettings({ theme: 'auto' })
    })

    expect(await screen.findByText('Twake Space in system')).toBeInTheDocument()
  })

  it('keeps the last theme when the settings cannot be read', async () => {
    const { unmount } = renderWithProviders(<Shown />, {
      settings: fakeSettings({ theme: 'dark' })
    })
    await screen.findByText('Twake Space in dark')
    unmount()

    renderWithProviders(<Shown />, {
      settings: { get: () => Promise.reject(new Error('down')) }
    })

    expect(await screen.findByText('Twake Space in dark')).toBeInTheDocument()
  })
})
