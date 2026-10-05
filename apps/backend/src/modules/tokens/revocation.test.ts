import { asc, eq } from 'drizzle-orm'
import { pino } from 'pino'
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest'
import type { PlatformEvent } from '../../events/envelope.ts'
import { lastChanges } from '../../events/schema.ts'
import { createTestDb, type TestDb } from '../../infra/testing.ts'
import { spacePlatformRoutes } from '../spaces/events.ts'
import { spaceMembers, spaces } from '../spaces/schema.ts'
import { apiTokens, apiTokenSpaces, tokenAudit } from './schema.ts'

const ALICE = '8f14e45f-ceea-467a-9575-1d1c2b0c4b2e'
const BOB = 'c9f0f895-fb98-4b91-a1a4-7f3e2d1c0b5a'
const DESIGN = '3b9e2c71-5d4a-4f0e-9c8b-1a2d6e7f8091'
const SALES = '9d1c7a52-0b3e-4f6a-8c2d-5e4f3a2b1c0d'

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
    spaceMembers,
    spaces,
    lastChanges
  ]) {
    await db.delete(table)
  }
  await db.insert(spaces).values([
    { spaceId: DESIGN, organizationId: 'org-1', name: 'Design' },
    { spaceId: SALES, organizationId: 'org-1', name: 'Sales' }
  ])
  await db.insert(spaceMembers).values({
    spaceId: DESIGN,
    userId: ALICE,
    username: 'alice',
    email: 'alice@example.com',
    role: 'admin'
  })
})

async function token(
  name: string,
  owner: { accountId: string } | { role: 'editor' },
  options: {
    spaceIds?: string[]
    organizationId?: string
    createdAt?: Date
  } = {}
) {
  const [row] = await testDb.db
    .insert(apiTokens)
    .values({
      organizationId: options.organizationId ?? 'org-1',
      ...('accountId' in owner
        ? { ownerKind: 'account' as const, accountId: owner.accountId }
        : { ownerKind: 'organization' as const, role: owner.role }),
      name,
      tokenHash: name,
      scopes: ['space:read'],
      allSpaces: !options.spaceIds,
      createdBy: 'test',
      ...(options.createdAt && { createdAt: options.createdAt })
    })
    .returning({ id: apiTokens.id })
  if (!row) throw new Error('no token')
  if (options.spaceIds) {
    await testDb.db
      .insert(apiTokenSpaces)
      .values(options.spaceIds.map(spaceId => ({ tokenId: row.id, spaceId })))
  }
  return row.id
}

function handle(routingKey: string, body: unknown) {
  const handler = spacePlatformRoutes.get(routingKey)
  if (!handler) throw new Error(`no handler for ${routingKey}`)
  const event: PlatformEvent = { routingKey, messageId: 'msg-1', body }
  return testDb.db.transaction(tx =>
    handler(event, tx, pino({ level: 'silent' }))
  )
}

const active = async () =>
  (
    await testDb.db
      .select({ name: apiTokens.name, revokedAt: apiTokens.revokedAt })
      .from(apiTokens)
      .orderBy(asc(apiTokens.name))
  )
    .filter(t => t.revokedAt === null)
    .map(t => t.name)

it("revokes a deleted user's tokens in every organization", async () => {
  await token('alice', { accountId: ALICE })
  await token(
    'alice elsewhere',
    { accountId: ALICE },
    { organizationId: 'org-2' }
  )
  await token('bob', { accountId: BOB })

  await handle('domain.user.deleted', { uuid: ALICE })

  expect(await active()).toEqual(['bob'])
  expect(
    await testDb.db
      .select({ action: tokenAudit.action, actor: tokenAudit.actor })
      .from(tokenAudit)
  ).toEqual([
    { action: 'revoked', actor: 'domain.user.deleted' },
    { action: 'revoked', actor: 'domain.user.deleted' }
  ])
})

it("revokes a disabled member's tokens in that organization", async () => {
  await token('alice', { accountId: ALICE })
  await token(
    'alice elsewhere',
    { accountId: ALICE },
    { organizationId: 'org-2' }
  )

  await handle('b2b.member.disabled', {
    organizationId: 'org-1',
    username: 'alice',
    email: 'alice@example.com'
  })

  expect(await active()).toEqual(['alice elsewhere'])
})

it('spares tokens created after a replayed disable', async () => {
  await token(
    'new',
    { accountId: ALICE },
    { createdAt: new Date('2026-10-05T10:00:00Z') }
  )

  await handle('b2b.member.disabled', {
    organizationId: 'org-1',
    uuid: ALICE,
    username: 'alice',
    timestamp: '2026-10-05T09:00:00Z'
  })

  expect(await active()).toEqual(['new'])
})

it('revokes every token of a deleted organization', async () => {
  await token('alice', { accountId: ALICE })
  await token('org', { role: 'editor' })
  await token('other org', { role: 'editor' }, { organizationId: 'org-2' })

  await handle('domain.organization.deleted', { organizationId: 'org-1' })

  expect(await active()).toEqual(['other org'])
})

it('revokes tokens left with no space when a space is deleted', async () => {
  await token('design only', { role: 'editor' }, { spaceIds: [DESIGN] })
  const both = await token(
    'both',
    { accountId: ALICE },
    { spaceIds: [DESIGN, SALES] }
  )
  await token('all spaces', { accountId: ALICE })

  await handle('twake.space.deleted', { organizationId: 'org-1', id: DESIGN })

  expect(await active()).toEqual(['all spaces', 'both'])
  expect(
    await testDb.db
      .select({ spaceId: apiTokenSpaces.spaceId })
      .from(apiTokenSpaces)
      .where(eq(apiTokenSpaces.tokenId, both))
  ).toEqual([{ spaceId: SALES }])
})
