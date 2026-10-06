import { afterEach, describe, expect, it, vi } from 'vitest'

import { backend } from '@/adapters/http/backend'
import { httpDirectory } from '@/adapters/http/httpDirectory'

vi.mock('@linagora/twake-oidc', () => ({
  addAuthorization: vi.fn(),
  redirectOnUnauthorized: vi.fn()
}))

const fetchMock = vi.fn<typeof fetch>()
vi.stubGlobal('fetch', fetchMock)

const directory = httpDirectory(backend('https://api.test/'))

function requestedUrl(): string {
  const [request] = fetchMock.mock.calls[0] ?? []
  if (!(request instanceof Request)) throw new Error('no request sent')
  return request.url
}

afterEach(() => {
  fetchMock.mockReset()
})

describe('httpDirectory', () => {
  it("searches the organization's people by page", async () => {
    const bob = {
      username: 'bob',
      email: 'bob@acme.test',
      displayName: 'Bob Durand'
    }
    fetchMock.mockResolvedValue(
      Response.json({ members: [bob], hasNextPage: true })
    )

    await expect(directory.people('bo', 2)).resolves.toEqual({
      people: [bob],
      hasNextPage: true
    })
    expect(requestedUrl()).toBe(
      'https://api.test/organization/members?page=2&search=bo'
    )
  })

  it('lists every group without a search', async () => {
    const groups = [{ id: 'g-1', name: 'Designers' }]
    fetchMock.mockResolvedValue(Response.json({ groups, hasNextPage: false }))

    await expect(directory.groups('', 1)).resolves.toEqual({
      groups,
      hasNextPage: false
    })
    expect(requestedUrl()).toBe('https://api.test/organization/groups?page=1')
  })
})
