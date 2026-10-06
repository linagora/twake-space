import { afterEach, describe, expect, it, vi } from 'vitest'

import { backend } from '@/adapters/http/backend'
import { httpSpaces } from '@/adapters/http/httpSpaces'

vi.mock('@linagora/twake-oidc', () => ({
  addAuthorization: vi.fn(),
  redirectOnUnauthorized: vi.fn()
}))

const fetchMock = vi.fn<typeof fetch>()
vi.stubGlobal('fetch', fetchMock)

const spaces = httpSpaces(backend('https://api.test/'))

function requested(): Request {
  const [request] = fetchMock.mock.calls[0] ?? []
  if (!(request instanceof Request)) throw new Error('no request sent')
  return request
}

afterEach(() => {
  fetchMock.mockReset()
})

describe('httpSpaces', () => {
  it("lists the caller's spaces", async () => {
    fetchMock.mockResolvedValue(
      Response.json({ spaces: [{ id: 'a1', name: 'Roadmap', role: 'admin' }] })
    )

    await expect(spaces.list()).resolves.toEqual([
      { id: 'a1', name: 'Roadmap', role: 'admin' }
    ])
    expect(requested().url).toBe('https://api.test/spaces')
  })

  it('reads one space', async () => {
    const space = {
      id: 'a1',
      name: 'Roadmap',
      role: 'admin',
      chat: false,
      mail: true,
      resources: [{ kind: 'tasks', id: null }]
    }
    fetchMock.mockResolvedValue(Response.json(space))

    await expect(spaces.get('a1')).resolves.toEqual(space)
    expect(requested().url).toBe('https://api.test/spaces/a1')
  })

  it('creates a space by name', async () => {
    let sent: unknown
    fetchMock.mockImplementation(async request => {
      if (!(request instanceof Request)) throw new Error('not a Request')
      sent = await request.clone().json()
      return Response.json(
        { id: 'b2', name: 'Launch', role: 'admin' },
        { status: 201 }
      )
    })

    await expect(spaces.create('Launch')).resolves.toEqual({
      id: 'b2',
      name: 'Launch',
      role: 'admin'
    })
    expect(requested().method).toBe('POST')
    expect(sent).toEqual({ name: 'Launch' })
  })

  it('rejects with the status and the reason of a refusal', async () => {
    fetchMock.mockResolvedValue(
      Response.json({ error: 'needs_an_account' }, { status: 403 })
    )

    await expect(spaces.create('Launch')).rejects.toMatchObject({
      status: 403,
      code: 'needs_an_account'
    })
  })
})
