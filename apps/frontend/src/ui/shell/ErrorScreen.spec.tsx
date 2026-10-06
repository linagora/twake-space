import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { renderRoute } from '@/testing/renderWithProviders'

vi.mock('@/ui/home/HomeScreen', () => ({
  HomeScreen: () => {
    throw new Error('boom')
  }
}))

describe('ErrorScreen', () => {
  it('shows a not-found page in the shell for an unknown path', async () => {
    renderRoute('/nope')

    expect(
      await screen.findByRole('heading', { name: 'Page not found' })
    ).toBeInTheDocument()
    expect(screen.getByRole('navigation')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'All spaces' })).toHaveAttribute(
      'href',
      '/'
    )
  })

  it('shows an error page in the shell when a screen fails to render', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    renderRoute('/')

    expect(
      await screen.findByRole('heading', { name: 'Something went wrong' })
    ).toBeInTheDocument()
    expect(screen.getByRole('navigation')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'All spaces' })).toHaveAttribute(
      'href',
      '/'
    )
  })
})
