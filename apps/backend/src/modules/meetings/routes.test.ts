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
import { createServer } from '../../infra/http.ts'
import { createTestDb, type TestDb } from '../../infra/testing.ts'
import { anIdentity, fakeAuth } from '../auth/testing.ts'
import { spaceMembers, spaceResources, spaces } from '../spaces/schema.ts'
import {
  MEETING_REQUESTED,
  registerMeetingRoutes,
  type Publish
} from './routes.ts'

const DESIGN = '3b9e2c71-5d4a-4f0e-9c8b-1a2d6e7f8091'
const BARE = '6a1f0d2c-3b4e-4c5d-8e6f-7a8b9c0d1e2f'
const ALICE = '8f14e45f-ceea-467a-9575-1d1c2b0c4b2e'
const BOB = 'c9f0f895-fb98-4b91-a1a4-7f3e2d1c0b5a'
const USERS: Record<string, string> = { alice: ALICE, bob: BOB }

const meeting = {
  title: 'Design review',
  start: '2026-10-08T12:30:00+02:00',
  end: '2026-10-08T13:00:00+02:00',
  timezone: 'Europe/Paris',
  description: 'Last pass on the mockups'
}

let testDb: TestDb
beforeAll(async () => {
  testDb = await createTestDb()
})
afterAll(() => testDb.drop())

beforeEach(async () => {
  const { db } = testDb
  await db.delete(spaceResources)
  await db.delete(spaceMembers)
  await db.delete(spaces)
  await db.insert(spaces).values([
    { spaceId: DESIGN, organizationId: 'org-1', name: 'Design' },
    { spaceId: BARE, organizationId: 'org-1', name: 'Bare' }
  ])
  await db.insert(spaceMembers).values([
    {
      spaceId: DESIGN,
      userId: ALICE,
      username: 'alice',
      email: 'alice@example.com',
      role: 'editor'
    },
    {
      spaceId: DESIGN,
      userId: BOB,
      username: 'bob',
      email: 'bob@example.com',
      role: 'viewer'
    },
    {
      spaceId: BARE,
      userId: ALICE,
      username: 'alice',
      email: 'alice@example.com',
      role: 'admin'
    }
  ])
  await db.insert(spaceResources).values({
    spaceId: DESIGN,
    kind: 'calendar',
    organizationId: 'org-1',
    resourceId: 'c41e9b07'
  })
})

function setUp(publish = vi.fn<Publish>(() => Promise.resolve())) {
  const app = createServer({
    logger: pino({ level: 'silent' }),
    isReady: () => Promise.resolve(true)
  })
  const authorize = fakeAuth(app, token => {
    const userId = USERS[token]
    return userId
      ? anIdentity({
          userId,
          email: `${token}@example.com`,
          organizationId: 'org-1'
        })
      : null
  })
  registerMeetingRoutes(app, { db: testDb.db, authorize, publish })
  const post = (spaceId: string, body: object, token = 'alice') =>
    app.inject({
      method: 'POST',
      url: `/spaces/${spaceId}/meetings`,
      headers: { authorization: `Bearer ${token}` },
      payload: body
    })
  return { post, publish }
}

describe('POST /spaces/:spaceId/meetings', () => {
  it('publishes the meeting request for the team calendar', async () => {
    const { post, publish } = setUp()

    const response = await post(DESIGN, meeting)

    expect(response.statusCode).toBe(202)
    const { uid } = response.json<{ uid: string }>()
    expect(publish).toHaveBeenCalledWith(
      MEETING_REQUESTED,
      expect.objectContaining({
        specversion: '1.0',
        source: 'twake://space',
        type: MEETING_REQUESTED,
        twakeorg: 'org-1',
        twakeactorid: ALICE,
        twakeactor: 'alice@example.com',
        data: {
          uid,
          container: { kind: 'calendar', id: 'c41e9b07' },
          ...meeting
        }
      }),
      expect.any(String)
    )
  })

  it('keeps the uid of a retry', async () => {
    const { post, publish } = setUp()
    const uid = '6b0f6d1e-2f0a-4c55-9a43-7f1d1b9e2c10'

    const response = await post(DESIGN, { ...meeting, uid })

    expect(response.json<{ uid: string }>()).toEqual({ uid })
    expect(publish.mock.calls[0]?.[1]).toMatchObject({ data: { uid } })
  })

  it('refuses a viewer', async () => {
    const { post, publish } = setUp()

    const response = await post(DESIGN, meeting, 'bob')

    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({ error: 'cannot_schedule' })
    expect(publish).not.toHaveBeenCalled()
  })

  it('answers 404 for a space the caller is not in', async () => {
    const { post } = setUp()

    const response = await post(BARE, meeting, 'bob')

    expect(response.statusCode).toBe(404)
  })

  it('answers 409 when the space has no calendar yet', async () => {
    const { post, publish } = setUp()

    const response = await post(BARE, meeting)

    expect(response.statusCode).toBe(409)
    expect(response.json()).toEqual({ error: 'no_calendar' })
    expect(publish).not.toHaveBeenCalled()
  })

  it.each([
    ['an end before the start', { end: '2026-10-08T12:00:00+02:00' }],
    ['a meeting over a day', { end: '2026-10-09T13:00:00+02:00' }],
    ['an unknown time zone', { timezone: 'Mars/Olympus' }],
    ['an offset for a time zone', { timezone: '+02:00' }],
    ['a blank title', { title: '  ' }]
  ])('refuses %s', async (_name, change) => {
    const { post, publish } = setUp()

    const response = await post(DESIGN, { ...meeting, ...change })

    expect(response.statusCode).toBe(400)
    expect(publish).not.toHaveBeenCalled()
  })

  it('answers 503 when RabbitMQ does not take the request', async () => {
    const { post } = setUp(
      vi.fn<Publish>(() => Promise.reject(new Error('unroutable')))
    )

    const response = await post(DESIGN, meeting)

    expect(response.statusCode).toBe(503)
    expect(response.json()).toEqual({ error: 'unavailable' })
  })
})
