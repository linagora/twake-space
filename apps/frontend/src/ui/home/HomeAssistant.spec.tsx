import { act, fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi, type MockInstance } from 'vitest'

import type { FeedItem } from '@/application/feed'
import type { SpaceSummary } from '@/application/spaces'
import { fakeFeed } from '@/testing/fakeFeed'
import { fakeSession, fakeUser } from '@/testing/fakeSession'
import { fakeSpaces } from '@/testing/fakeSpaces'
import { stubPhoneScreen } from '@/testing/phoneScreen'
import { renderRoute, renderWithProviders } from '@/testing/renderWithProviders'
import { HomeAssistant } from '@/ui/home/HomeAssistant'

vi.mock('@linagora/twake-sdk', () => ({
  createSdk: () => ({
    platformURL: 'https://alice.twake.test',
    status: 'ready',
    onStatusChange: () => () => undefined,
    stackClient: {
      fetchJSON: () =>
        Promise.resolve({
          data: {
            id: 'i1',
            attributes: {
              services: [{ href: 'https://assistant.test/intents/?intent=i1' }]
            }
          }
        })
    }
  })
}))

const ORIGIN = 'https://assistant.test'

const space = (id: string, name: string): SpaceSummary => ({
  id,
  name,
  role: 'editor',
  color: null,
  description: '',
  pinnedAt: null,
  openedAt: null,
  manages: false,
  members: []
})

const post = (id: string, body: string, time: string): FeedItem => ({
  id,
  kind: 'post',
  category: 'messages',
  time,
  updatedAt: time,
  reactions: [],
  author: { type: 'user', id: 'u-bob', name: 'Bob' },
  body,
  editedAt: null,
  poll: null,
  approval: null,
  announcement: null,
  feedback: null,
  form: null
})

const options = () => ({
  session: fakeSession(() => Promise.resolve(fakeUser('id-token'))),
  spaces: fakeSpaces([space('a1', 'Roadmap'), space('b2', 'Quiet')]),
  feed: fakeFeed(
    {
      a1: [
        post('p1', 'Seen already', '2026-10-05T09:00:00.000Z'),
        post('p2', 'Release on Friday', '2026-10-05T11:00:00.000Z')
      ],
      b2: [post('p3', 'Old news', '2026-10-05T09:00:00.000Z')]
    },
    {
      readAt: {
        a1: '2026-10-05T10:00:00.000Z',
        b2: '2026-10-05T10:00:00.000Z'
      },
      mentions: { a1: 1 }
    }
  )
})

async function readyFrame(
  timeout = 1000
): Promise<MockInstance<Window['postMessage']>> {
  const frame = await screen.findByTitle('Ask Twake AI', {}, { timeout })
  if (!(frame instanceof HTMLIFrameElement) || !frame.contentWindow) {
    throw new Error('no frame')
  }
  const postMessage = vi.spyOn(frame.contentWindow, 'postMessage')
  const source = frame.contentWindow
  act(() => {
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'intent-i1:ready' },
        origin: ORIGIN,
        source
      })
    )
  })
  return postMessage
}

describe('HomeAssistant', () => {
  it('gives the assistant what is new in the spaces, with a request to summarise it', async () => {
    renderWithProviders(<HomeAssistant onClose={vi.fn()} />, options())

    const postMessage = await readyFrame()

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        content: [
          '## Roadmap',
          'The user has 1 unread mention(s).',
          '- 2026-10-05T11:00:00.000Z Bob posted: Release on Friday'
        ].join('\n'),
        suggestions: [
          expect.objectContaining({
            message: 'Summarise what is new in my spaces since my last visit.'
          })
        ]
      }),
      ORIGIN
    )
  })

  it('opens without a text when the news cannot be read', async () => {
    const setup = options()
    vi.mocked(setup.feed.news).mockRejectedValue(new Error('down'))
    renderWithProviders(<HomeAssistant onClose={vi.fn()} />, setup)

    // After the query's retries
    const postMessage = await readyFrame(6000)

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ content: '', suggestions: [] }),
      ORIGIN
    )
  }, 10000)

  it('opens from the home', async () => {
    renderRoute('/', options())

    fireEvent.click(
      await screen.findByRole('button', { name: 'Summarise with Twake AI' })
    )

    expect(await screen.findByTitle('Ask Twake AI')).toBeInTheDocument()
  })

  it('opens from a shorter button on a phone', async () => {
    stubPhoneScreen()
    try {
      renderRoute('/', options())

      const button = await screen.findByRole('button', {
        name: 'Summarise with Twake AI'
      })
      expect(button).toHaveTextContent(/^Summarise$/)
      fireEvent.click(button)

      expect(await screen.findByTitle('Ask Twake AI')).toBeInTheDocument()
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
