import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ASSISTANT_READY_TIMEOUT } from '@/application/assistant'
import type { Space } from '@/application/spaces'
import { fakeFeed } from '@/testing/fakeFeed'
import { fakeSession, fakeUser } from '@/testing/fakeSession'
import { fakeSpaces } from '@/testing/fakeSpaces'
import { renderWithProviders } from '@/testing/renderWithProviders'
import { AssistantPanel } from '@/ui/assistant/AssistantPanel'

const { fetchJSON, sdk } = vi.hoisted(() => ({
  sdk: {
    status: 'ready',
    listeners: new Set<() => void>()
  },
  fetchJSON: vi.fn(() =>
    Promise.resolve({
      data: {
        id: 'i1',
        attributes: {
          services: [
            {
              slug: 'assistant',
              href: 'https://assistant.test/intents/?intent=i1'
            }
          ]
        }
      }
    })
  )
}))

vi.mock('@linagora/twake-sdk', () => ({
  createSdk: () => ({
    platformURL: 'https://alice.twake.test',
    get status() {
      return sdk.status
    },
    onStatusChange: (listener: () => void) => {
      sdk.listeners.add(listener)
      return () => sdk.listeners.delete(listener)
    },
    stackClient: { fetchJSON }
  })
}))

afterEach(() => {
  sdk.status = 'ready'
})

const ORIGIN = 'https://assistant.test'

function renderPanel(
  idToken: string | null = 'id-token',
  role: Space['role'] = 'editor'
) {
  const feed = fakeFeed()
  const spaces = fakeSpaces()
  vi.mocked(spaces.get).mockResolvedValue({
    id: 'a1',
    name: 'Roadmap',
    role,
    createdAt: '2026-01-01T00:00:00.000Z',
    color: null,
    description: '',
    pinnedAt: null,
    openedAt: null,
    manages: role === 'admin',
    apps: [],
    chat: false,
    mail: false,
    homeserverUrl: null,
    chatUrl: null,
    banner: null,
    members: [],
    groups: [],
    resources: []
  })
  const onClose = vi.fn()
  renderWithProviders(<AssistantPanel spaceId="a1" onClose={onClose} />, {
    session: fakeSession(() => Promise.resolve(fakeUser(idToken))),
    feed,
    spaces
  })
  return { feed, onClose, spaces }
}

async function findFrame(): Promise<HTMLIFrameElement> {
  const frame = await screen.findByTitle('Ask Twake AI')
  if (!(frame instanceof HTMLIFrameElement)) throw new Error('no frame')
  return frame
}

function receive(data: unknown, origin = ORIGIN, source = frameWindow()): void {
  act(() => {
    window.dispatchEvent(new MessageEvent('message', { data, origin, source }))
  })
}

function frameWindow(): Window | null {
  const frame = screen.queryByTitle('Ask Twake AI')
  return frame instanceof HTMLIFrameElement ? frame.contentWindow : null
}

describe('AssistantPanel', () => {
  it('frames the assistant intent and configures it when it is ready', async () => {
    renderPanel()

    const frame = await findFrame()
    expect(document.querySelectorAll('iframe')).toHaveLength(1)
    expect(fetchJSON).toHaveBeenCalledWith('POST', '/intents', {
      data: expect.objectContaining({
        attributes: expect.objectContaining({
          action: 'OPEN',
          type: 'io.cozy.ai.chat.conversations'
        }) as unknown
      }) as unknown
    })
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

  it('configures the assistant when the platform gets ready after the panel opens', async () => {
    sdk.status = 'waiting'
    const { spaces } = renderPanel()
    // The space, so the configuration, settles before the platform
    await waitFor(() => {
      expect(spaces.get).toHaveBeenCalled()
    })
    await act(() => new Promise(resolve => setTimeout(resolve, 50)))

    act(() => {
      sdk.status = 'ready'
      sdk.listeners.forEach(listener => {
        listener()
      })
    })
    const frame = await findFrame()
    const inside = frame.contentWindow
    if (!inside) throw new Error('no frame window')
    const postMessage = vi.spyOn(inside, 'postMessage')
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

    receive({ type: 'intent-i1:ready' })
    receive({
      type: 'intent-i1:result',
      result: { answerAction: 'post', text: 'Hello all', format: 'markdown' }
    })

    await waitFor(() => {
      expect(feed.post).toHaveBeenCalledExactlyOnceWith('a1', 'Hello all', [])
    })
    expect(await screen.findByText('Posted in the feed')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open the feed' })).toHaveAttribute(
      'href',
      '/spaces/a1/feed'
    )
  })

  it('offers no post in the feed to a viewer', async () => {
    renderPanel('id-token', 'viewer')
    const frame = await findFrame()
    const inside = frame.contentWindow
    if (!inside) throw new Error('no frame window')
    const postMessage = vi.spyOn(inside, 'postMessage')

    // Once the space, and so the role, is loaded
    await waitFor(() => {
      receive({ type: 'intent-i1:ready' })
      expect(postMessage).toHaveBeenLastCalledWith(
        expect.objectContaining({ answerActions: [] }),
        ORIGIN
      )
    })
  })

  it('logs a result of the assistant it does not understand', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { feed } = renderPanel()
    await findFrame()

    receive({ type: 'intent-i1:ready' })
    receive({ type: 'intent-i1:result', result: { text: 'Hello all' } })

    // Not the answer, which would reach Sentry
    expect(warn).toHaveBeenCalledWith('Assistant result ignored')
    expect(feed.post).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it('says when the answer could not be posted', async () => {
    const { feed } = renderPanel()
    vi.mocked(feed.post).mockRejectedValue(new Error('cannot_post'))
    await findFrame()

    receive({ type: 'intent-i1:ready' })
    receive({
      type: 'intent-i1:result',
      result: { answerAction: 'post', text: 'Hello all', format: 'markdown' }
    })

    expect(
      await screen.findByText('The answer could not be posted.')
    ).toBeInTheDocument()
  })

  it('closes when the user closes the scribe', async () => {
    const { onClose } = renderPanel()
    await findFrame()

    receive({ type: 'intent-i1:ready' })
    receive({ type: 'intent-i1:cancel' }, 'https://elsewhere.test')
    expect(onClose).not.toHaveBeenCalled()
    receive({ type: 'intent-i1:cancel' })

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled()
    })
  })

  it('says when the assistant never gets ready', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      renderPanel()
      await findFrame()

      await act(() => vi.advanceTimersByTimeAsync(ASSISTANT_READY_TIMEOUT))

      expect(
        await screen.findByText('The assistant could not be opened.')
      ).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
      error.mockRestore()
    }
  })

  it('says when the user has no platform', async () => {
    renderPanel(null)

    expect(
      await screen.findByText('The assistant is not set up for TwakeSpace.')
    ).toBeInTheDocument()
    expect(fetchJSON).not.toHaveBeenCalled()
  })

  it('closes without the assistant, from its button or Escape', async () => {
    const { onClose } = renderPanel(null)
    await screen.findByText('The assistant is not set up for TwakeSpace.')

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)

    fireEvent.keyDown(screen.getByRole('button', { name: 'Close' }), {
      key: 'Escape'
    })
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('closes when the assistant could not be opened', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    // Strict mode creates it twice
    fetchJSON
      .mockRejectedValueOnce(new Error('no service'))
      .mockRejectedValueOnce(new Error('no service'))
    const { onClose } = renderPanel()
    await screen.findByText('The assistant could not be opened.')

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(onClose).toHaveBeenCalled()
    error.mockRestore()
  })
})
