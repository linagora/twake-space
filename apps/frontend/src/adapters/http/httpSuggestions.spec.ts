import { afterEach, describe, expect, it, vi } from 'vitest'

import { backend } from '@/adapters/http/backend'
import { httpSuggestions } from '@/adapters/http/httpSuggestions'

vi.mock('@linagora/twake-oidc', () => ({
  addAuthorization: vi.fn(),
  redirectOnUnauthorized: vi.fn()
}))

const fetchMock = vi.fn<typeof fetch>()
vi.stubGlobal('fetch', fetchMock)

afterEach(() => {
  fetchMock.mockReset()
})

const suggestion = (
  id: string,
  read = false,
  type = 'assistant_suggestion'
) => ({
  id,
  type,
  read,
  payload: { text: `text ${id}`, pendingCallId: `pc-${id}` }
})

describe('httpSuggestions', () => {
  it('lists the unread suggestions, oldest first', async () => {
    fetchMock.mockResolvedValue(
      Response.json({
        notifications: [
          suggestion('c'),
          suggestion('b', true),
          suggestion('a', false, 'invitation'),
          suggestion('d')
        ],
        unread: 3
      })
    )

    await expect(
      httpSuggestions(backend('https://api.test/')).list()
    ).resolves.toEqual([
      { id: 'd', text: 'text d', pendingCallId: 'pc-d' },
      { id: 'c', text: 'text c', pendingCallId: 'pc-c' }
    ])
  })

  it('marks one as read', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))

    await httpSuggestions(backend('https://api.test/')).markRead('n-1')

    const [request] = fetchMock.mock.calls[0] ?? []
    expect(request instanceof Request && request.method).toBe('POST')
    expect(request instanceof Request && request.url).toBe(
      'https://api.test/notifications/n-1/read'
    )
  })
})
