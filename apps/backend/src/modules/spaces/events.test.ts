import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { PlatformEvent } from '../../events/envelope.ts'
import { MalformedEventError } from '../../events/router.ts'
import { createTestDb, type TestDb } from '../../infra/testing.ts'
import { spacePlatformRoutes } from './events.ts'
import { spaceMembers, spaces } from './schema.ts'

const SPACE_ID = '3b9e2c71-5d4a-4f0e-9c8b-1a2d6e7f8091'
const jdoe = {
  username: 'jdoe',
  email: 'jdoe@evilcorp.com',
  firstName: 'John',
  lastName: 'Doe',
  role: 'editor'
}

let testDb: TestDb
beforeAll(async () => {
  testDb = await createTestDb()
})
afterAll(() => testDb.drop())
beforeEach(async () => {
  await testDb.db.delete(spaceMembers)
  await testDb.db.delete(spaces)
})

function handle(routingKey: string, body: unknown) {
  const handler = spacePlatformRoutes.get(routingKey)
  if (!handler) throw new Error(`no handler for ${routingKey}`)
  const event: PlatformEvent = { routingKey, messageId: 'msg-1', body }
  return testDb.db.transaction(tx => handler(event, tx))
}

function created(overrides: Record<string, unknown> = {}) {
  return handle('twake.space.created', {
    organizationId: 'evilcorp123',
    id: SPACE_ID,
    name: 'Design Sprint',
    members: [jdoe],
    actor: 'admin@evilcorp.com',
    timestamp: '2026-10-05T09:12:44.512Z',
    ...overrides
  })
}

const readSpace = () =>
  testDb.db.select().from(spaces).where(eq(spaces.spaceId, SPACE_ID))
const readMembers = () =>
  testDb.db
    .select({
      username: spaceMembers.username,
      email: spaceMembers.email,
      role: spaceMembers.role
    })
    .from(spaceMembers)
    .where(eq(spaceMembers.spaceId, SPACE_ID))

describe('space events', () => {
  it('stores a created space with its members', async () => {
    await created()

    expect(await readSpace()).toMatchObject([
      { organizationId: 'evilcorp123', name: 'Design Sprint' }
    ])
    expect(await readMembers()).toEqual([
      { username: 'jdoe', email: 'jdoe@evilcorp.com', role: 'editor' }
    ])
  })

  it('changes nothing when a created space is replayed', async () => {
    await created()
    await created()

    expect(await readSpace()).toHaveLength(1)
    expect(await readMembers()).toHaveLength(1)
  })

  it('keeps the last entry of a member listed twice', async () => {
    await created({ members: [jdoe, { ...jdoe, role: 'admin' }] })

    expect(await readMembers()).toMatchObject([{ role: 'admin' }])
  })

  it('renames a space', async () => {
    await created()
    await handle('twake.space.updated', {
      organizationId: 'evilcorp123',
      id: SPACE_ID,
      name: 'Design Week',
      timestamp: '2026-10-05T10:00:00.000Z'
    })

    expect(await readSpace()).toMatchObject([{ name: 'Design Week' }])
  })

  it('removes a deleted space and its members', async () => {
    await created()
    await handle('twake.space.deleted', {
      organizationId: 'evilcorp123',
      id: SPACE_ID,
      timestamp: '2026-10-05T11:00:00.000Z'
    })

    expect(await readSpace()).toEqual([])
    expect(await readMembers()).toEqual([])
  })

  it('refuses a space event without a space id', async () => {
    await expect(created({ id: 'not-a-uuid' })).rejects.toBeInstanceOf(
      MalformedEventError
    )
  })
})
