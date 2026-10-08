import { afterEach, describe, expect, it, vi } from 'vitest'

import { httpHarness } from '@/adapters/http/httpHarness'

vi.mock('@linagora/twake-oidc', () => ({
  getAccessToken: () => 'access-1'
}))

const fetchMock = vi.fn<typeof fetch>()
vi.stubGlobal('fetch', fetchMock)

afterEach(() => {
  fetchMock.mockReset()
})

let body = ''
const answer = (status: number) =>
  fetchMock.mockImplementation(async request => {
    if (request instanceof Request) body = await request.clone().text()
    return new Response(null, { status })
  })

const sent = () => {
  const [request] = fetchMock.mock.calls[0] ?? []
  if (!(request instanceof Request)) throw new Error('no request')
  return {
    url: request.url,
    method: request.method,
    authorization: request.headers.get('Authorization'),
    body
  }
}

describe('httpHarness', () => {
  it('approves a pending call with the access token', async () => {
    answer(204)

    await httpHarness('https://harness.test/').approve('pc 1')

    expect(sent()).toMatchObject({
      url: 'https://harness.test/v1/pending-calls/pc%201/approve',
      method: 'POST',
      authorization: 'Bearer access-1'
    })
  })

  it('refuses a pending call with its reason', async () => {
    answer(204)

    await httpHarness('https://harness.test/').refuse('pc-1', 'another_time')

    expect(sent()).toMatchObject({
      url: 'https://harness.test/v1/pending-calls/pc-1/refuse',
      authorization: 'Bearer access-1',
      body: '{"reason":"another_time"}'
    })
  })

  it('counts a call answered already as answered', async () => {
    answer(409)

    await expect(
      httpHarness('https://harness.test/').approve('pc-1')
    ).resolves.toBeUndefined()
  })

  it('fails on any other refusal', async () => {
    answer(500)

    await expect(
      httpHarness('https://harness.test/').approve('pc-1')
    ).rejects.toThrow()
  })
})
