import { fireEvent, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { fakeSession } from '@/testing/fakeSession'
import { fakeSettings } from '@/testing/fakeSettings'
import { fakeSpaces } from '@/testing/fakeSpaces'
import { renderRoute } from '@/testing/renderWithProviders'

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
    'names the signed-in user and signs out from the account menu on %s',
    async path => {
      const session = fakeSession()
      renderRoute(path, { session, spaces: spaces() })

      const header = within(await screen.findByRole('banner'))
      fireEvent.click(header.getByRole('button', { name: 'Alice Martin' }))
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Sign out' }))

      expect(session.signOut).toHaveBeenCalled()
    }
  )

  it('shows the name and picture set in Twake Workplace', async () => {
    renderRoute('/', {
      spaces: spaces(),
      settings: fakeSettings({
        displayName: 'Alice M.',
        avatar: 'https://alice.example.com/public/avatar?v=2'
      })
    })

    const button = await within(await screen.findByRole('banner')).findByRole(
      'button',
      { name: 'Alice M.' }
    )
    expect(button.querySelector('img')).toHaveAttribute(
      'src',
      'https://alice.example.com/public/avatar?v=2'
    )
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
    fireEvent.click(
      within(screen.getByRole('banner')).getByRole('button', {
        name: 'Alice Martin'
      })
    )
    expect(
      await screen.findByRole('menuitem', { name: 'Se déconnecter' })
    ).toBeInTheDocument()
  })
})
