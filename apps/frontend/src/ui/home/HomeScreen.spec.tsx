import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { renderWithProviders } from '@/testing/renderWithProviders'
import { HomeScreen } from '@/ui/home/HomeScreen'

describe('HomeScreen', () => {
  it('shows the app name as the main heading and page title', () => {
    renderWithProviders(<HomeScreen />)

    expect(
      screen.getByRole('heading', { level: 1, name: 'Twake Space' })
    ).toBeInTheDocument()
    expect(screen.getByRole('main')).toBeInTheDocument()
    expect(document.title).toBe('Twake Space')
  })

  it('follows the UI language', () => {
    renderWithProviders(<HomeScreen />, { lang: 'fr' })

    expect(document.documentElement.lang).toBe('fr')
  })
})
