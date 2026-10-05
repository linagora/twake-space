import { eq } from 'drizzle-orm'
import { pino } from 'pino'
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest'
import type { PlatformEvent } from '../../events/envelope.ts'
import { lastChanges } from '../../events/schema.ts'
import { MalformedEventError } from '../../events/router.ts'
import { createTestDb, type TestDb } from '../../infra/testing.ts'
import { spacePlatformRoutes } from './events.ts'
import { spaceGroups, spaceMembers, spaces } from './schema.ts'

const SPACE_ID = '3b9e2c71-5d4a-4f0e-9c8b-1a2d6e7f8091'
const JDOE_ID = '8f14e45f-ceea-467a-9575-1d1c2b0c4b2e'
const jdoe = {
  uuid: JDOE_ID,
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
const log = pino({ level: 'silent' })
const warn = vi.spyOn(log, 'warn')

beforeEach(async () => {
  warn.mockClear()
  await testDb.db.delete(spaceMembers)
  await testDb.db.delete(spaceGroups)
  await testDb.db.delete(spaces)
  await testDb.db.delete(lastChanges)
})

function handle(routingKey: string, body: unknown) {
  const handler = spacePlatformRoutes.get(routingKey)
  if (!handler) throw new Error(`no handler for ${routingKey}`)
  const event: PlatformEvent = { routingKey, messageId: 'msg-1', body }
  return testDb.db.transaction(tx => handler(event, tx, log))
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
      userId: spaceMembers.userId,
      username: spaceMembers.username,
      email: spaceMembers.email,
      role: spaceMembers.role
    })
    .from(spaceMembers)
    .where(eq(spaceMembers.spaceId, SPACE_ID))
const readGroups = () =>
  testDb.db
    .select({
      groupId: spaceGroups.groupId,
      name: spaceGroups.name,
      role: spaceGroups.role
    })
    .from(spaceGroups)
    .where(eq(spaceGroups.spaceId, SPACE_ID))

const DESIGNERS_ID = 'c2a8e1f0-7b3d-4e9a-8f61-2d5b9c0e4a17'
const designers = { id: DESIGNERS_ID, name: 'Designers', role: 'viewer' }

