import { act, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { fakeLive } from '@/testing/fakeLive'
import { fakeSettings } from '@/testing/fakeSettings'
import { fakeSpaces } from '@/testing/fakeSpaces'
import { renderWithProviders } from '@/testing/renderWithProviders'
import { HomeScreen } from '@/ui/home/HomeScreen'
import { useLiveUpdates } from '@/ui/live/useLiveUpdates'

const launch = { name: 'Launch', description: '', color: null, apps: [] }

function Home() {
  useLiveUpdates()
  return <HomeScreen />
}

describe('useLiveUpdates', () => {
  it('refreshes the spaces when one of them changes', async () => {
    const live = fakeLive()
    const spaces = fakeSpaces([
      {
        id: 'a1',
        name: 'Roadmap',
        role: 'viewer',
        color: null,
        description: '',
        members: []
      }
    ])
    renderWithProviders(<Home />, { spaces, live })
    await screen.findByRole('link', { name: 'Roadmap' })

    await spaces.create(launch)
    act(() => {
      live.emit('spaces', { spaceId: 'space-2' })
    })

    expect(
      await screen.findByRole('link', { name: 'Launch' })
    ).toBeInTheDocument()
  })

  it('rereads the settings when they change in Twake Workplace', async () => {
    const live = fakeLive()
    const settings = fakeSettings()
    renderWithProviders(<Home />, { live, settings })
    await screen.findByText('Create your first space')

    settings.set({ language: 'fr' })
    act(() => {
      live.emit('settings', {})
    })

    await waitFor(() => {
      expect(document.documentElement.lang).toBe('fr')
    })
  })

  it('refreshes everything after the stream reopened', async () => {
    const live = fakeLive()
    const spaces = fakeSpaces()
    renderWithProviders(<Home />, { spaces, live })
    await screen.findByText('Create your first space')

    await spaces.create(launch)
    act(() => {
      live.reconnect()
    })

    expect(
      await screen.findByRole('link', { name: 'Launch' })
    ).toBeInTheDocument()
  })

  it('closes the stream when unmounted', async () => {
    const live = fakeLive()
    const { unmount } = renderWithProviders(<Home />, { live })
    await screen.findByText('Create your first space')

    unmount()

    expect(live.subscribers()).toBe(0)
  })
})
