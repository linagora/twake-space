import { pino } from 'pino'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createServer } from '../../infra/http.ts'
import { createTestDb, type TestDb } from '../../infra/testing.ts'
import { aTokenCaller, anIdentity, fakeAuth } from '../auth/testing.ts'
import { activityEvents } from '../feed/schema.ts'
import { registerNotificationRoutes } from './routes.ts'
import { notifications, notificationSettings } from './schema.ts'

const ALICE = '8f14e45f-ceea-467a-9575-1d1c2b0c4b2e'
const BOB = 'c9f0f895-fb98-4b91-a1a4-7f3e2d1c0b5a'
const DESIGN = '3b9e2c71-5d4a-4f0e-9c8b-1a2d6e7f8091'

let testDb: TestDb
beforeAll(async () => {
  testDb = await createTestDb()
})
afterAll(() => testDb.drop())

beforeEach(async () => {
  await testDb.db.delete(notifications)
  await testDb.db.delete(notificationSettings)
  await testDb.db.delete(activityEvents)
})

async function notify(userId: string, title: string, minute: number) {
  const [event] = await testDb.db
    .insert(activityEvents)
    .values({
      source: 'drive',
      eventId: `${userId}-${title}`,
      organizationId: 'org-1',
      spaceId: DESIGN,
      type: 'com.twake.drive.file.shared',
      category: 'files',
      actor: { type: 'user', id: BOB, email: 'bob@example.com' },
      objectType: 'file',
      objectId: title,
      content: { object: { type: 'file', id: title, title } },
      time: new Date(`2026-10-05T09:${String(minute).padStart(2, '0')}:00Z`)
    })
    .returning({ id: activityEvents.id })
  if (!event) throw new Error('no event')
  const [row] = await testDb.db
    .insert(notifications)
    .values({
      organizationId: 'org-1',
      userId,
      type: 'invitation',
      spaceId: DESIGN,
      activityEventId: event.id,
      payload: {},
      createdAt: new Date(
        `2026-10-05T09:${String(minute).padStart(2, '0')}:00Z`
      )
    })
    .returning({ id: notifications.id })
  if (!row) throw new Error('no notification')
  return row.id
}

function setUp() {
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
    token =>
      token === 'tws_bot'
        ? aTokenCaller({ userId: ALICE, scopes: ['feed:read'] })
        : null
  )
  registerNotificationRoutes(app, { db: testDb.db, authorize })
  return (
    method: 'GET' | 'POST' | 'PUT',
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

interface Page {
  notifications: { id: string; read: boolean; activity: { content: unknown } }[]
  unread: number
}

describe('GET /notifications', () => {
  it("lists the caller's notifications, newest first, with the activity", async () => {
    await notify(ALICE, 'brief', 1)
    await notify(ALICE, 'budget', 2)
    await notify(BOB, 'secret', 3)

    const response = await setUp()('GET', '/notifications')

    expect(response.statusCode).toBe(200)
    const page = response.json<Page>()
    expect(page.unread).toBe(2)
    expect(page.notifications).toMatchObject([
      {
        type: 'invitation',
        spaceId: DESIGN,
        read: false,
        activity: {
          type: 'com.twake.drive.file.shared',
          category: 'files',
          actor: { type: 'user', id: BOB },
          content: { object: { title: 'budget' } }
        }
      },
      { activity: { content: { object: { title: 'brief' } } } }
    ])
  })

  it('pages with the last id seen', async () => {
    await notify(ALICE, 'one', 1)
    await notify(ALICE, 'two', 2)
    await notify(ALICE, 'three', 3)
    const get = setUp()

    const first = (await get('GET', '/notifications?limit=2')).json<Page>()
    const last = first.notifications.at(-1)?.id ?? ''
    const second = (
      await get('GET', `/notifications?limit=2&before=${last}`)
    ).json<Page>()

    expect(first.notifications).toHaveLength(2)
    expect(second.notifications).toMatchObject([
      { activity: { content: { object: { title: 'one' } } } }
    ])
  })

  it('pages through notifications made at the same time without skipping any', async () => {
    for (const title of ['a', 'b', 'c', 'd', 'e']) await notify(ALICE, title, 1)
    const get = setUp()
    const seen: string[] = []

    let before = ''
    for (let page = 0; page < 3; page++) {
      const { notifications: rows } = (
        await get('GET', `/notifications?limit=2${before}`)
      ).json<Page>()
      seen.push(...rows.map(r => r.id))
      before = `&before=${rows.at(-1)?.id ?? ''}`
    }

    expect(new Set(seen).size).toBe(5)
    expect(seen).toHaveLength(5)
  })

  it('is for people signed in, not API tokens', async () => {
    const response = await setUp()(
      'GET',
      '/notifications',
      undefined,
      'tws_bot'
    )

    expect(response.statusCode).toBe(403)
  })
})

describe('marking as read', () => {
  it('marks one notification as read', async () => {
    const id = await notify(ALICE, 'brief', 1)
    await notify(ALICE, 'budget', 2)
    const call = setUp()

    const response = await call('POST', `/notifications/${id}/read`)

    expect(response.statusCode).toBe(204)
    const page = (await call('GET', '/notifications')).json<Page>()
    expect(page.unread).toBe(1)
    expect(page.notifications.find(n => n.id === id)?.read).toBe(true)
  })

  it("never marks someone else's notification", async () => {
    const id = await notify(BOB, 'secret', 1)

    const response = await setUp()('POST', `/notifications/${id}/read`)

    expect(response.statusCode).toBe(404)
  })

  it('marks all of them as read', async () => {
    await notify(ALICE, 'brief', 1)
    await notify(ALICE, 'budget', 2)
    await notify(BOB, 'secret', 3)
    const call = setUp()

    await call('POST', '/notifications/read')

    expect((await call('GET', '/notifications')).json<Page>().unread).toBe(0)
    expect(
      (await call('GET', '/notifications', undefined, 'bob')).json<Page>()
        .unread
    ).toBe(1)
  })
})

describe('settings', () => {
  it('reads the defaults, then the choices made', async () => {
    const call = setUp()

    const before = await call('GET', '/notifications/settings')
    const put = await call('PUT', '/notifications/settings', {
      invitation: false,
      space_change: true
    })
    const after = await call('GET', '/notifications/settings')

    expect(before.json()).toEqual({
      settings: {
        card_mention: true,
        message_mention: true,
        assignment: true,
        invitation: true,
        attended_event_change: true,
        space_change: false
      }
    })
    expect(put.statusCode).toBe(204)
    expect(after.json()).toMatchObject({
      settings: { invitation: false, space_change: true, card_mention: true }
    })
  })

  it('refuses an unknown type', async () => {
    const response = await setUp()('PUT', '/notifications/settings', {
      newsletter: true
    })

    expect(response.statusCode).toBe(400)
  })
})