describe('space events', () => {
  it('stores a created space with its members', async () => {
    await created()

    expect(await readSpace()).toMatchObject([
      { organizationId: 'evilcorp123', name: 'Design Sprint' }
    ])
    expect(await readMembers()).toEqual([
      {
        userId: JDOE_ID,
        username: 'jdoe',
        email: 'jdoe@evilcorp.com',
        role: 'editor'
      }
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

  it('removes a deleted user and no one else', async () => {
    const otherSpace = '9d1c7a52-0b3e-4f6a-8c2d-5e4f3a2b1c0d'
    const other = { ...jdoe, uuid: '1679091c-5a88-4faf-afb5-e6087eb1b2dc' }
    await created()
    await created({ id: otherSpace, members: [other] })
    await handle('domain.user.deleted', {
      emitter: 'ldap-rest',
      type: 'user.deleted',
      uuid: JDOE_ID,
      userId: 'jdoe',
      internalEmail: 'jdoe@evilcorp.com',
      organizationId: 'evilcorp123',
      reason: 'user deleted'
    })

    expect(await readMembers()).toEqual([])
    expect(
      await testDb.db
        .select()
        .from(spaceMembers)
        .where(eq(spaceMembers.spaceId, otherSpace))
    ).toHaveLength(1)
  })

  it('removes a deleted user sent without a uuid by their email', async () => {
    await created()
    await handle('domain.user.deleted', {
      emitter: 'ldap-rest',
      type: 'user.deleted',
      userId: 'jdoe',
      internalEmail: 'jdoe@evilcorp.com',
      organizationId: 'evilcorp123',
      reason: 'user deleted'
    })

    expect(await readMembers()).toEqual([])
    expect(warn).toHaveBeenCalled()
  })

  it('refuses a space event without a space id', async () => {
    await expect(created({ id: 'not-a-uuid' })).rejects.toBeInstanceOf(
      MalformedEventError
    )
  })
})

describe('member events', () => {
  const member = (routingKey: string, members: unknown[]) =>
    handle(routingKey, {
      organizationId: 'evilcorp123',
      id: SPACE_ID,
      members,
      actor: 'admin@evilcorp.com',
      timestamp: '2026-10-05T09:12:44.512Z'
    })
  const asmith = {
    ...jdoe,
    uuid: 'c9f0f895-fb98-4b91-a1a4-7f3e2d1c0b5a',
    username: 'asmith',
    email: 'asmith@evilcorp.com'
  }

  it('adds a member with their role', async () => {
    await created()

    await member('twake.space.member.added', [{ ...asmith, role: 'viewer' }])

    expect(await readMembers()).toContainEqual({
      userId: asmith.uuid,
      username: 'asmith',
      email: 'asmith@evilcorp.com',
      role: 'viewer'
    })
  })

  it("changes a member's role", async () => {
    await created()

    await member('twake.space.member.role.changed', [
      { ...jdoe, role: 'admin' }
    ])

    expect(await readMembers()).toMatchObject([
      { username: 'jdoe', role: 'admin' }
    ])
  })

  it('keeps a member whose username changed as the same person', async () => {
    await created()

    await member('twake.space.member.role.changed', [
      { ...jdoe, username: 'john.doe', role: 'admin' }
    ])

    expect(await readMembers()).toMatchObject([
      { userId: JDOE_ID, username: 'john.doe', role: 'admin' }
    ])
  })

  it('removes a member', async () => {
    await created({ members: [jdoe, asmith] })

    await member('twake.space.member.removed', [jdoe])

    expect(await readMembers()).toMatchObject([{ username: 'asmith' }])
  })

  it('finds a member sent without a uuid by their email', async () => {
    await created()

    await member('twake.space.member.role.changed', [
      { ...jdoe, uuid: undefined, role: 'admin' }
    ])

    expect(await readMembers()).toMatchObject([
      { userId: JDOE_ID, role: 'admin' }
    ])
    expect(warn).toHaveBeenCalled()
  })

  it('skips a member sent without a uuid who is not in the copy', async () => {
    await created()

    await member('twake.space.member.added', [{ ...asmith, uuid: undefined }])

    expect(await readMembers()).toMatchObject([{ username: 'jdoe' }])
    expect(warn).toHaveBeenCalled()
  })

  it('removes a member sent with only an email', async () => {
    await created({ members: [jdoe, asmith] })

    await member('twake.space.member.removed', [{ email: jdoe.email }])

    expect(await readMembers()).toMatchObject([{ username: 'asmith' }])
  })

  it('refuses a removed member with neither a uuid nor an email', async () => {
    await expect(
      member('twake.space.member.removed', [{ username: 'jdoe' }])
    ).rejects.toBeInstanceOf(MalformedEventError)
  })

  it('refuses a member event without members', async () => {
    await expect(member('twake.space.member.added', [])).rejects.toBeInstanceOf(
      MalformedEventError
    )
  })
})

describe('group events', () => {
  const group = (routingKey: string, groups: unknown[]) =>
    handle(routingKey, {
      organizationId: 'evilcorp123',
      id: SPACE_ID,
      groups,
      actor: 'admin@evilcorp.com',
      timestamp: '2026-10-05T09:12:44.512Z'
    })

  it('stores the linked groups of a created space', async () => {
    await created({ groups: [designers] })

    expect(await readGroups()).toEqual([
      { groupId: DESIGNERS_ID, name: 'Designers', role: 'viewer' }
    ])
  })

  it('links a group with its role', async () => {
    await created()

    await group('twake.space.group.linked', [designers])

    expect(await readGroups()).toMatchObject([{ groupId: DESIGNERS_ID }])
  })

  it("changes a linked group's role", async () => {
    await created({ groups: [designers] })

    await group('twake.space.group.role.changed', [
      { ...designers, role: 'editor' }
    ])

    expect(await readGroups()).toMatchObject([{ role: 'editor' }])
  })

  it('unlinks a group', async () => {
    await created({ groups: [designers] })

    await group('twake.space.group.unlinked', [{ id: DESIGNERS_ID }])

    expect(await readGroups()).toEqual([])
  })

  it('follows the rename of a linked group', async () => {
    await created({ groups: [designers] })

    await handle('b2b.group.updated', {
      organizationId: 'evilcorp123',
      id: DESIGNERS_ID,
      name: 'Product design',
      timestamp: '2026-10-05T09:12:44.512Z'
    })

    expect(await readGroups()).toMatchObject([{ name: 'Product design' }])
  })

  it('keeps the name of a group updated without a rename', async () => {
    await created({ groups: [designers] })

    await handle('b2b.group.updated', {
      organizationId: 'evilcorp123',
      id: DESIGNERS_ID,
      name: '',
      color: '#ff0000',
      timestamp: '2026-10-05T09:12:44.512Z'
    })

    expect(await readGroups()).toMatchObject([{ name: 'Designers' }])
  })

  it('refuses a group event without groups', async () => {
    await expect(group('twake.space.group.linked', [])).rejects.toBeInstanceOf(
      MalformedEventError
    )
  })
})

describe('stale events', () => {
  const at = (time: string) => `2026-10-05T${time}Z`
  const space = (routingKey: string, time: string, body = {}) =>
    handle(routingKey, {
      organizationId: 'evilcorp123',
      id: SPACE_ID,
      timestamp: at(time),
      ...body
    })

  it('ignores a member event older than the last change to that member', async () => {
    await space('twake.space.created', '09:00:00', {
      name: 'Design Sprint',
      members: [jdoe]
    })
    await space('twake.space.member.removed', '10:00:00', { members: [jdoe] })

    await space('twake.space.member.added', '09:30:00', { members: [jdoe] })

    expect(await readMembers()).toEqual([])
  })

  it('ignores a removal older than the last change to that member', async () => {
    await space('twake.space.created', '09:00:00', {
      name: 'Design Sprint',
      members: [jdoe]
    })
    await space('twake.space.member.role.changed', '10:00:00', {
      members: [{ ...jdoe, role: 'admin' }]
    })

    await space('twake.space.member.removed', '09:30:00', { members: [jdoe] })

    expect(await readMembers()).toMatchObject([{ role: 'admin' }])
  })

  it('ignores a rename older than the last one', async () => {
    await space('twake.space.created', '09:00:00', { name: 'Design Sprint' })
    await space('twake.space.updated', '10:00:00', { name: 'Design' })

    await space('twake.space.updated', '09:30:00', { name: 'Sprint' })

    expect(await readSpace()).toMatchObject([{ name: 'Design' }])
  })

  it('does not bring back a deleted space or its members', async () => {
    await space('twake.space.created', '09:00:00', {
      name: 'Design Sprint',
      members: [jdoe],
      groups: [designers]
    })
    await space('twake.space.deleted', '10:00:00')

    await space('twake.space.created', '09:00:00', {
      name: 'Design Sprint',
      members: [jdoe]
    })
    await space('twake.space.member.added', '09:30:00', { members: [jdoe] })
    await space('twake.space.group.linked', '09:30:00', { groups: [designers] })

    expect(await readSpace()).toEqual([])
    expect(await readMembers()).toEqual([])
    expect(await readGroups()).toEqual([])
  })

  it('stores a replayed creation older than a rename', async () => {
    await space('twake.space.updated', '10:00:00', { name: 'Design' })

    await space('twake.space.created', '09:00:00', {
      name: 'Design Sprint',
      members: [jdoe]
    })

    expect(await readSpace()).toMatchObject([{ name: 'Design Sprint' }])
    expect(await readMembers()).toHaveLength(1)
  })

  it('does not add a member to a space deleted after the event', async () => {
    await space('twake.space.created', '09:00:00', { name: 'Design Sprint' })
    await space('twake.space.deleted', '10:00:00')

    await space('twake.space.member.added', '09:30:00', { members: [jdoe] })

    expect(await readMembers()).toEqual([])
  })

  it('ignores a group rename older than the last one', async () => {
    await space('twake.space.created', '09:00:00', {
      name: 'Design Sprint',
      groups: [designers]
    })
    const renamed = (time: string, name: string) =>
      handle('b2b.group.updated', {
        organizationId: 'evilcorp123',
        id: DESIGNERS_ID,
        name,
        timestamp: at(time)
      })
    await renamed('10:00:00', 'Product design')

    await renamed('09:30:00', 'UX')

    expect(await readGroups()).toMatchObject([{ name: 'Product design' }])
  })
})
