import { afterEach, describe, expect, it, vi } from 'vitest'

import { backend } from '@/adapters/http/backend'
import { httpTokens } from '@/adapters/http/httpTokens'

vi.mock('@linagora/twake-oidc', () => ({
  addAuthorization: vi.fn(),
  redirectOnUnauthorized: vi.fn()
}))

const fetchMock = vi.fn<typeof fetch>()
vi.stubGlobal('fetch', fetchMock)

const tokens = httpTokens(backend('https://api.test/'))

// ky reads the body before the test can, so it is captured as it is sent.
function answer(response: () => Response) {
  const requests: { method: string; url: string; body: unknown }[] = []
  fetchMock.mockImplementation(async request => {
    if (!(request instanceof Request)) throw new Error('not a Request')
    const text = await request.clone().text()
    requests.push({
      method: request.method,
      url: request.url,
      body: text ? JSON.parse(text) : null
    })
    return response()
  })
  return requests
}

afterEach(() => {
  fetchMock.mockReset()
})

describe('httpTokens', () => {
  it.each([
    ['personal', 'https://api.test/tokens'],
    ['organization', 'https://api.test/organization/tokens']
  ] as const)('lists the %s tokens', async (owner, url) => {
    const requests = answer(() => Response.json({ tokens: [] }))

    await expect(tokens.list(owner)).resolves.toEqual([])
    expect(requests).toEqual([{ method: 'GET', url, body: null }])
  })

  it('sends a token that never expires as a null expiry', async () => {
    const requests = answer(() => Response.json({}, { status: 201 }))

    await tokens.create('personal', {
      name: 'Agent',
      scopes: ['space:read'],
      spaces: 'all',
      expiresInDays: null
    })

    expect(requests[0]?.body).toEqual({
      name: 'Agent',
      scopes: ['space:read'],
      spaces: 'all',
      expiresAt: null
    })
  })

  it('reads the policy and the spaces an organization token may cover', async () => {
    const requests = answer(() =>
      Response.json({
        allowNoExpiry: true,
        maxLifetimeDays: 90,
        spaces: [{ id: 's-1', name: 'Design' }]
      })
    )

    await expect(tokens.policy()).resolves.toMatchObject({
      allowNoExpiry: true,
      maxLifetimeDays: 90
    })
    await expect(tokens.organizationSpaces()).resolves.toEqual([
      { id: 's-1', name: 'Design' }
    ])
    expect(requests.map(r => r.url)).toEqual([
      'https://api.test/organization/token-policy',
      'https://api.test/organization/token-spaces'
    ])
  })

  it('creates a token and answers its secret', async () => {
    const created = { id: 't-1', name: 'Agent', token: 'tws_secret' }
    const requests = answer(() => Response.json(created, { status: 201 }))
    const body = {
      name: 'Agent',
      scopes: ['space:read' as const],
      spaces: 'all' as const,
      role: 'viewer' as const,
      expiresInDays: 30 as const
    }

    await expect(tokens.create('organization', body)).resolves.toEqual(created)
    expect(requests).toEqual([
      { method: 'POST', url: 'https://api.test/organization/tokens', body }
    ])
  })

  it('renames and revokes a token by id', async () => {
    const requests = answer(() => new Response(null, { status: 204 }))

    await tokens.rename('personal', 't-1', 'CI')
    await tokens.revoke('personal', 't-1')

    expect(requests).toEqual([
      {
        method: 'PATCH',
        url: 'https://api.test/tokens/t-1',
        body: { name: 'CI' }
      },
      { method: 'DELETE', url: 'https://api.test/tokens/t-1', body: null }
    ])
  })

  it("rejects a refusal with the backend's reason", async () => {
    fetchMock.mockResolvedValue(
      Response.json(
        {
          error: 'invalid_request',
          message: 'the policy caps tokens at 90 days'
        },
        { status: 400 }
      )
    )

    await expect(tokens.list('personal')).rejects.toMatchObject({
      status: 400,
      code: 'invalid_request',
      reason: 'the policy caps tokens at 90 days'
    })
  })
})
