import {
  AuthenticationError,
  ConflictError,
  NotFoundError
} from '@linagora/ldap-rest-client'
import { asc, eq } from 'drizzle-orm'
import { pino } from 'pino'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { lastChanges } from '../../events/schema.ts'
import { createServer } from '../../infra/http.ts'
import type { Person, SpaceDirectory } from '../../infra/ldap-rest.ts'
import { createTestDb, type TestDb } from '../../infra/testing.ts'
import { aTokenCaller, anIdentity, fakeAuth } from '../auth/testing.ts'
import type { TokenCaller } from '../tokens/authenticator.ts'
import { spacePlatformRoutes } from './events.ts'
import { spaceGroups, spaceMembers, spaces } from './schema.ts'
import { registerSpaceWriteRoutes } from './writes.ts'

const ALICE = '8f14e45f-ceea-467a-9575-1d1c2b0c4b2e'
const BOB = 'c9f0f895-fb98-4b91-a1a4-7f3e2d1c0b5a'
const CAROL = '45c48cce-2e2d-4fbd-a7b9-1e2f3a4b5c6d'
const DESIGN = '3b9e2c71-5d4a-4f0e-9c8b-1a2d6e7f8091'
const CREATED = '9d1c7a52-0b3e-4f6a-8c2d-5e4f3a2b1c0d'
const DESIGNERS = 'c2a8e1f0-7b3d-4e9a-8f61-2d5b9c0e4a17'
const log = pino({ level: 'silent' })

const people: Person[] = [
  { uuid: ALICE, username: 'alice', email: 'alice@example.com' },
  { uuid: BOB, username: 'bob', email: 'bob@example.com' },
  { uuid: CAROL, username: 'carol', email: 'carol@example.com' }
]

let testDb: TestDb
beforeAll(async () => {
  testDb = await createTestDb()
})
afterAll(() => testDb.drop())

beforeEach(async () => {
  const { db } = testDb
  for (const table of [spaceMembers, spaceGroups, spaces, lastChanges]) {
    await db.delete(table)
  }
  await db
    .insert(spaces)
    .values({ spaceId: DESIGN, organizationId: 'org-1', name: 'Design' })
  await db.insert(spaceMembers).values([
    {
      spaceId: DESIGN,
      userId: ALICE,
      username: 'alice',
      email: 'alice@example.com',
      role: 'admin'
    },
    {
      spaceId: DESIGN,
      userId: BOB,
      username: 'bob',
      email: 'bob@example.com',
      role: 'viewer'
    }
  ])
})

type Call = [string, ...unknown[]]

function ldapRest(refuse?: Error) {
  const calls: Call[] = []
  const write =
    (name: string) =>
    (...args: unknown[]) => {
      calls.push([name, ...args])
      return refuse ? Promise.reject(refuse) : Promise.resolve()
    }
  const directory: SpaceDirectory = {
    person: (_org, by, value) =>
      Promise.resolve(
        people.find(p => (by === 'id' ? p.uuid : p[by]) === value)
      ),
    create: (...args) => {
      calls.push(['create', ...args])
      return Promise.resolve({ id: CREATED })
    },
    rename: write('rename'),
    delete: write('delete'),
    addMembers: write('addMembers'),
    setMemberRole: write('setMemberRole'),
    removeMember: write('removeMember'),
    linkGroups: write('linkGroups'),
    setGroupRole: write('setGroupRole'),
    unlinkGroup: write('unlinkGroup'),
    groups: () =>
      Promise.resolve([{ id: DESIGNERS, name: 'Designers', role: 'viewer' }])
  }
  return { calls, directory }
}

function setUp(
  directory: SpaceDirectory,
  tokenCaller: TokenCaller = aTokenCaller()
) {
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
          ? anIdentity({ userId: BOB, email: 'bob@example.com' })
          : null,
    token => (token === 'tws_bot' ? tokenCaller : null)
  )
  registerSpaceWriteRoutes(app, { db: testDb.db, authorize, directory })
  return (
    method: 'POST' | 'PATCH' | 'DELETE',
    url: string,
    payload?: object,
    token = 'alice'
  ) =>
    app.inject({
      method,
      url,
      headers: { authorization: `Bearer ${token}` },
      ...(payload && { payload })
    })
}

const members = (spaceId = DESIGN) =>
  testDb.db
    .select({ userId: spaceMembers.userId, role: spaceMembers.role })
    .from(spaceMembers)
    .where(eq(spaceMembers.spaceId, spaceId))
    .orderBy(asc(spaceMembers.username))

const nameOf = async (spaceId: string) =>
  (
    await testDb.db
      .select({ name: spaces.name })
      .from(spaces)
      .where(eq(spaces.spaceId, spaceId))
  )[0]?.name

