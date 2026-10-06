import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { Space } from '@/application/spaces'
import { fakeDirectory } from '@/testing/fakeDirectory'
import { fakeSpaces } from '@/testing/fakeSpaces'
import { renderWithProviders } from '@/testing/renderWithProviders'
import { MembersPanel } from '@/ui/space/MembersPanel'

const space: Space = {
  id: 'a1',
  name: 'Roadmap',
  role: 'viewer',
  chat: false,
  mail: false,
  homeserverUrl: null,
  members: [
    {
      id: 'u-1',
      username: 'carol',
      email: 'carol@acme.test',
      displayName: 'Carol DANVERS',
      role: 'admin'
    },
    {
      id: 'u-2',
      username: 'alice',
      email: 'alice@acme.test',
      displayName: null,
      role: 'editor'
    }
  ],
  groups: [{ id: 'g-1', name: 'Designers', role: 'viewer' }],
  resources: []
}

const admin: Space = { ...space, role: 'admin' }

describe('MembersPanel', () => {
  it('lists the direct members with their roles', async () => {
    renderWithProviders(<MembersPanel space={space} />)

    const list = await screen.findByRole('list', { name: 'Members' })
    const items = within(list).getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent('Carol DANVERS')
    expect(items[0]).toHaveTextContent('carol@acme.test')
    expect(items[0]).toHaveTextContent('Admin')
    expect(items[1]).toHaveTextContent('Editor')
  })

  it('names a member without a display name by their username', async () => {
    renderWithProviders(<MembersPanel space={space} />)

    const list = await screen.findByRole('list', { name: 'Members' })
    expect(within(list).getAllByRole('listitem')[1]).toHaveTextContent('alice')
  })

  it('lists the linked groups with their roles', async () => {
    renderWithProviders(<MembersPanel space={space} />)

    const list = await screen.findByRole('list', { name: 'Groups' })
    expect(within(list).getByRole('listitem')).toHaveTextContent('Designers')
    expect(within(list).getByRole('listitem')).toHaveTextContent('Viewer')
  })

  it('shows a viewer no actions', async () => {
    renderWithProviders(<MembersPanel space={space} />)

    await screen.findByRole('list', { name: 'Members' })
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it("lets an admin change a member's or a group's role", async () => {
    const spaces = fakeSpaces()
    renderWithProviders(<MembersPanel space={admin} />, { spaces })

    fireEvent.change(await screen.findByLabelText('Role of alice'), {
      target: { value: 'viewer' }
    })
    fireEvent.change(screen.getByLabelText('Role of Designers'), {
      target: { value: 'admin' }
    })

    await waitFor(() => {
      expect(spaces.setMemberRole).toHaveBeenCalledWith('a1', 'u-2', 'viewer')
    })
    await waitFor(() => {
      expect(spaces.setGroupRole).toHaveBeenCalledWith('a1', 'g-1', 'admin')
    })
  })

  it('lets an admin remove a member and unlink a group', async () => {
    const spaces = fakeSpaces()
    renderWithProviders(<MembersPanel space={admin} />, { spaces })

    fireEvent.click(await screen.findByRole('button', { name: 'Remove alice' }))
    fireEvent.click(screen.getByRole('button', { name: 'Unlink Designers' }))

    await waitFor(() => {
      expect(spaces.removeMember).toHaveBeenCalledWith('a1', 'u-2')
    })
    await waitFor(() => {
      expect(spaces.unlinkGroup).toHaveBeenCalledWith('a1', 'g-1')
    })
  })

  it('lets an admin add people from the organization with a role', async () => {
    const spaces = fakeSpaces()
    const directory = fakeDirectory([
      { username: 'alice', email: 'alice@acme.test', displayName: 'Alice' },
      { username: 'bob', email: 'bob@acme.test', displayName: 'Bob' }
    ])
    renderWithProviders(<MembersPanel space={admin} />, { spaces, directory })

    fireEvent.click(await screen.findByRole('button', { name: 'Add people' }))
    const dialog = await screen.findByRole('dialog', { name: 'Add people' })
    expect(within(dialog).queryByLabelText('Alice')).not.toBeInTheDocument()
    fireEvent.click(await within(dialog).findByLabelText('Bob'))
    fireEvent.change(within(dialog).getByLabelText('Role'), {
      target: { value: 'editor' }
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add' }))

    await waitFor(() => {
      expect(spaces.addMembers).toHaveBeenCalledWith('a1', ['bob'], 'editor')
    })
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('lets an admin link organization groups with a role', async () => {
    const spaces = fakeSpaces()
    const directory = fakeDirectory(
      [],
      [
        { id: 'g-1', name: 'Designers' },
        { id: 'g-2', name: 'Sales' }
      ]
    )
    renderWithProviders(<MembersPanel space={admin} />, { spaces, directory })

    fireEvent.click(await screen.findByRole('button', { name: 'Link groups' }))
    const dialog = await screen.findByRole('dialog', { name: 'Link groups' })
    fireEvent.click(await within(dialog).findByLabelText('Sales'))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add' }))

    await waitFor(() => {
      expect(spaces.linkGroups).toHaveBeenCalledWith('a1', ['g-2'], 'viewer')
    })
  })

  it('searches the organization as the admin types', async () => {
    const directory = fakeDirectory()
    renderWithProviders(<MembersPanel space={admin} />, { directory })

    fireEvent.click(await screen.findByRole('button', { name: 'Add people' }))
    fireEvent.change(await screen.findByLabelText('Search'), {
      target: { value: 'bo' }
    })

    await waitFor(() => {
      expect(directory.people).toHaveBeenLastCalledWith('bo', 1)
    })
  })

  it('says when a search matches no one', async () => {
    renderWithProviders(<MembersPanel space={admin} />, {
      directory: fakeDirectory()
    })

    fireEvent.click(await screen.findByRole('button', { name: 'Add people' }))
    fireEvent.change(await screen.findByLabelText('Search'), {
      target: { value: 'zzzz' }
    })

    expect(await screen.findByText('No one matches.')).toBeInTheDocument()
  })

  it('says when a search matches no group', async () => {
    renderWithProviders(<MembersPanel space={admin} />, {
      directory: fakeDirectory()
    })

    fireEvent.click(await screen.findByRole('button', { name: 'Link groups' }))
    fireEvent.change(await screen.findByLabelText('Search'), {
      target: { value: 'zzzz' }
    })

    expect(await screen.findByText('No group matches.')).toBeInTheDocument()
  })

  it('does not say no one matches while searching', async () => {
    const directory = fakeDirectory()
    vi.mocked(directory.people).mockReturnValue(new Promise(() => undefined))
    renderWithProviders(<MembersPanel space={admin} />, { directory })

    fireEvent.click(await screen.findByRole('button', { name: 'Add people' }))
    await screen.findByRole('dialog', { name: 'Add people' })

    expect(screen.queryByText('No one matches.')).not.toBeInTheDocument()
  })

  it('shows why a write was refused', async () => {
    const spaces = fakeSpaces()
    vi.mocked(spaces.removeMember).mockRejectedValue(
      Object.assign(new Error('refused'), { status: 409, code: 'last_admin' })
    )
    renderWithProviders(<MembersPanel space={admin} />, { spaces })

    fireEvent.click(
      await screen.findByRole('button', { name: 'Remove Carol DANVERS' })
    )

    expect(
      await screen.findByText('The change was refused (last_admin).')
    ).toBeInTheDocument()
  })

  it('says when there are no direct members or no linked groups', async () => {
    renderWithProviders(
      <MembersPanel space={{ ...space, members: [], groups: [] }} />
    )

    expect(await screen.findByText('No direct members.')).toBeInTheDocument()
    expect(screen.getByText('No linked groups.')).toBeInTheDocument()
  })
})
