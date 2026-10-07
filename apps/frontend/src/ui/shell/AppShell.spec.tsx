import type { TwakeBarProps } from '@linagora/twake-bar'
import { fireEvent, screen, within } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { fakeSession, fakeUser } from '@/testing/fakeSession'
import { fakeSpaces } from '@/testing/fakeSpaces'
import { renderRoute } from '@/testing/renderWithProviders'

const createSdk = vi.hoisted(() => vi.fn(() => ({ status: 'ready' })))
vi.mock('@linagora/twake-sdk', () => ({ createSdk }))

// The bar is tested in its own package: only its wiring matters here
vi.mock('@linagora/twake-bar', () => ({
  TWAKE_BAR_HEIGHT: '3rem',
  SdkProvider: ({ children }: { children: ReactNode }): ReactNode => children,
  TwakeBar: ({ app, onLogOut }: TwakeBarProps): ReactElement => (
    <header role="banner">
      {app.name}
      <button onClick={onLogOut}>Log out</button>
    </header>
  )
}))

const spaces = () =>
  fakeSpaces([
    {
      id: 'space-1',
      name: 'Design',
      role: 'admin',
      color: null,
      description: '',
      members: []
    },
    {
      id: 'space-2',
      name: 'Launch',
      role: 'viewer',
      color: null,
      description: '',
      members: []
    }
  ])

describe('AppShell', () => {
  it.each(['/', '/spaces/space-1'])(
    'shows the platform bar and signs out from it on %s',
    async path => {
      const session = fakeSession(() => Promise.resolve(fakeUser('id-token')))
      renderRoute(path, { session, spaces: spaces() })

      const bar = within(await screen.findByRole('banner'))
      expect(bar.getByText('Twake Space')).toBeInTheDocument()
      expect(createSdk).toHaveBeenCalledWith({
        platformURL: 'https://alice.twake.test',
        idToken: 'id-token'
      })
      fireEvent.click(bar.getByRole('button', { name: 'Log out' }))

      expect(session.signOut).toHaveBeenCalled()
    }
  )

  it('shows no platform bar when the SSO did not name the platform', async () => {
    renderRoute('/', { spaces: spaces() })

    await screen.findByRole('navigation')
    expect(screen.queryByRole('banner')).toBe(null)
    expect(createSdk).not.toHaveBeenCalled()
  })

  it('lists the spaces in the sidebar and marks the current one', async () => {
    renderRoute('/spaces/space-2/feed', { spaces: spaces() })

    const list = within(
      await screen.findByRole('list', { name: 'Your spaces' })
    )
    const launch = await list.findByRole('link', { name: 'Launch' })
    expect(launch).toHaveAttribute('href', '/spaces/space-2')
    expect(launch).toHaveAttribute('aria-current', 'page')
    expect(list.getByRole('link', { name: 'Design' })).not.toHaveAttribute(
      'aria-current'
    )
  })

  it('links home from the navigation', async () => {
    renderRoute('/', { spaces: spaces() })

    const nav = within(await screen.findByRole('navigation'))
    expect(
      nav.getByRole('link', { name: 'All shared spaces' })
    ).toHaveAttribute('aria-current', 'page')
  })

  it('follows the UI language', async () => {
    renderRoute('/', { lang: 'fr', spaces: spaces() })

    expect(
      await screen.findByRole('list', { name: 'Vos espaces' })
    ).toBeInTheDocument()
  })
})
