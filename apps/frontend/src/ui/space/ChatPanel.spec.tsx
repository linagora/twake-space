import { act, screen } from '@testing-library/react'
import { Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'

import { renderWithProviders } from '@/testing/renderWithProviders'
import { ChatPanel } from '@/ui/space/ChatPanel'

const CHAT = 'https://chat.test'

function renderAt(chatUrl: string | null = `${CHAT}/`, active = true) {
  renderWithProviders(
    <>
      <button type="button">Space</button>
      <Routes>
        <Route
          path="/spaces/:spaceId/chat/*"
          element={
            <ChatPanel
              spaceId="a1"
              roomId="!space:matrix.test"
              active={active}
            />
          }
        />
      </Routes>
    </>,
    { path: '/spaces/a1/chat', chatUrl }
  )
}

function frame(): HTMLIFrameElement {
  const element = screen.getByTitle('Chat')
  if (!(element instanceof HTMLIFrameElement)) throw new Error('no frame')
  return element
}

function postFromFrame(data: unknown, origin = CHAT) {
  act(() => {
    window.dispatchEvent(
      new MessageEvent('message', {
        data,
        origin,
        source: frame().contentWindow
      })
    )
  })
}

const fullscreen = (value: boolean) => ({
  type: 'twake-embed:fullscreen',
  fullscreen: value
})

describe('ChatPanel', () => {
  it('frames the room of the space on the embed route of Chat', async () => {
    renderAt()
    const frame = await screen.findByTitle('Chat')
    expect(frame).toBeInstanceOf(HTMLIFrameElement)
    expect((frame as HTMLIFrameElement).src).toBe(
      'https://chat.test/embed/rooms/!space%3Amatrix.test'
    )
  })

  it('gives Chat the camera, the microphone and the screen for its calls', async () => {
    renderAt()
    expect(await screen.findByTitle('Chat')).toHaveAttribute(
      'allow',
      'clipboard-read; clipboard-write; camera; microphone; display-capture'
    )
  })

  it('covers the page while Chat asks for it, the rest out of reach', async () => {
    renderAt()
    await screen.findByTitle('Chat')
    const space = screen.getByRole('button', { name: 'Space' })

    postFromFrame(fullscreen(true))
    expect(getComputedStyle(frame()).position).toBe('fixed')
    expect(space.inert).toBe(true)

    postFromFrame(fullscreen(false))
    expect(getComputedStyle(frame()).position).not.toBe('fixed')
    expect(space.inert).toBe(false)
  })

  it('ignores a full page asked from another origin', async () => {
    renderAt()
    await screen.findByTitle('Chat')

    postFromFrame(fullscreen(true), 'https://evil.test')
    expect(getComputedStyle(frame()).position).not.toBe('fixed')
  })

  it('never covers the page from a hidden tab', async () => {
    renderAt(`${CHAT}/`, false)
    await screen.findByTitle('Chat')

    postFromFrame(fullscreen(true))
    expect(getComputedStyle(frame()).position).not.toBe('fixed')
    expect(screen.getByRole('button', { name: 'Space' }).inert).not.toBe(true)
  })

  it('says when Chat is not set up', async () => {
    renderAt(null)
    expect(
      await screen.findByText('Chat is not set up for TwakeSpace.')
    ).toBeTruthy()
  })
})
