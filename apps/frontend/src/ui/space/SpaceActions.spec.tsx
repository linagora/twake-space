import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { Route, Routes, useLocation } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import type { Space } from '@/application/spaces'
import { fakeSpaces } from '@/testing/fakeSpaces'
import { renderWithProviders } from '@/testing/renderWithProviders'
import { SpaceActions } from '@/ui/space/SpaceActions'

const space: Space = {
  id: 'a1',
  name: 'Roadmap',
  role: 'admin',
  createdAt: '2026-10-01T08:00:00.000Z',
  color: null,
  description: '',
  apps: [],
  chat: false,
  mail: false,
  homeserverUrl: null,
  members: [],
  groups: [],
  resources: []
}

function Path() {
  return <output aria-label="path">{useLocation().pathname}</output>
}

function renderActions(target: Space, spaces = fakeSpaces()) {
  renderWithProviders(
    <>
      <Routes>
        <Route path="/spaces/a1" element={<SpaceActions space={target} />} />
        <Route
          path="/spaces/a1/members"
          element={<SpaceActions space={target} />}
        />
        <Route path="/" element={null} />
      </Routes>
      <Path />
    </>,
    { spaces, path: '/spaces/a1' }
  )
  return spaces
}

const openMenu = async () => {
  fireEvent.click(
    await screen.findByRole('button', { name: 'More actions for Roadmap' })
  )
  return within(await screen.findByRole('menu'))
}

describe('SpaceActions', () => {
  it('lets a member who is not an admin share the link and see the members', async () => {
    renderActions({ ...space, role: 'editor' })

    expect(
      await screen.findByRole('button', { name: 'Share link' })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Invite people' })
    ).not.toBeInTheDocument()
    const menu = await openMenu()
    expect(menu.getAllByRole('menuitem').map(item => item.textContent)).toEqual(
      ['Share link', 'Members']
    )
    fireEvent.click(menu.getByRole('menuitem', { name: 'Members' }))

    await waitFor(() => {
      expect(screen.getByLabelText('path')).toHaveTextContent(
        '/spaces/a1/members'
      )
    })
  })

  it('copies the link of the space and says so', async () => {
    const writeText = vi.fn(() => Promise.resolve())
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true
    })
    renderActions(space)

    fireEvent.click(await screen.findByRole('button', { name: 'Share link' }))

    expect(await screen.findByText('Link copied')).toBeInTheDocument()
    expect(writeText).toHaveBeenCalledWith(
      `${window.location.origin}/spaces/a1`
    )
  })

  it('invites people from the header', async () => {
    renderActions(space)

    fireEvent.click(
      await screen.findByRole('button', { name: 'Invite people' })
    )

    expect(
      await screen.findByRole('dialog', { name: 'Add people' })
    ).toBeInTheDocument()
  })

  it('edits the name of the space', async () => {
    const spaces = renderActions(space)

    const menu = await openMenu()
    expect(menu.getAllByRole('menuitem').map(item => item.textContent)).toEqual(
      [
        'Share link',
        'Invite people',
        'Manage people',
        'Edit space',
        'Delete space'
      ]
    )
    fireEvent.click(menu.getByRole('menuitem', { name: 'Edit space' }))
    const dialog = await screen.findByRole('dialog', { name: 'Edit space' })
    const name = within(dialog).getByLabelText('Space name')
    expect(name).toHaveValue('Roadmap')
    fireEvent.change(name, { target: { value: ' Plans ' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(spaces.rename).toHaveBeenCalledWith('a1', 'Plans')
    })
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('deletes the space after confirming, and goes to the space list', async () => {
    const spaces = renderActions(space)

    const menu = await openMenu()
    fireEvent.click(menu.getByRole('menuitem', { name: 'Delete space' }))
    const dialog = await screen.findByRole('dialog', {
      name: 'Delete Roadmap?'
    })
    expect(spaces.remove).not.toHaveBeenCalled()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))

    await waitFor(() => {
      expect(screen.getByLabelText('path')).toHaveTextContent(/^\/$/)
    })
    expect(spaces.remove).toHaveBeenCalledWith('a1')
  })

  it('shows why an edit was refused', async () => {
    const spaces = fakeSpaces()
    vi.mocked(spaces.rename).mockRejectedValue(
      Object.assign(new Error('refused'), {
        status: 403,
        code: 'not_space_admin'
      })
    )
    renderActions(space, spaces)

    const menu = await openMenu()
    fireEvent.click(menu.getByRole('menuitem', { name: 'Edit space' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))

    expect(
      await within(dialog).findByText(
        'The change was refused (not_space_admin).'
      )
    ).toBeInTheDocument()
  })
})
