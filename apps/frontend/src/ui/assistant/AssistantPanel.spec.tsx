import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ASSISTANT_INTENT } from '@/application/assistant'
import { fakeFeed } from '@/testing/fakeFeed'
import { fakeSession, fakeUser } from '@/testing/fakeSession'
import { renderWithProviders } from '@/testing/renderWithProviders'
import { AssistantPanel } from '@/ui/assistant/AssistantPanel'

const { createIntent } = vi.hoisted(() => ({
  createIntent: vi.fn(() =>
    Promise.resolve({
      id: 'i1',
      action: 'OPEN',
      type: 'io.cozy.ai.chat.conversations',
      services: [
        { slug: 'assistant', href: 'https://assistant.test/intents/?intent=i1' }
      ]
    })
  )
}))

vi.mock('@linagora/twake-sdk', () => ({
  createSdk: () => ({
    platformURL: 'https://alice.twake.test',
    status: 'ready',
    onStatusChange: () => () => undefined,
    createIntent
  })
}))

const ORIGIN = 'https://assistant.test'

function renderPanel(idToken: string | null = 'id-token') {
  const feed = fakeFeed()
  const onClose = vi.fn()
  renderWithProviders(<AssistantPanel spaceId="a1" onClose={onClose} />, {
    session: fakeSession(() => Promise.resolve(fakeUser(idToken))),
    feed
  })
  return { feed, onClose }
}

async function findFrame(): Promise<HTMLIFrameElement> {
  const frame = await screen.findByTitle('Ask Twake AI')
  if (!(frame instanceof HTMLIFrameElement)) throw new Error('no frame')
  return frame
}

function receive(data: unknown, origin = ORIGIN): void {
  act(() => {
    window.dispatchEvent(new MessageEvent('message', { data, origin }))
  })
}

describe('AssistantPanel', () => {
  it('frames the assistant intent and configures it when it is ready', async () => {
    renderPanel()

    const frame = await findFrame()
    expect(createIntent).toHaveBeenCalledWith(ASSISTANT_INTENT)
    expect(frame).toHaveAttribute(
      'src',
      'https://assistant.test/intents/?intent=i1'
    )
    const inside = frame.contentWindow
    if (!inside) throw new Error('no frame window')
    const postMessage = vi.spyOn(inside, 'postMessage')

    receive({ type: 'intent-i1:ready' }, 'https://elsewhere.test')
    expect(postMessage).not.toHaveBeenCalled()
    receive({ type: 'intent-i1:ready' })

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        answerActions: [{ name: 'post', label: 'Post in the feed' }]
      }),
      ORIGIN
    )
  })

  it('posts the answer the user picks in the feed of the space', async () => {
    const { feed } = renderPanel()
    await findFrame()

    receive({
      type: 'intent-i1:result',
      result: { answerAction: 'post', text: 'Hello all', format: 'markdown' }
    })

    await waitFor(() => {
      expect(feed.post).toHaveBeenCalledWith('a1', 'Hello all')
    })
  })

  it('says when the answer could not be posted', async () => {
    const { feed } = renderPanel()
    vi.mocked(feed.post).mockRejectedValue(new Error('cannot_post'))
    await findFrame()

    receive({
      type: 'intent-i1:result',
      result: { answerAction: 'post', text: 'Hello all', format: 'markdown' }
    })

    expect(
      await screen.findByText('The answer could not be posted.')
    ).toBeInTheDocument()
  })

  it('closes, and starts a new conversation on a new intent', async () => {
    const { onClose } = renderPanel()
    await findFrame()
    const intents = createIntent.mock.calls.length

    fireEvent.click(screen.getByRole('button', { name: 'New conversation' }))
    await waitFor(() => {
      expect(createIntent.mock.calls.length).toBeGreaterThan(intents)
    })

    fireEvent.click(screen.getByRole('button', { name: 'Close the assistant' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('says when the user has no platform', async () => {
    renderPanel(null)

    expect(
      await screen.findByText('The assistant is not set up for TwakeSpace.')
    ).toBeInTheDocument()
    expect(createIntent).not.toHaveBeenCalled()
  })
})
