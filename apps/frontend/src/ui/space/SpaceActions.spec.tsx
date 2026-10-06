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
        <Route path="/" element={null} />
      </Routes>
      <Path />
    </>,
    { spaces, path: '/spaces/a1' }
  )
  return spaces
}

describe('SpaceActions', () => {
  it('shows nothing to a member who is not an admin', async () => {
    renderActions({ ...space, role: 'editor' })

    await screen.findByLabelText('path')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('renames the space', async () => {
    const spaces = renderActions(space)

    fireEvent.click(
      await screen.findByRole('button', { name: 'Rename the space' })
    )
    const dialog = await screen.findByRole('dialog', {
      name: 'Rename the space'
    })
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

    fireEvent.click(
      await screen.findByRole('button', { name: 'Delete the space' })
    )
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

  it('shows why a rename was refused', async () => {
    const spaces = fakeSpaces()
    vi.mocked(spaces.rename).mockRejectedValue(
      Object.assign(new Error('refused'), {
        status: 403,
        code: 'not_space_admin'
      })
    )
    renderActions(space, spaces)

    fireEvent.click(
      await screen.findByRole('button', { name: 'Rename the space' })
    )
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))

    expect(
      await within(dialog).findByText(
        'The change was refused (not_space_admin).'
      )
    ).toBeInTheDocument()
  })
})
