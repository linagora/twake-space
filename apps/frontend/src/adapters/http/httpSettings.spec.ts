import { afterEach, describe, expect, it, vi } from 'vitest'

import { backend } from '@/adapters/http/backend'
import { httpSettings } from '@/adapters/http/httpSettings'

vi.mock('@linagora/twake-oidc', () => ({
  addAuthorization: vi.fn(),
  redirectOnUnauthorized: vi.fn()
}))

const fetchMock = vi.fn<typeof fetch>()
vi.stubGlobal('fetch', fetchMock)

afterEach(() => {
  fetchMock.mockReset()
})

describe('httpSettings', () => {
  it("reads the caller's common settings", async () => {
    const settings = {
      language: 'fr',
      timezone: 'Europe/Paris',
      theme: 'dark',
      avatar: null,
      displayName: 'Alice Martin'
    }
    fetchMock.mockResolvedValue(Response.json(settings))

    await expect(
      httpSettings(backend('https://api.test/')).get()
    ).resolves.toEqual(settings)
    const [request] = fetchMock.mock.calls[0] ?? []
    expect(request instanceof Request && request.url).toBe(
      'https://api.test/settings'
    )
  })
})
