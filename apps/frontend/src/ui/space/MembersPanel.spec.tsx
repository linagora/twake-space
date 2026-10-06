import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { Space } from '@/application/spaces'
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
    { id: 'u-1', username: 'carol', email: 'carol@acme.test', role: 'admin' },
    { id: 'u-2', username: 'alice', email: 'alice@acme.test', role: 'editor' }
  ],
  groups: [{ id: 'g-1', name: 'Designers', role: 'viewer' }],
  resources: []
}

describe('MembersPanel', () => {
  it('lists the direct members with their roles', async () => {
    renderWithProviders(<MembersPanel space={space} />)

    const list = await screen.findByRole('list', { name: 'Members' })
    const items = within(list).getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent('carol')
    expect(items[0]).toHaveTextContent('carol@acme.test')
    expect(items[0]).toHaveTextContent('Admin')
    expect(items[1]).toHaveTextContent('Editor')
  })

  it('lists the linked groups with their roles', async () => {
    renderWithProviders(<MembersPanel space={space} />)

    const list = await screen.findByRole('list', { name: 'Groups' })
    expect(within(list).getByRole('listitem')).toHaveTextContent('Designers')
    expect(within(list).getByRole('listitem')).toHaveTextContent('Viewer')
  })

  it('says when there are no direct members or no linked groups', async () => {
    renderWithProviders(
      <MembersPanel space={{ ...space, members: [], groups: [] }} />
    )

    expect(await screen.findByText('No direct members.')).toBeInTheDocument()
    expect(screen.getByText('No linked groups.')).toBeInTheDocument()
  })
})
