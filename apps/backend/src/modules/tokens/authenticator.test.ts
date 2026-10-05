import { eq } from 'drizzle-orm'
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest'
import { createTestDb, type TestDb } from '../../infra/testing.ts'
import { sha256 } from '../auth/authenticator.ts'
import { apiTokenAuthenticator } from './authenticator.ts'
import { apiTokens, apiTokenSpaces } from './schema.ts'

const ALICE = '8f14e45f-ceea-467a-9575-1d1c2b0c4b2e'
const DESIGN = '3b9e2c71-5d4a-4f0e-9c8b-1a2d6e7f8091'

let testDb: TestDb
beforeAll(async () => {
  testDb = await createTestDb()
})
afterAll(() => testDb.drop())
beforeEach(async () => {
  await testDb.db.delete(apiTokens)
})

async function aToken(
  token: string,
  overrides: Partial<typeof apiTokens.$inferInsert> = {},
  spaceIds: string[] = []
) {
  const [row] = await testDb.db
    .insert(apiTokens)
    .values({
      tokenHash: sha256(token),
      name: 'release bot',
      organizationId: 'org-1',
      ownerKind: 'account',
      accountId: ALICE,
      scopes: ['space:read'],
      createdBy: 'alice@example.com',
      ...overrides
    })
    .returning({ id: apiTokens.id })
  if (!row) throw new Error('token not inserted')
  for (const spaceId of spaceIds) {
    await testDb.db.insert(apiTokenSpaces).values({ tokenId: row.id, spaceId })
  }
}

const authenticate = (token: string) =>
  apiTokenAuthenticator(testDb.db, {
    isTechnicalAccount: () => Promise.reject(new Error('not technical'))
  })(token)

describe('technical accounts', () => {
  it('refuses the token once the account is gone, checking every 5 minutes', async () => {
    await aToken('tws_ci', { technical: true })
    const isTechnicalAccount = vi
      .fn<() => Promise<boolean>>()
      .mockResolvedValueOnce(true)
      .mockResolvedValue(false)
    let now = 0
    const check = apiTokenAuthenticator(
      testDb.db,
      { isTechnicalAccount },
      () => now
    )

    const first = await check('tws_ci')
    now += 4 * 60_000
    const cached = await check('tws_ci')
    now += 2 * 60_000
    const gone = await check('tws_ci')

    expect(first).toMatchObject({ userId: ALICE })
    expect(cached).toMatchObject({ userId: ALICE })
    expect(gone).toBeNull()
    expect(isTechnicalAccount).toHaveBeenCalledTimes(2)
    expect(isTechnicalAccount).toHaveBeenCalledWith('org-1', ALICE)
  })
})

describe('apiTokenAuthenticator', () => {
  it('returns the caller of an account token', async () => {
    await aToken('tws_alice', {}, [DESIGN])

    expect(await authenticate('tws_alice')).toMatchObject({
      kind: 'token',
      name: 'release bot',
      organizationId: 'org-1',
      userId: ALICE,
      role: null,
      scopes: ['space:read'],
      spaceIds: [DESIGN]
    })
  })

  it('returns the role of an organization token', async () => {
    await aToken('tws_org', {
      ownerKind: 'organization',
      accountId: null,
      role: 'editor',
      allSpaces: true
    })

    expect(await authenticate('tws_org')).toMatchObject({
      userId: null,
      role: 'editor',
      spaceIds: null
    })
  })

  it('records when the token was last used', async () => {
    await aToken('tws_alice')

    await authenticate('tws_alice')

    const [row] = await testDb.db
      .select({ lastUsedAt: apiTokens.lastUsedAt })
      .from(apiTokens)
      .where(eq(apiTokens.tokenHash, sha256('tws_alice')))
    expect(row?.lastUsedAt).toBeInstanceOf(Date)
  })

  it.each([
    ['unknown', {}, 'tws_other'],
    ['revoked', { revokedAt: new Date() }, 'tws_alice'],
    ['expired', { expiresAt: new Date(Date.now() - 1000) }, 'tws_alice']
  ])('refuses a token that is %s', async (_case, overrides, token) => {
    await aToken('tws_alice', overrides)

    expect(await authenticate(token)).toBeNull()
  })

  it('accepts a token before its expiry', async () => {
    await aToken('tws_alice', { expiresAt: new Date(Date.now() + 60_000) })

    expect(await authenticate('tws_alice')).not.toBeNull()
  })
})
