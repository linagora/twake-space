import { afterEach, describe, expect, it, vi } from 'vitest'

import { httpTaskSearch } from '@/adapters/http/httpTaskSearch'

vi.mock('@linagora/twake-oidc', () => ({
  getAccessToken: () => 'access-1'
}))

const fetchMock = vi.fn<typeof fetch>()
vi.stubGlobal('fetch', fetchMock)

afterEach(() => {
  fetchMock.mockReset()
})

describe('httpTaskSearch', () => {
  it('searches Twake Tasks with the access token', async () => {
    const found = {
      key: 'DES-1',
      title: 'New logo',
      boardId: 'b1',
      boardName: 'Design',
      projectId: 'p1'
    }
    fetchMock.mockResolvedValue(Response.json({ tasks: [found] }))

    const tasks = await httpTaskSearch('https://tasks.test/').search('logo')

    const [request] = fetchMock.mock.calls[0] ?? []
    if (!(request instanceof Request)) throw new Error('no request')
    expect(request.url).toBe('https://tasks.test/api/search?q=logo')
    expect(request.headers.get('Authorization')).toBe('Bearer access-1')
    expect(tasks).toEqual([found])
  })
})
