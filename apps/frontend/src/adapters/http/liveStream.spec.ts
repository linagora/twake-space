import { afterEach, describe, expect, it, vi } from 'vitest'

import { backend } from '@/adapters/http/backend'
import { liveStream } from '@/adapters/http/liveStream'

vi.mock('@linagora/twake-oidc', () => ({
  addAuthorization: vi.fn(),
  redirectOnUnauthorized: vi.fn()
}))

const fetchMock = vi.fn<typeof fetch>()
vi.stubGlobal('fetch', fetchMock)

const live = liveStream(backend('https://api.test/'), 1)

function stream(...chunks: string[]): Response {
  const encoder = new TextEncoder()
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
        controller.close()
      }
    }),
    { headers: { 'content-type': 'text/event-stream' } }
  )
}

function handlers() {
  return { onEvent: vi.fn(), onReconnect: vi.fn() }
}

afterEach(() => {
  fetchMock.mockReset()
})

describe('liveStream', () => {
  it('passes each event with its data, across chunks', async () => {
    fetchMock.mockResolvedValueOnce(
      stream(
        ': open\n\nevent: spaces\ndata: {"spa',
        'ceId":"a1"}\n\n: heartbeat\n\nevent: notification\ndata: {"id":7}\n\n'
      )
    )
    fetchMock.mockReturnValue(new Promise(() => undefined))
    const on = handlers()

    const stop = live.subscribe(on)

    await vi.waitFor(() => {
      expect(on.onEvent).toHaveBeenCalledTimes(2)
    })
    expect(on.onEvent).toHaveBeenNthCalledWith(1, 'spaces', { spaceId: 'a1' })
    expect(on.onEvent).toHaveBeenNthCalledWith(2, 'notification', { id: 7 })
    const [request] = fetchMock.mock.calls[0] ?? []
    expect(request instanceof Request && request.url).toBe(
      'https://api.test/stream'
    )
    stop()
  })

  it('opens the stream again when it closes, and says so', async () => {
    fetchMock
      .mockResolvedValueOnce(stream(': open\n\n'))
      .mockResolvedValueOnce(stream('event: spaces\ndata: {}\n\n'))
      .mockReturnValue(new Promise(() => undefined))
    const on = handlers()

    const stop = live.subscribe(on)

    await vi.waitFor(() => {
      expect(on.onEvent).toHaveBeenCalledWith('spaces', {})
    })
    expect(on.onReconnect).toHaveBeenCalledTimes(1)
    stop()
  })

  it('tries again after a failure', async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError('network down'))
      .mockResolvedValueOnce(stream('event: spaces\ndata: {}\n\n'))
      .mockReturnValue(new Promise(() => undefined))
    const on = handlers()

    const stop = live.subscribe(on)

    await vi.waitFor(() => {
      expect(on.onEvent).toHaveBeenCalledWith('spaces', {})
    })
    stop()
  })

  it('keeps quiet about a cut it recovers from', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const cut = new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(': open\n\n'))
          controller.error(new TypeError('network error'))
        }
      })
    )
    fetchMock
      .mockResolvedValueOnce(cut)
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(stream('event: spaces\ndata: {}\n\n'))
      .mockReturnValue(new Promise(() => undefined))
    const on = handlers()

    const stop = live.subscribe(on)

    await vi.waitFor(() => {
      expect(on.onEvent).toHaveBeenCalledWith('spaces', {})
    })
    expect(warn).not.toHaveBeenCalled()
    stop()
  })

  it('warns once reconnecting keeps failing', async () => {
    const attempts: number[] = []
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {
      attempts.push(fetchMock.mock.calls.length)
    })
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    const stop = live.subscribe(handlers())

    await vi.waitFor(() => {
      expect(warn).toHaveBeenCalledWith(
        'Live updates interrupted:',
        expect.any(TypeError)
      )
    })
    stop()
    expect(attempts[0]).toBe(3)
  })

  it('stops for good once unsubscribed', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(stream(': open\n\n')))
    const on = handlers()

    const stop = live.subscribe(on)
    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalled()
    })
    stop()
    const calls = fetchMock.mock.calls.length
    await new Promise(resolve => setTimeout(resolve, 20))

    expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(calls + 1)
    expect(on.onEvent).not.toHaveBeenCalled()
  })
})
