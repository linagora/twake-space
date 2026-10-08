import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { MembersPanel } from '@/ds/MembersPanel'
import { renderWithProviders } from '@/testing/renderWithProviders'

const members = [
  { id: 'u1', name: 'Alice Martin' },
  { id: 'u2', name: 'Bob Durand' }
]

function renderPanel(props: Partial<Parameters<typeof MembersPanel>[0]> = {}) {
  renderWithProviders(
    <MembersPanel
      title="Space members"
      count="2 members"
      searchLabel="Search by name"
      noneLabel="No member found."
      members={members}
      addLabel="Add member"
      closeLabel="Hide the members"
      onClose={vi.fn()}
      {...props}
    />
  )
}

describe('MembersPanel', () => {
  it('lists the members by first name', async () => {
    renderPanel()

    expect(await screen.findByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
    expect(screen.getByText('2 members')).toBeInTheDocument()
  })

  it('keeps the members whose name has what is typed', async () => {
    renderPanel()
    fireEvent.change(
      await screen.findByRole('textbox', { name: 'Search by name' }),
      {
        target: { value: 'dur' }
      }
    )

    expect(screen.queryByText('Alice')).toBe(null)
    expect(screen.getByText('Bob')).toBeInTheDocument()

    fireEvent.change(screen.getByRole('textbox', { name: 'Search by name' }), {
      target: { value: 'zzz' }
    })
    expect(screen.getByText('No member found.')).toBeInTheDocument()
  })

  it('offers to add a member only when it can', async () => {
    const onAdd = vi.fn()
    renderPanel({ onAdd })
    fireEvent.click(await screen.findByRole('button', { name: 'Add member' }))
    expect(onAdd).toHaveBeenCalledTimes(1)
  })

  it('has no add button without the right to add', async () => {
    renderPanel()
    await screen.findByText('Alice')
    expect(screen.queryByRole('button', { name: 'Add member' })).toBe(null)
  })

  it('closes', async () => {
    const onClose = vi.fn()
    renderPanel({ onClose })
    fireEvent.click(
      await screen.findByRole('button', { name: 'Hide the members' })
    )
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
