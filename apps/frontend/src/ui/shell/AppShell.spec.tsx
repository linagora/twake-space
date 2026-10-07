import type { TwakeBarProps } from '@linagora/twake-bar'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

import type { Space } from '@/application/spaces'
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

const detail = (id: string, name: string, mailbox: string): Space => ({
  id,
  name,
  role: 'admin',
  createdAt: '2026-01-01T00:00:00.000Z',
  color: null,
  description: '',
  apps: ['tasks', 'mail'],
  chat: true,
  mail: true,
  homeserverUrl: null,
  members: [],
  groups: [],
  resources: [
    { kind: 'project', id: `project-${id}` },
    { kind: 'mailbox', id: mailbox }
  ]
})

function postFromFrame(title: string, origin: string, data: unknown) {
  const element = screen.getByTitle(title)
  if (!(element instanceof HTMLIFrameElement)) throw new Error('no frame')
  act(() => {
    window.dispatchEvent(
      new MessageEvent('message', {
        data,
        origin,
        source: element.contentWindow
      })
    )
  })
}

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

  describe('counts of the apps', () => {
    function renderWithCounts() {
      const service = spaces()
      vi.mocked(service.get).mockImplementation(id =>
        Promise.resolve(
          id === 'space-1'
            ? detail('space-1', 'Design', 'design@acme')
            : detail('space-2', 'Launch', 'launch@acme')
        )
      )
      renderRoute('/spaces/space-1/feed', { spaces: service })
      return service
    }

    it('adds up, per space, the counts of its resources across the apps', async () => {
      renderWithCounts()
      await screen.findByRole('link', { name: 'Design' })
      await screen.findByTitle('Tasks')

      // An app's snapshot covers every space the user has
      await waitFor(() => {
        postFromFrame('Mail', 'https://mail.test', {
          type: 'twake-embed:badges',
          badges: [
            { resourceId: 'design@acme', count: 3 },
            { resourceId: 'launch@acme', count: 120 }
          ]
        })
        postFromFrame('Tasks', 'https://tasks.test', {
          type: 'twake-embed:badges',
          badges: [
            { resourceId: 'project-space-1', count: 2 },
            { resourceId: 'unknown', count: 50 }
          ]
        })
        expect(
          screen.getByRole('link', { name: 'Design, 5 new' })
        ).toBeInTheDocument()
      })
      const list = within(screen.getByRole('list', { name: 'Your spaces' }))
      expect(list.getByText('5')).toBeInTheDocument()
      expect(
        list.getByRole('link', { name: 'Launch, 120 new' })
      ).toBeInTheDocument()
      expect(list.getByText('99+')).toBeInTheDocument()
    })

    it('shows no total for a space the apps reported nothing for', async () => {
      renderWithCounts()
      await screen.findByRole('link', { name: 'Design' })
      await screen.findByTitle('Mail')

      await waitFor(() => {
        postFromFrame('Mail', 'https://mail.test', {
          type: 'twake-embed:badges',
          badges: [
            { resourceId: 'design@acme', count: 3 },
            { resourceId: 'launch@acme', count: 0 }
          ]
        })
        expect(
          screen.getByRole('link', { name: 'Design, 3 new' })
        ).toBeInTheDocument()
      })
      expect(screen.getByRole('link', { name: 'Launch' })).toBeInTheDocument()
    })

    it('reads no space in full until an app reports', async () => {
      const service = renderWithCounts()
      await screen.findByRole('link', { name: 'Design' })

      expect(service.get).not.toHaveBeenCalledWith('space-2')
    })
  })
})
