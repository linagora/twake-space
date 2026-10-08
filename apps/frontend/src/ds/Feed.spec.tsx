import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { FeedFilterMenu, FeedLayout, ReactionPicker } from '@/ds/Feed'
import { renderWithProviders } from '@/testing/renderWithProviders'

const options = [
  { value: 'all', label: 'All' },
  { value: 'files', label: 'Files' }
]

describe('FeedFilterMenu', () => {
  it('offers the options as one choice, with the current one checked', async () => {
    renderWithProviders(
      <FeedFilterMenu
        label="Filter by"
        options={options}
        value="files"
        onChange={vi.fn()}
      />
    )
    fireEvent.click(await screen.findByRole('button', { name: 'Filter by' }))

    expect(
      screen.getByRole('menuitemradio', { name: 'Files' })
    ).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('menuitemradio', { name: 'All' })).toHaveAttribute(
      'aria-checked',
      'false'
    )
  })

  it('reports the option picked and closes', async () => {
    const onChange = vi.fn()
    renderWithProviders(
      <FeedFilterMenu
        label="Filter by"
        options={options}
        value="all"
        onChange={onChange}
      />
    )
    fireEvent.click(await screen.findByRole('button', { name: 'Filter by' }))
    fireEvent.click(await screen.findByRole('menuitemradio', { name: 'Files' }))

    expect(onChange).toHaveBeenCalledWith('files')
    expect(screen.queryByRole('menu')).toBe(null)
  })
})

describe('FeedLayout', () => {
  it('puts the toolbar in the list instead of a row above it', async () => {
    renderWithProviders(
      <FeedLayout
        toolbar={<button type="button">Toolbar</button>}
        composer={null}
        placeKey="all"
        latestLabel="Latest"
      >
        <article aria-label="First" />
      </FeedLayout>
    )

    const toolbar = await screen.findByRole('button', { name: 'Toolbar' })
    const list = screen.getByRole('article', { name: 'First' })
    expect(toolbar.parentElement?.parentElement).toContainElement(list)
  })
})

describe('ReactionPicker', () => {
  it('names its button with a tooltip, and picks an emoji', async () => {
    const onPick = vi.fn()
    renderWithProviders(
      <ReactionPicker
        label="Add a reaction"
        emojis={['👍', '🎉']}
        onPick={onPick}
      />
    )
    const button = await screen.findByRole('button', { name: 'Add a reaction' })

    fireEvent.mouseOver(button)
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'Add a reaction'
    )

    fireEvent.click(button)
    fireEvent.click(await screen.findByRole('menuitem', { name: '🎉' }))
    expect(onPick).toHaveBeenCalledWith('🎉')
  })
})