describe('space writes', () => {
  it('creates a space with its creator as admin, as the creator', async () => {
    const { calls, directory } = ldapRest()

    const response = await setUp(directory)('POST', '/spaces', {
      name: 'Launch'
    })

    expect(response.statusCode).toBe(201)
    expect(response.json()).toEqual({
      id: CREATED,
      name: 'Launch',
      role: 'admin'
    })
    expect(calls).toEqual([
      [
        'create',
        'org-1',
        { name: 'Launch', members: [{ username: 'alice', role: 'admin' }] },
        'alice@example.com'
      ]
    ])
    expect(await nameOf(CREATED)).toBe('Launch')
    expect(await members(CREATED)).toEqual([{ userId: ALICE, role: 'admin' }])
  })

  it('lets only a space admin change it', async () => {
    const { calls, directory } = ldapRest()

    const response = await setUp(directory)(
      'PATCH',
      `/spaces/${DESIGN}`,
      { name: 'Renamed' },
      'bob'
    )

    expect(response.statusCode).toBe(403)
    expect(calls).toEqual([])
  })

  it('renames the copy, and the later event changes nothing', async () => {
    const { calls, directory } = ldapRest()

    const response = await setUp(directory)('PATCH', `/spaces/${DESIGN}`, {
      name: 'Design 2'
    })
    await testDb.db.transaction(tx =>
      (spacePlatformRoutes.get('twake.space.updated') ?? fail())(
        {
          routingKey: 'twake.space.updated',
          messageId: 'm1',
          body: {
            organizationId: 'org-1',
            id: DESIGN,
            name: 'Design 2',
            timestamp: new Date(Date.now() - 1000).toISOString()
          }
        },
        tx,
        log
      )
    )

    expect(response.statusCode).toBe(204)
    expect(calls).toEqual([
      ['rename', 'org-1', DESIGN, 'Design 2', 'alice@example.com']
    ])
    expect(await nameOf(DESIGN)).toBe('Design 2')
  })

  it('adds members to the copy with their account ids', async () => {
    const { calls, directory } = ldapRest()

    await setUp(directory)('POST', `/spaces/${DESIGN}/members`, {
      usernames: ['carol'],
      role: 'editor'
    })

    expect(calls).toEqual([
      ['addMembers', 'org-1', DESIGN, ['carol'], 'editor', 'alice@example.com']
    ])
    expect(await members()).toEqual([
      { userId: ALICE, role: 'admin' },
      { userId: BOB, role: 'viewer' },
      { userId: CAROL, role: 'editor' }
    ])
  })

  it('changes and removes a member by account id', async () => {
    const { calls, directory } = ldapRest()
    const write = setUp(directory)

    await write('PATCH', `/spaces/${DESIGN}/members/${BOB}`, {
      role: 'editor'
    })
    const afterChange = await members()
    await write('DELETE', `/spaces/${DESIGN}/members/${BOB}`)

    expect(calls.map(c => c.slice(0, 4))).toEqual([
      ['setMemberRole', 'org-1', DESIGN, 'bob'],
      ['removeMember', 'org-1', DESIGN, 'bob']
    ])
    expect(afterChange).toContainEqual({ userId: BOB, role: 'editor' })
    expect(await members()).toEqual([{ userId: ALICE, role: 'admin' }])
  })

  it("passes on ldap-rest's refusal and keeps the copy", async () => {
    const { directory } = ldapRest(
      new ConflictError('last admin', 'LAST_ADMIN')
    )

    const response = await setUp(directory)(
      'DELETE',
      `/spaces/${DESIGN}/members/${ALICE}`
    )

    expect(response.statusCode).toBe(409)
    expect(response.json()).toEqual({ error: 'LAST_ADMIN' })
    expect(await members()).toHaveLength(2)
  })

  it('removes a member another admin removed a moment before', async () => {
    const { directory } = ldapRest(
      new NotFoundError('member not found', 'MEMBER_NOT_FOUND')
    )

    const response = await setUp(directory)(
      'DELETE',
      `/spaces/${DESIGN}/members/${BOB}`
    )

    expect(response.statusCode).toBe(204)
    expect(await members()).toEqual([{ userId: ALICE, role: 'admin' }])
  })

  it('answers 500 when ldap-rest refuses its own credentials', async () => {
    const { directory } = ldapRest(new AuthenticationError('bad signature'))

    const response = await setUp(directory)('PATCH', `/spaces/${DESIGN}`, {
      name: 'Renamed'
    })

    expect(response.statusCode).toBe(500)
  })

  it('answers the write ldap-rest took even when the copy fails', async () => {
    const { directory } = ldapRest()
    directory.groups = () => Promise.reject(new Error('ldap-rest is down'))

    const response = await setUp(directory)(
      'POST',
      `/spaces/${DESIGN}/groups`,
      {
        groupIds: [DESIGNERS],
        role: 'viewer'
      }
    )

    expect(response.statusCode).toBe(204)
  })

  it('links a group with the name ldap-rest knows', async () => {
    const { directory } = ldapRest()

    await setUp(directory)('POST', `/spaces/${DESIGN}/groups`, {
      groupIds: [DESIGNERS],
      role: 'viewer'
    })

    expect(
      await testDb.db
        .select({ name: spaceGroups.name, role: spaceGroups.role })
        .from(spaceGroups)
    ).toEqual([{ name: 'Designers', role: 'viewer' }])
  })

  it('deletes the space from the copy', async () => {
    const { directory } = ldapRest()

    const response = await setUp(directory)('DELETE', `/spaces/${DESIGN}`)

    expect(response.statusCode).toBe(204)
    expect(await nameOf(DESIGN)).toBeUndefined()
    expect(await members()).toEqual([])
  })

  it('writes as the service for an organization token', async () => {
    const { calls, directory } = ldapRest()
    const write = setUp(
      directory,
      aTokenCaller({ userId: null, role: 'admin', scopes: ['space:write'] })
    )

    const rename = await write(
      'PATCH',
      `/spaces/${DESIGN}`,
      { name: 'Design 3' },
      'tws_bot'
    )
    const create = await write('POST', '/spaces', { name: 'X' }, 'tws_bot')

    expect(rename.statusCode).toBe(204)
    expect(calls).toEqual([['rename', 'org-1', DESIGN, 'Design 3', null]])
    expect(create.statusCode).toBe(403)
  })
})

function fail(): never {
  throw new Error('no handler')
}
