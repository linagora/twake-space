import { randomBytes } from 'node:crypto'
import { asc } from 'drizzle-orm'
import { pino } from 'pino'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createServer } from '../../infra/http.ts'
import { createTestDb, type TestDb } from '../../infra/testing.ts'
import { configureHomeserver } from '../organizations/homeservers.ts'
import { homeservers, organizations } from '../organizations/schema.ts'
import { notifications, notificationSettings } from '../notifications/schema.ts'
import { spaceMembers, spaceResources, spaces } from '../spaces/schema.ts'
import {
  appServiceTransactions,
  feedMessages,
  feedReactions
} from './schema.ts'
import { registerTransactionRoutes } from './transactions.ts'

const DESIGN = '3b9e2c71-5d4a-4f0e-9c8b-1a2d6e7f8091'
const ROOM = '!design:example.com'
const KEY = randomBytes(32)
const ALICE = '8f14e45f-ceea-467a-9575-1d1c2b0c4b2e'
const BOB = 'c9f0f895-fb98-4b91-a1a4-7f3e2d1c0b5a'

let testDb: TestDb
beforeAll(async () => {
  testDb = await createTestDb()
})
afterAll(() => testDb.drop())

beforeEach(async () => {
  const { db } = testDb
  for (const table of [
    notifications,
    notificationSettings,
    spaceMembers,
    appServiceTransactions,
    feedReactions,
    feedMessages,
    spaceResources,
    spaces,
    organizations,
    homeservers
  ]) {
    await db.delete(table)
  }
  await db
    .insert(organizations)
    .values({ organizationId: 'acme', domain: 'acme.example.com' })
  await configureHomeserver(db, KEY, {
    url: 'https://matrix.example.com',
    serverName: 'example.com',
    asToken: 'as-secret',
    hsToken: 'hs-secret'
  })
  await db
    .insert(spaces)
    .values({ spaceId: DESIGN, organizationId: 'acme', name: 'Design' })
  await db.insert(spaceResources).values({
    spaceId: DESIGN,
    kind: 'matrix_space',
    organizationId: 'acme',
    resourceId: ROOM
  })
  await db.insert(spaceMembers).values([
    {
      spaceId: DESIGN,
      userId: ALICE,
      username: 'alice',
      email: 'alice@acme.example.com',
      role: 'editor'
    },
    {
      spaceId: DESIGN,
      userId: BOB,
      username: 'bob',
      email: 'robert@acme.example.com',
      role: 'viewer'
    }
  ])
})

function setUp(localpart: 'uid' | 'email' = 'uid') {
  const app = createServer({
    logger: pino({ level: 'silent' }),
    isReady: () => Promise.resolve(true)
  })
  registerTransactionRoutes(app, { db: testDb.db, localpart })
  return (
    txnId: string,
    events: object[],
    token: string | null = 'hs-secret'
  ) =>
    app.inject({
      method: 'PUT',
      url: `/_matrix/app/v1/transactions/${txnId}`,
      headers: token ? { authorization: `Bearer ${token}` } : {},
      payload: { events }
    })
}

let n = 0
function event(type: string, content: object, extra: object = {}) {
  n += 1
  return {
    type,
    event_id: `$e${String(n)}`,
    room_id: ROOM,
    sender: '@alice:example.com',
    origin_server_ts: Date.parse('2026-10-05T09:00:00Z') + n * 1000,
    content,
    ...extra
  }
}

const message = (body: string, extra: object = {}) =>
  event('m.room.message', { msgtype: 'm.text', body }, extra)

const readMessages = () =>
  testDb.db
    .select({
      matrixEventId: feedMessages.matrixEventId,
      organizationId: feedMessages.organizationId,
      spaceId: feedMessages.spaceId,
      sender: feedMessages.sender,
      content: feedMessages.content,
      editedContent: feedMessages.editedContent,
      redactedAt: feedMessages.redactedAt
    })
    .from(feedMessages)
    .orderBy(asc(feedMessages.originServerTs))

