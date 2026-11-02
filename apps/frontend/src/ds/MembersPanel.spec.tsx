import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { MembersPanel } from '@/ds/MembersPanel'
import { stubPhoneScreen } from '@/testing/phoneScreen'
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

  it('names a member in full in a tooltip, within reach of the keyboard', async () => {
    renderPanel()
    const alice = await screen.findByRole('listitem', { name: 'Alice Martin' })
    expect(alice).toHaveAttribute('tabindex', '0')

    fireEvent.mouseOver(alice)

    expect(await screen.findByRole('tooltip')).toHaveTextContent('Alice Martin')
  })

  it('is one stop of the keyboard, moved through with the arrows, Home and End', async () => {
    renderPanel({
      members: [
        'Alice Martin',
        'Bob Durand',
        'Carol Petit',
        'Dave Moreau',
        'Eve Roux'
      ].map((name, index) => ({ id: `u${String(index)}`, name }))
    })
    const item = (name: string) => screen.getByRole('listitem', { name })
    const alice = await screen.findByRole('listitem', { name: 'Alice Martin' })
    expect(alice).toHaveAttribute('tabindex', '0')
    expect(item('Bob Durand')).toHaveAttribute('tabindex', '-1')

    alice.focus()
    fireEvent.keyDown(alice, { key: 'ArrowRight' })
    expect(item('Bob Durand')).toHaveFocus()
    expect(item('Bob Durand')).toHaveAttribute('tabindex', '0')
    expect(alice).toHaveAttribute('tabindex', '-1')

    fireEvent.keyDown(item('Bob Durand'), { key: 'ArrowDown' })
    expect(item('Eve Roux')).toHaveFocus()
    fireEvent.keyDown(item('Eve Roux'), { key: 'Home' })
    expect(alice).toHaveFocus()
    fireEvent.keyDown(alice, { key: 'End' })
    expect(item('Eve Roux')).toHaveFocus()
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

  it('takes the whole height of a phone, and closes on a tap beside it', async () => {
    stubPhoneScreen()
    try {
      const onClose = vi.fn()
      renderPanel({ onClose })
      const panel = await screen.findByRole('complementary', {
        name: 'Space members'
      })
      const drawer = panel.closest('.MuiDrawer-root')
      expect(drawer).not.toBe(null)
      expect(
        screen.getByRole('dialog', { name: 'Space members' })
      ).toContainElement(panel)

      const backdrop = drawer?.querySelector('.MuiBackdrop-root')
      expect(backdrop).not.toBe(null)
      if (backdrop) fireEvent.click(backdrop)
      expect(onClose).toHaveBeenCalledTimes(1)

      fireEvent.keyDown(panel, { key: 'Escape' })
      expect(onClose).toHaveBeenCalledTimes(2)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('stays beside the feed on a wide screen', async () => {
    renderPanel()
    const panel = await screen.findByRole('complementary', {
      name: 'Space members'
    })
    expect(panel.closest('.MuiDrawer-root')).toBe(null)
  })
})
