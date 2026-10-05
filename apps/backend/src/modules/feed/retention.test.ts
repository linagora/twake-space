import { randomBytes } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createTestDb, type TestDb } from '../../infra/testing.ts'
import { notifications } from '../notifications/schema.ts'
import { configureHomeserver } from '../organizations/homeservers.ts'
import { purgeExpired } from './retention.ts'
import {
  activityEvents,
  appServiceTransactions,
  feedMessages,
  feedReactions
} from './schema.ts'

const NOW = new Date('2026-10-05T12:00:00Z')
const daysAgo = (days: number) =>
  new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000)

let testDb: TestDb
beforeAll(async () => {
  testDb = await createTestDb()
})
afterAll(() => testDb.drop())
beforeEach(async () => {
  const { db } = testDb
  await db.delete(activityEvents)
  await db.delete(feedMessages)
  await db.delete(feedReactions)
  await db.delete(notifications)
})

async function seed(createdAt: Date, n: string) {
  const { db } = testDb
  const [event] = await db
    .insert(activityEvents)
    .values({
      source: 'twake://drive',
      eventId: `e${n}`,
      type: 'com.twake.drive.file.created.v1',
      category: 'files',
      objectType: 'file',
      objectId: 'f1',
      content: {},
      time: createdAt,
      createdAt
    })
    .returning()
  await db.insert(feedMessages).values({
    matrixEventId: `$m${n}`,
    organizationId: 'linagora',
    spaceId: '3b9e2c71-5d4a-4f0e-9c8b-1a2d6e7f8091',
    sender: '@alice:example.com',
    content: {},
    originServerTs: createdAt,
    createdAt
  })
  await db.insert(feedReactions).values({
    matrixEventId: `$r${n}`,
    targetEventId: `$m${n}`,
    sender: '@alice:example.com',
    key: '👍',
    createdAt
  })
  await db.insert(notifications).values({
    userId: '8f14e45f-ceea-467a-9575-1d1c2b0c4b2e',
    type: 'card_mention',
    activityEventId: event?.id,
    payload: {},
    createdAt
  })
}

const counts = async () => {
  const { db } = testDb
  return {
    events: await db.$count(activityEvents),
    messages: await db.$count(feedMessages),
    reactions: await db.$count(feedReactions),
    notifications: await db.$count(notifications)
  }
}

describe('purgeExpired', () => {
  it('deletes feed data past 12 months and notifications past 90 days', async () => {
    await seed(daysAgo(400), '1')
    await seed(daysAgo(100), '2')
    await seed(daysAgo(10), '3')

    expect(await purgeExpired(testDb.db, NOW)).toBe(true)

    expect(await counts()).toEqual({
      events: 2,
      messages: 2,
      reactions: 2,
      notifications: 1
    })
  })

  it('forgets app service transactions past 7 days', async () => {
    const homeserverId = await configureHomeserver(testDb.db, randomBytes(32), {
      url: 'https://matrix.example.com',
      serverName: 'example.com',
      asToken: 'as',
      hsToken: 'hs'
    })
    await testDb.db.insert(appServiceTransactions).values([
      { homeserverId, txnId: 'old', createdAt: daysAgo(8) },
      { homeserverId, txnId: 'recent', createdAt: daysAgo(6) }
    ])

    await purgeExpired(testDb.db, NOW)

    expect(
      await testDb.db
        .select({ txnId: appServiceTransactions.txnId })
        .from(appServiceTransactions)
    ).toEqual([{ txnId: 'recent' }])
  })

  it('leaves the purge to the replica already running it', async () => {
    await seed(daysAgo(400), '1')
    let release = () => {}
    const held = new Promise<void>(resolve => {
      release = resolve
    })
    let locked = () => {}
    const lockTaken = new Promise<void>(resolve => {
      locked = resolve
    })
    const other = testDb.db.transaction(async tx => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext('purge'))`)
      locked()
      await held
    })
    await lockTaken

    expect(await purgeExpired(testDb.db, NOW)).toBe(false)
    expect((await counts()).events).toBe(1)

    release()
    await other
  })
})