describe('PUT /_matrix/app/v1/transactions/:txnId', () => {
  it('stores the messages and reactions of a Matrix space', async () => {
    const put = setUp()
    const hello = message('hello')

    const response = await put('t1', [
      hello,
      event('m.reaction', {
        'm.relates_to': {
          rel_type: 'm.annotation',
          event_id: hello.event_id,
          key: '👍'
        }
      })
    ])

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({})
    expect(await readMessages()).toEqual([
      {
        matrixEventId: hello.event_id,
        organizationId: 'acme',
        spaceId: DESIGN,
        sender: '@alice:example.com',
        content: { msgtype: 'm.text', body: 'hello' },
        editedContent: null,
        redactedAt: null
      }
    ])
    expect(
      await testDb.db
        .select({
          targetEventId: feedReactions.targetEventId,
          key: feedReactions.key
        })
        .from(feedReactions)
    ).toEqual([{ targetEventId: hello.event_id, key: '👍' }])
  })

  it('applies edits by the sender and redactions', async () => {
    const put = setUp()
    const hello = message('hello')
    const edit = (body: string, sender = '@alice:example.com') =>
      message(`* ${body}`, {
        sender,
        content: {
          msgtype: 'm.text',
          body: `* ${body}`,
          'm.new_content': { msgtype: 'm.text', body },
          'm.relates_to': { rel_type: 'm.replace', event_id: hello.event_id }
        }
      })
    const bye = message('bye')

    await put('t1', [hello, bye])
    await put('t2', [
      edit('hello all'),
      edit('hijacked', '@mallory:example.com'),
      event('m.room.redaction', { redacts: bye.event_id })
    ])

    expect(await readMessages()).toMatchObject([
      {
        content: { body: 'hello' },
        editedContent: { body: 'hello all' },
        redactedAt: null
      },
      { content: { body: 'bye' }, redactedAt: expect.any(Date) as Date }
    ])
  })

  it('leaves the messages and reactions of another space to their own room', async () => {
    const SALES = '9d1c7a52-0b3e-4f6a-8c2d-5e4f3a2b1c0d'
    await testDb.db
      .insert(spaces)
      .values({ spaceId: SALES, organizationId: 'acme', name: 'Sales' })
    await testDb.db.insert(spaceResources).values({
      spaceId: SALES,
      kind: 'matrix_space',
      organizationId: 'acme',
      resourceId: '!sales:example.com'
    })
    const put = setUp()
    const hello = message('hello')
    const liked = event('m.reaction', {
      'm.relates_to': {
        rel_type: 'm.annotation',
        event_id: hello.event_id,
        key: '👍'
      }
    })
    await put('t1', [hello, liked])

    const fromSales = { room_id: '!sales:example.com' }
    await put('t2', [
      event('m.room.redaction', { redacts: hello.event_id }, fromSales),
      event('m.room.redaction', { redacts: liked.event_id }, fromSales),
      message('* edited', {
        ...fromSales,
        content: {
          msgtype: 'm.text',
          body: '* edited',
          'm.new_content': { msgtype: 'm.text', body: 'edited' },
          'm.relates_to': { rel_type: 'm.replace', event_id: hello.event_id }
        }
      })
    ])

    expect(await readMessages()).toMatchObject([
      { content: { body: 'hello' }, editedContent: null, redactedAt: null }
    ])
    expect(
      await testDb.db
        .select({ redactedAt: feedReactions.redactedAt })
        .from(feedReactions)
    ).toEqual([{ redactedAt: null }])
  })

  it('handles a transaction once', async () => {
    const put = setUp()
    const hello = message('hello')
    const bye = message('bye')

    await put('t1', [hello])
    await testDb.db.delete(feedMessages)
    const replay = await put('t1', [hello])
    await put('t2', [bye])

    expect(replay.statusCode).toBe(200)
    expect((await readMessages()).map(m => m.matrixEventId)).toEqual([
      bye.event_id
    ])
  })

  it('skips an event Postgres cannot store and keeps the others', async () => {
    const put = setUp()
    const bye = message('bye')

    const response = await put('t1', [message('nul \u0000 byte'), bye])

    expect(response.statusCode).toBe(200)
    expect((await readMessages()).map(m => m.matrixEventId)).toEqual([
      bye.event_id
    ])
  })

  it('ignores rooms that are not the Matrix space of a space', async () => {
    const put = setUp()

    await put('t1', [
      message('in a channel', { room_id: '!channel:example.com' })
    ])

    expect(await readMessages()).toEqual([])
  })

  it('needs the hs_token of the homeserver serving the organization', async () => {
    const put = setUp()

    const missing = await put('t1', [message('hello')], null)
    const wrong = await put('t2', [message('hello')], 'nope')

    expect(missing.statusCode).toBe(401)
    expect(missing.json()).toMatchObject({ errcode: 'M_UNAUTHORIZED' })
    expect(wrong.statusCode).toBe(403)
    expect(wrong.json()).toMatchObject({ errcode: 'M_FORBIDDEN' })
    expect(await readMessages()).toEqual([])
  })

  describe('mentions', () => {
    const mentioning = (...userIds: string[]) =>
      message('look', {
        content: {
          msgtype: 'm.text',
          body: 'look',
          'm.mentions': { user_ids: userIds }
        }
      })
    const mentioned = () =>
      testDb.db
        .select({
          userId: notifications.userId,
          type: notifications.type,
          spaceId: notifications.spaceId,
          matrixEventId: notifications.matrixEventId
        })
        .from(notifications)

    it('notifies the members a feed message mentions, never the sender', async () => {
      const look = mentioning(
        '@bob:example.com',
        '@alice:example.com',
        '@bob:elsewhere.com'
      )

      await setUp()('t1', [look])

      expect(await mentioned()).toEqual([
        {
          userId: BOB,
          type: 'message_mention',
          spaceId: DESIGN,
          matrixEventId: look.event_id
        }
      ])
    })

    it('reads the localpart from the email when configured so', async () => {
      await setUp('email')('t1', [
        mentioning('@bob:example.com'),
        mentioning('@robert:example.com')
      ])

      expect((await mentioned()).map(m => m.userId)).toEqual([BOB])
    })

    it('follows the member settings', async () => {
      await testDb.db
        .insert(notificationSettings)
        .values({ userId: BOB, type: 'message_mention', enabled: false })

      await setUp()('t1', [mentioning('@bob:example.com')])

      expect(await mentioned()).toEqual([])
    })
  })
})
