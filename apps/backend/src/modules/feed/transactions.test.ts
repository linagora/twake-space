import { randomBytes } from 'node:crypto'
import { asc } from 'drizzle-orm'
import { pino } from 'pino'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createServer } from '../../infra/http.ts'
import { createTestDb, type TestDb } from '../../infra/testing.ts'
import { configureHomeserver } from '../organizations/homeservers.ts'
import { homeservers, organizations } from '../organizations/schema.ts'
import { spaceResources, spaces } from '../spaces/schema.ts'
import {
  appServiceTransactions,
  feedMessages,
  feedReactions
} from './schema.ts'
import { registerTransactionRoutes } from './transactions.ts'

const DESIGN = '3b9e2c71-5d4a-4f0e-9c8b-1a2d6e7f8091'
const ROOM = '!design:example.com'
const KEY = randomBytes(32)

let testDb: TestDb
beforeAll(async () => {
  testDb = await createTestDb()
})
afterAll(() => testDb.drop())

beforeEach(async () => {
  const { db } = testDb
  for (const table of [
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
})

function setUp() {
  const app = createServer({
    logger: pino({ level: 'silent' }),
    isReady: () => Promise.resolve(true)
  })
  registerTransactionRoutes(app, { db: testDb.db })
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
})
