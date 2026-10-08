import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { Route, Routes, useLocation } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import type { Space } from '@/application/spaces'
import { fakeSpaces } from '@/testing/fakeSpaces'
import { renderWithProviders } from '@/testing/renderWithProviders'
import { SpaceSettingsScreen } from '@/ui/space/SpaceSettingsScreen'

const space: Space = {
  id: 'a1',
  name: 'Roadmap',
  role: 'admin',
  createdAt: '2026-10-01T08:00:00.000Z',
  color: null,
  description: 'Where the year is planned',
  apps: ['chat', 'drive'],
  chat: true,
  mail: true,
  homeserverUrl: null,
  banner: null,
  members: [
    {
      id: 'u-me',
      username: 'alice',
      email: 'alice@acme.test',
      displayName: 'Alice Martin',
      role: 'admin'
    },
    {
      id: 'u-bob',
      username: 'bob',
      email: 'bob@acme.test',
      displayName: 'Bob Dupont',
      role: 'editor'
    }
  ],
  groups: [{ id: 'g-design', name: 'Designers', role: 'viewer' }],
  resources: []
}

function Path() {
  return <output aria-label="path">{useLocation().pathname}</output>
}

function renderSettings(target: Space, spaces = fakeSpaces()) {
  vi.mocked(spaces.get).mockResolvedValue(target)
  renderWithProviders(
    <>
      <Routes>
        <Route
          path="/spaces/:spaceId/settings"
          element={<SpaceSettingsScreen />}
        />
        <Route path="/spaces/:spaceId" element={null} />
        <Route path="/" element={null} />
      </Routes>
      <Path />
    </>,
    { spaces, path: '/spaces/a1/settings' }
  )
  return spaces
}

describe('SpaceSettingsScreen', () => {
  it('shows the space, its members by role, and its apps', async () => {
    renderSettings(space)

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Roadmap' })
    ).toBeInTheDocument()
    expect(screen.getByText('Where the year is planned')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'All, 3' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Editor, 1' })).toBeInTheDocument()
    const members = within(screen.getByRole('list', { name: 'Members' }))
    expect(members.getByText('You')).toBeInTheDocument()
    expect(members.getByText('Bob Dupont')).toBeInTheDocument()
    expect(members.getByText('Designers')).toBeInTheDocument()
    expect(members.queryByLabelText('Role of Alice Martin')).toBe(null)

    fireEvent.click(screen.getByRole('tab', { name: 'Viewer, 1' }))
    expect(screen.queryByText('Bob Dupont')).toBe(null)
    expect(screen.getByText('Designers')).toBeInTheDocument()

    expect(await screen.findByText('3 of 6 enabled')).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Feed' })).toBeDisabled()
    expect(screen.getByRole('switch', { name: 'Chat' })).toBeChecked()
    expect(screen.getByRole('switch', { name: 'Mail' })).not.toBeChecked()
  })

  it('changes and removes members and groups', async () => {
    const spaces = renderSettings(space)

    fireEvent.click(
      await screen.findByRole('button', { name: 'Role of Bob Dupont' })
    )
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Admin' }))
    fireEvent.click(screen.getByRole('button', { name: 'Unlink Designers' }))

    await waitFor(() => {
      expect(spaces.setMemberRole).toHaveBeenCalledWith('a1', 'u-bob', 'admin')
    })
    expect(spaces.unlinkGroup).toHaveBeenCalledWith('a1', 'g-design')
  })

  it('turns an app on and off right away', async () => {
    const spaces = renderSettings(space)

    fireEvent.click(await screen.findByRole('switch', { name: 'Mail' }))
    await waitFor(() => {
      expect(spaces.edit).toHaveBeenCalledWith('a1', {
        apps: ['chat', 'drive', 'mail']
      })
    })

    fireEvent.click(screen.getByRole('switch', { name: 'Chat' }))
    await waitFor(() => {
      expect(spaces.edit).toHaveBeenCalledWith('a1', { apps: ['drive'] })
    })
  })

  it('opens the add members dialog', async () => {
    renderSettings(space)

    fireEvent.click(await screen.findByRole('button', { name: 'Add members' }))

    const dialog = await screen.findByRole('dialog', { name: 'Add members' })
    expect(
      within(dialog).getByRole('form', { name: 'Invite people' })
    ).toBeInTheDocument()
  })

  it('links to the API tokens from the danger zone', async () => {
    renderSettings(space)

    const zone = await screen.findByRole('region', { name: 'Danger zone' })
    expect(within(zone).getByRole('link', { name: 'Manage' })).toHaveAttribute(
      'href',
      '/settings/api-tokens?space=a1'
    )
  })

  it('deletes the space from the danger zone and goes home', async () => {
    const spaces = renderSettings(space)

    const zone = await screen.findByRole('region', { name: 'Danger zone' })
    fireEvent.click(within(zone).getByRole('button', { name: 'Delete' }))
    const dialog = await screen.findByRole('dialog', {
      name: 'Delete Roadmap?'
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))

    await waitFor(() => {
      expect(screen.getByLabelText('path')).toHaveTextContent(/^\/$/)
    })
    expect(spaces.remove).toHaveBeenCalledWith('a1')
  })

  it('keeps the page from members who are not admins', async () => {
    renderSettings({ ...space, role: 'editor' })

    expect(
      await screen.findByText('Only the admins of a space manage it.')
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back' })).toHaveAttribute(
      'href',
      '/spaces/a1'
    )
  })
})
