import { pino } from 'pino'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createServer } from '../../infra/http.ts'
import { createTestDb, type TestDb } from '../../infra/testing.ts'
import { anIdentity, fakeAuth } from '../auth/testing.ts'
import { registerSpaceRoutes } from './routes.ts'
import { spaceGroups, spaceMembers, spaceResources, spaces } from './schema.ts'

const ALICE = '8f14e45f-ceea-467a-9575-1d1c2b0c4b2e'
const BOB = 'c9f0f895-fb98-4b91-a1a4-7f3e2d1c0b5a'
const DESIGN = '3b9e2c71-5d4a-4f0e-9c8b-1a2d6e7f8091'
const SALES = '9d1c7a52-0b3e-4f6a-8c2d-5e4f3a2b1c0d'
const OTHER_ORG = '1679091c-5a88-4faf-afb5-e6087eb1b2dc'
const DESIGNERS = 'c2a8e1f0-7b3d-4e9a-8f61-2d5b9c0e4a17'

let testDb: TestDb
beforeAll(async () => {
  testDb = await createTestDb()
})
afterAll(() => testDb.drop())

beforeEach(async () => {
  const { db } = testDb
  for (const table of [spaceMembers, spaceGroups, spaceResources, spaces]) {
    await db.delete(table)
  }
  await db.insert(spaces).values([
    { spaceId: DESIGN, organizationId: 'org-1', name: 'Design' },
    { spaceId: SALES, organizationId: 'org-1', name: 'Sales' },
    { spaceId: OTHER_ORG, organizationId: 'org-2', name: 'Elsewhere' }
  ])
  const member = (
    spaceId: string,
    userId: string,
    role: 'viewer' | 'admin'
  ) => ({
    spaceId,
    userId,
    username: userId === ALICE ? 'alice' : 'bob',
    email: userId === ALICE ? 'alice@example.com' : 'bob@example.com',
    role
  })
  await db
    .insert(spaceMembers)
    .values([
      member(DESIGN, ALICE, 'admin'),
      member(DESIGN, BOB, 'viewer'),
      member(SALES, BOB, 'admin'),
      member(OTHER_ORG, ALICE, 'admin')
    ])
  await db.insert(spaceGroups).values({
    spaceId: DESIGN,
    groupId: DESIGNERS,
    name: 'Designers',
    role: 'viewer'
  })
  await db.insert(spaceResources).values({
    spaceId: DESIGN,
    kind: 'drive',
    organizationId: 'org-1',
    resourceId: 'folder-1'
  })
})

function setUp() {
  const app = createServer({
    logger: pino({ level: 'silent' }),
    isReady: () => Promise.resolve(true)
  })
  const requireIdentity = fakeAuth(app, token =>
    token === 'alice' ? anIdentity({ userId: ALICE }) : null
  )
  registerSpaceRoutes(app, { db: testDb.db, requireIdentity })
  return (url: string) =>
    app.inject({
      method: 'GET',
      url,
      headers: { authorization: 'Bearer alice' }
    })
}

describe('GET /spaces', () => {
  it("lists the caller's spaces in their organization, with their role", async () => {
    const response = await setUp()('/spaces')

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      spaces: [{ id: DESIGN, name: 'Design', role: 'admin' }]
    })
  })
})

describe('GET /spaces/:id', () => {
  it('returns the space with its members, groups and resources', async () => {
    const response = await setUp()(`/spaces/${DESIGN}`)

    expect(response.statusCode).toBe(200)
    const body = response.json<{ resources: unknown[] }>()
    expect(body).toMatchObject({
      id: DESIGN,
      name: 'Design',
      role: 'admin',
      members: [
        {
          id: ALICE,
          username: 'alice',
          email: 'alice@example.com',
          role: 'admin'
        },
        { id: BOB, username: 'bob', email: 'bob@example.com', role: 'viewer' }
      ],
      groups: [{ id: DESIGNERS, name: 'Designers', role: 'viewer' }]
    })
    expect(body.resources).toContainEqual({ kind: 'drive', id: 'folder-1' })
    expect(body.resources).toContainEqual({ kind: 'mailbox', id: null })
    expect(body.resources).toHaveLength(5)
  })

  it.each([
    ['a space the caller is not in', SALES],
    ['a space of another organization', OTHER_ORG],
    ['a space that does not exist', '00000000-0000-4000-8000-000000000000'],
    ['an id that is not a uuid', 'design']
  ])('answers 404 for %s', async (_case, id) => {
    const response = await setUp()(`/spaces/${id}`)

    expect(response.statusCode).toBe(404)
  })
})

it('asks for a bearer token', async () => {
  const app = createServer({
    logger: pino({ level: 'silent' }),
    isReady: () => Promise.resolve(true)
  })
  registerSpaceRoutes(app, {
    db: testDb.db,
    requireIdentity: fakeAuth(app, () => null)
  })

  const response = await app.inject({ method: 'GET', url: '/spaces' })

  expect(response.statusCode).toBe(401)
})
