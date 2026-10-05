import { pino } from 'pino'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createServer } from '../../infra/http.ts'
import { createTestDb, type TestDb } from '../../infra/testing.ts'
import { aTokenCaller, anIdentity, fakeAuth } from '../auth/testing.ts'
import { spaceMembers, spaces } from '../spaces/schema.ts'
import { apiTokenAuthenticator, type TokenCaller } from './authenticator.ts'
import { registerTokenRoutes } from './routes.ts'
import {
  apiTokens,
  apiTokenSpaces,
  organizationTokenPolicy,
  tokenAudit
} from './schema.ts'

const ALICE = '8f14e45f-ceea-467a-9575-1d1c2b0c4b2e'
const BOB = 'c9f0f895-fb98-4b91-a1a4-7f3e2d1c0b5a'
const DESIGN = '3b9e2c71-5d4a-4f0e-9c8b-1a2d6e7f8091'
const SALES = '9d1c7a52-0b3e-4f6a-8c2d-5e4f3a2b1c0d'
const DAY = 24 * 60 * 60 * 1000

let testDb: TestDb
beforeAll(async () => {
  testDb = await createTestDb()
})
afterAll(() => testDb.drop())

beforeEach(async () => {
  const { db } = testDb
  for (const table of [
    tokenAudit,
    apiTokenSpaces,
    apiTokens,
    organizationTokenPolicy,
    spaceMembers,
    spaces
  ]) {
    await db.delete(table)
  }
  await db.insert(spaces).values([
    { spaceId: DESIGN, organizationId: 'org-1', name: 'Design' },
    { spaceId: SALES, organizationId: 'org-1', name: 'Sales' }
  ])
  await db.insert(spaceMembers).values([
    {
      spaceId: DESIGN,
      userId: ALICE,
      username: 'alice',
      email: 'alice@example.com',
      role: 'admin'
    },
    {
      spaceId: SALES,
      userId: ALICE,
      username: 'alice',
      email: 'alice@example.com',
      role: 'viewer'
    }
  ])
})

function setUp(tokenCaller: TokenCaller = aTokenCaller()) {
  const app = createServer({
    logger: pino({ level: 'silent' }),
    isReady: () => Promise.resolve(true)
  })
  const authorize = fakeAuth(
    app,
    token =>
      token === 'alice'
        ? anIdentity({ userId: ALICE })
        : token === 'bob'
          ? anIdentity({ userId: BOB })
          : null,
    token => (token === 'tws_bot' ? tokenCaller : null)
  )
  registerTokenRoutes(app, { db: testDb.db, authorize })
  return (
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    url: string,
    body?: object,
    token = 'alice'
  ) =>
    app.inject({
      method,
      url,
      headers: { authorization: `Bearer ${token}` },
      ...(body && { payload: body })
    })
}

const create = (body: object = {}) => ({
  name: 'release bot',
  scopes: ['space:read'],
  spaces: 'all',
  ...body
})

describe('POST /tokens', () => {
  it('returns the token once, valid for 30 days by default', async () => {
    const response = await setUp()('POST', '/tokens', create())

    expect(response.statusCode).toBe(201)
    const created = response.json<{ token: string; expiresAt: string }>()
    expect(created.token).toMatch(/^tws_/)
    const expiresIn = new Date(created.expiresAt).getTime() - Date.now()
    expect(Math.round(expiresIn / DAY)).toBe(30)

    const caller = await apiTokenAuthenticator(testDb.db)(created.token)
    expect(caller).toMatchObject({
      userId: ALICE,
      organizationId: 'org-1',
      scopes: ['space:read'],
      spaceIds: null
    })
  })

  it('covers a chosen list of the account spaces', async () => {
    const post = setUp()

    const created = await post('POST', '/tokens', create({ spaces: [SALES] }))
    const outside = await post(
      'POST',
      '/tokens',
      create({ spaces: ['00000000-0000-4000-8000-000000000000'] })
    )

    const { token } = created.json<{ token: string }>()
    expect((await apiTokenAuthenticator(testDb.db)(token))?.spaceIds).toEqual([
      SALES
    ])
    expect(outside.statusCode).toBe(400)
  })

  it('takes a lifetime in days or a date', async () => {
    const post = setUp()
    const at = new Date(Date.now() + 10 * DAY).toISOString()

    const inDays = await post('POST', '/tokens', create({ expiresInDays: 7 }))
    const onDate = await post('POST', '/tokens', create({ expiresAt: at }))
    const odd = await post('POST', '/tokens', create({ expiresInDays: 12 }))

    expect(
      Math.round(
        (new Date(inDays.json<{ expiresAt: string }>().expiresAt).getTime() -
          Date.now()) /
          DAY
      )
    ).toBe(7)
    expect(onDate.json<{ expiresAt: string }>().expiresAt).toBe(at)
    expect(odd.statusCode).toBe(400)
  })

  it('follows the organization policy', async () => {
    const post = setUp()

    const neverDenied = await post(
      'POST',
      '/tokens',
      create({ expiresAt: null })
    )
    await testDb.db.insert(organizationTokenPolicy).values({
      organizationId: 'org-1',
      allowNoExpiry: true,
      maxLifetimeDays: 90
    })
    const tooLong = await post(
      'POST',
      '/tokens',
      create({ expiresInDays: 365 })
    )
    const never = await post('POST', '/tokens', create({ expiresAt: null }))

    expect(neverDenied.statusCode).toBe(400)
    expect(tooLong.statusCode).toBe(400)
    expect(never.statusCode).toBe(201)
    expect(never.json<{ expiresAt: null }>().expiresAt).toBeNull()
  })

  it('never gives a new token more rights than the token creating it', async () => {
    const post = setUp(
      aTokenCaller({
        userId: ALICE,
        scopes: ['tokens:write', 'space:read'],
        spaceIds: [SALES],
        expiresAt: new Date(Date.now() + 10 * DAY)
      })
    )
    const by = (body: object) =>
      post('POST', '/tokens', create(body), 'tws_bot')

    expect((await by({ scopes: ['space:write'] })).statusCode).toBe(403)
    expect((await by({ spaces: 'all' })).statusCode).toBe(403)
    expect((await by({ spaces: [DESIGN] })).statusCode).toBe(403)
    expect((await by({ spaces: [SALES], expiresInDays: 30 })).statusCode).toBe(
      403
    )
    expect((await by({ spaces: [SALES], expiresInDays: 7 })).statusCode).toBe(
      201
    )
  })

  it('needs tokens:write on a token', async () => {
    const response = await setUp()('POST', '/tokens', create(), 'tws_bot')

    expect(response.statusCode).toBe(403)
  })

  it('records the creation in the audit log', async () => {
    const created = await setUp()('POST', '/tokens', create())

    expect(
      await testDb.db
        .select({
          tokenId: tokenAudit.tokenId,
          action: tokenAudit.action,
          actor: tokenAudit.actor
        })
        .from(tokenAudit)
    ).toEqual([
      {
        tokenId: created.json<{ id: string }>().id,
        action: 'created',
        actor: ALICE
      }
    ])
  })
})
