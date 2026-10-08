import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { SpaceSummary } from '@/application/spaces'
import { fakeSpaces } from '@/testing/fakeSpaces'
import { renderRoute } from '@/testing/renderWithProviders'

const space = (
  id: string,
  name: string,
  openedAt: string | null
): SpaceSummary => ({
  id,
  name,
  role: 'viewer',
  color: null,
  description: '',
  pinnedAt: null,
  openedAt,
  members: []
})

const spaces = () =>
  fakeSpaces([
    space('space-1', 'Design', '2026-10-01T08:00:00.000Z'),
    space('space-2', 'Launch', '2026-10-02T08:00:00.000Z'),
    space('space-3', 'Handover', null)
  ])

const pressCtrlK = () => {
  fireEvent.keyDown(document.activeElement ?? document, {
    key: 'k',
    ctrlKey: true
  })
}

describe('SpotSpace', () => {
  // jsdom lays nothing out, so it has no scrollIntoView
  const scrollIntoView = vi.fn()
  beforeEach(() => {
    Element.prototype.scrollIntoView = scrollIntoView
  })

  it('lists the spaces, the last opened first, and opens one with Enter', async () => {
    const { router } = renderRoute('/', { spaces: spaces() })
    await screen.findAllByRole('link', { name: 'Launch' })

    pressCtrlK()

    const dialog = screen.getByRole('dialog', { name: 'SpotSpace' })
    const field = within(dialog).getByRole('combobox', { name: 'SpotSpace' })
    expect(field).toHaveFocus()
    expect(within(dialog).getAllByRole('option')).toEqual(
      ['Launch', 'Design', 'Handover'].map(name =>
        within(dialog).getByRole('option', { name })
      )
    )

    fireEvent.keyDown(field, { key: 'ArrowDown' })
    expect(
      within(dialog).getByRole('option', { name: 'Design' })
    ).toHaveAttribute('aria-selected', 'true')
    fireEvent.keyDown(field, { key: 'Enter' })

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/spaces/space-1')
    })
    expect(screen.queryByRole('dialog', { name: 'SpotSpace' })).toBe(null)
  })

  it('filters the spaces by name and opens one with a click', async () => {
    const { router } = renderRoute('/', { spaces: spaces() })
    await screen.findAllByRole('link', { name: 'Launch' })
    pressCtrlK()
    const dialog = screen.getByRole('dialog', { name: 'SpotSpace' })

    fireEvent.change(within(dialog).getByRole('combobox'), {
      target: { value: 'hand' }
    })
    expect(within(dialog).getAllByRole('option')).toHaveLength(1)
    fireEvent.click(within(dialog).getByRole('option', { name: 'Handover' }))

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/spaces/space-3')
    })
  })

  it('says when no space matches, and closes on Ctrl+K again', async () => {
    renderRoute('/', { spaces: spaces() })
    await screen.findAllByRole('link', { name: 'Launch' })
    pressCtrlK()
    const dialog = screen.getByRole('dialog', { name: 'SpotSpace' })

    fireEvent.change(within(dialog).getByRole('combobox'), {
      target: { value: 'nothing' }
    })
    expect(within(dialog).getByText('No space found')).toBeInTheDocument()

    pressCtrlK()
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'SpotSpace' })).toBe(null)
    })

    pressCtrlK()
    const reopened = screen.getByRole('dialog', { name: 'SpotSpace' })
    expect(within(reopened).getByRole('combobox')).toHaveValue('')
    expect(
      within(reopened).getByRole('option', { name: 'Launch' })
    ).toHaveAttribute('aria-selected', 'true')
  })

  it('goes from the first space to the last with ArrowUp, in view', async () => {
    renderRoute('/', { spaces: spaces() })
    await screen.findAllByRole('link', { name: 'Launch' })
    pressCtrlK()
    const dialog = screen.getByRole('dialog', { name: 'SpotSpace' })
    scrollIntoView.mockClear()

    fireEvent.keyDown(within(dialog).getByRole('combobox'), { key: 'ArrowUp' })

    expect(
      within(dialog).getByRole('option', { name: 'Handover' })
    ).toHaveAttribute('aria-selected', 'true')
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' })
  })

  it('does not open over another dialog', async () => {
    renderRoute('/', { spaces: spaces() })
    await screen.findAllByRole('link', { name: 'Launch' })
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Create a space' })[0] as Element
    )
    await screen.findByRole('dialog')

    pressCtrlK()

    expect(screen.queryByRole('dialog', { name: 'SpotSpace' })).toBe(null)
  })
})
