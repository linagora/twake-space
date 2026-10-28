import { fireEvent, screen } from '@testing-library/react'
import { useState, type ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  AnnouncementColors,
  FeedComposer,
  FeedFilterMenu,
  FeedLayout,
  FeedMoreButton,
  ReactionPicker
} from '@/ds/Feed'
import { stubTouchScreen } from '@/testing/phoneScreen'
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

describe('AnnouncementColors', () => {
  it('lets clicks through its hidden colour input to the swatch under it', async () => {
    const { container } = renderWithProviders(
      <AnnouncementColors
        value="#ff0000"
        labels={{ none: 'No banner', custom: 'Custom', color: hex => hex }}
        onChange={vi.fn()}
      />
    )
    await screen.findByRole('radio', { name: 'No banner' })
    const input = container.querySelector('input[type="color"]')
    if (!(input instanceof HTMLInputElement)) throw new Error('no input')

    expect(getComputedStyle(input).pointerEvents).toBe('none')
    expect(getComputedStyle(input).padding).toBe('0px')
    expect(getComputedStyle(input).borderTopWidth).toBe('0px')
  })
})

describe('FeedMoreButton', () => {
  it('leaves room for its 16px icon', async () => {
    renderWithProviders(<FeedMoreButton label="More" onClick={vi.fn()} />)
    const style = getComputedStyle(
      await screen.findByRole('button', { name: 'More' })
    )

    const room =
      parseFloat(style.width) -
      parseFloat(style.paddingLeft) -
      parseFloat(style.paddingRight)
    expect(room).toBeGreaterThanOrEqual(16)
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

function Composer({ onSend }: { onSend: () => void }): ReactElement {
  const [value, setValue] = useState('')
  return (
    <FeedComposer
      label="Text message"
      sendLabel="Send"
      emojiLabel="Add an emoji"
      emojis={['😍', '🎉']}
      people={[
        { id: 'u1', name: 'Alice Martin', email: 'alice@x.org', avatar: null },
        { id: 'u2', name: 'Bob Leroy', email: 'bleroy@x.org', avatar: null }
      ]}
      peopleLabel="Mention a member"
      value={value}
      onChange={setValue}
      onSend={onSend}
      disabled={false}
    />
  )
}

describe('FeedComposer', () => {
  it('puts the emoji picked after the text', async () => {
    renderWithProviders(<Composer onSend={vi.fn()} />)
    const field = await screen.findByRole('textbox', { name: 'Text message' })
    fireEvent.change(field, { target: { value: 'Well done ' } })

    fireEvent.click(screen.getByRole('button', { name: 'Add an emoji' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: '🎉' }))

    expect(field).toHaveValue('Well done 🎉')
  })

  it('sends only when there is something to send', async () => {
    const onSend = vi.fn()
    renderWithProviders(<Composer onSend={onSend} />)
    const send = await screen.findByRole('button', { name: 'Send' })
    expect(send).toBeDisabled()

    fireEvent.change(screen.getByRole('textbox', { name: 'Text message' }), {
      target: { value: 'Hi' }
    })
    fireEvent.click(send)

    expect(onSend).toHaveBeenCalledTimes(1)
  })

  it('offers the members after an "@" and puts the one picked by keyboard', async () => {
    const onSend = vi.fn()
    renderWithProviders(<Composer onSend={onSend} />)
    const field = await screen.findByRole('textbox', { name: 'Text message' })
    fireEvent.change(field, { target: { value: 'Thanks @' } })
    fireEvent.select(field)

    const list = await screen.findByRole('listbox', {
      name: 'Mention a member'
    })
    expect(list).toHaveTextContent('Alice Martin')
    expect(list).toHaveTextContent('Bob Leroy')

    fireEvent.keyDown(field, { key: 'ArrowDown' })
    fireEvent.keyDown(field, { key: 'Enter' })

    expect(field).toHaveValue('Thanks @Bob Leroy ')
    expect(onSend).not.toHaveBeenCalled()
  })

  it('narrows the members to the name typed and closes on Escape', async () => {
    renderWithProviders(<Composer onSend={vi.fn()} />)
    const field = await screen.findByRole('textbox', { name: 'Text message' })
    fireEvent.change(field, { target: { value: '@ali' } })
    fireEvent.select(field)

    const options = await screen.findAllByRole('option')
    expect(options.map(option => option.textContent)).toEqual([
      'AMAlice Martinalice@x.org'
    ])

    fireEvent.keyDown(field, { key: 'Escape' })
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('matches the members on their email local part, not its domain', async () => {
    renderWithProviders(<Composer onSend={vi.fn()} />)
    const field = await screen.findByRole('textbox', { name: 'Text message' })
    fireEvent.change(field, { target: { value: '@x' } })
    fireEvent.select(field)

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()

    fireEvent.change(field, { target: { value: '@bler' } })
    fireEvent.select(field)
    const options = await screen.findAllByRole('option')
    expect(options).toHaveLength(1)
    expect(options[0]).toHaveTextContent('Bob Leroy')
  })

  it('sends on Enter once the caret leaves the "@"', async () => {
    const onSend = vi.fn()
    renderWithProviders(<Composer onSend={onSend} />)
    const field = await screen.findByRole('textbox', { name: 'Text message' })
    fireEvent.change(field, { target: { value: 'see @bo' } })
    fireEvent.select(field)
    expect(await screen.findByRole('listbox')).toBeInTheDocument()

    ;(field as HTMLTextAreaElement).setSelectionRange(0, 0)
    fireEvent.select(field)
    fireEvent.keyDown(field, { key: 'Enter' })

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(onSend).toHaveBeenCalledTimes(1)
  })

  it('labels Return as send with a mouse', async () => {
    renderWithProviders(<Composer onSend={vi.fn()} />)
    const field = await screen.findByRole('textbox', { name: 'Text message' })

    expect(field).toHaveAttribute('enterkeyhint', 'send')
  })

  it('keeps Enter for the word an input method is composing', async () => {
    const onSend = vi.fn()
    renderWithProviders(<Composer onSend={onSend} />)
    const field = await screen.findByRole('textbox', { name: 'Text message' })
    fireEvent.change(field, { target: { value: 'にほん' } })
    fireEvent.keyDown(field, { key: 'Enter', isComposing: true })

    expect(onSend).not.toHaveBeenCalled()
  })

  it('keeps the Enter that commits a word in Safari', async () => {
    const onSend = vi.fn()
    renderWithProviders(<Composer onSend={onSend} />)
    const field = await screen.findByRole('textbox', { name: 'Text message' })
    fireEvent.change(field, { target: { value: 'にほん' } })
    fireEvent.keyDown(field, { key: 'Enter', keyCode: 229 })

    expect(onSend).not.toHaveBeenCalled()
  })

  describe('on a touch screen', () => {
    beforeEach(() => {
      stubTouchScreen()
    })
    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('leaves Return to break the line and sends with the button', async () => {
      const onSend = vi.fn()
      renderWithProviders(<Composer onSend={onSend} />)
      const field = await screen.findByRole('textbox', {
        name: 'Text message'
      })
      fireEvent.change(field, { target: { value: 'Hello team' } })
      const enter = fireEvent.keyDown(field, { key: 'Enter' })

      expect(enter).toBe(true)
      expect(field).toHaveAttribute('enterkeyhint', 'enter')
      expect(onSend).not.toHaveBeenCalled()

      fireEvent.click(screen.getByRole('button', { name: 'Send' }))
      expect(onSend).toHaveBeenCalledTimes(1)
    })
  })
})
