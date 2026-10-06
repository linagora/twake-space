import { sql } from 'drizzle-orm'
import { pino } from 'pino'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createTestDb, type TestDb } from '../infra/testing.ts'
import { postgresDeduplicator } from './dedupe.ts'
import type { CloudEvent } from './envelope.ts'
import { createMessageHandler, type Handler } from './router.ts'

let testDb: TestDb
beforeAll(async () => {
  testDb = await createTestDb()
})
afterAll(() => testDb.drop())

let next = 0
function fileCreated() {
  next += 1
  return {
    exchange: 'activity',
    routingKey: 'com.twake.drive.file.created.v1',
    body: {
      specversion: '1.0',
      id: `evt-${String(next)}`,
      source: 'twake://drive',
      type: 'com.twake.drive.file.created.v1',
      data: {}
    }
  }
}

function setup(handler: Handler<CloudEvent>) {
  return createMessageHandler({
    routes: {
      activity: new Map([['com.twake.drive.file.created.v1', handler]]),
      platform: new Map()
    },
    dedupe: postgresDeduplicator(testDb.db, 'twake-space'),
    park: vi.fn(),
    logger: pino({ level: 'silent' })
  })
}

describe('postgresDeduplicator', () => {
  const key = () => ({ source: 'twake://drive', id: `k-${String(++next)}` })

  it('runs an event once, and once per consumer', async () => {
    const ours = postgresDeduplicator(testDb.db, 'twake-space')
    const theirs = postgresDeduplicator(testDb.db, 'other-consumer')
    const process = vi.fn(() => Promise.resolve())
    const event = key()

    const runs = [
      await ours.once(event, process),
      await ours.once(event, process),
      await theirs.once(event, process)
    ]

    expect(runs).toEqual([true, false, true])
    expect(process).toHaveBeenCalledTimes(2)
  })

  it('runs an event again when its first run failed', async () => {
    const dedupe = postgresDeduplicator(testDb.db, 'twake-space')
    const event = key()

    await expect(
      dedupe.once(event, () => Promise.reject(new Error('ldap-rest down')))
    ).rejects.toThrow('ldap-rest down')
    const retried = await dedupe.once(event, () => Promise.resolve())

    expect(retried).toBe(true)
  })

  it('keeps nothing a failed run wrote', async () => {
    const dedupe = postgresDeduplicator(testDb.db, 'twake-space')
    await testDb.sql`create table if not exists dedupe_probe (id text)`

    await dedupe
      .once(key(), async tx => {
        await tx.execute(sql`insert into dedupe_probe values ('half')`)
        throw new Error('crash')
      })
      .catch(() => undefined)

    expect(await testDb.sql`select * from dedupe_probe`).toHaveLength(0)
  })

  it('rejects an event Postgres refuses to store', async () => {
    const handle = setup(async (_event, tx) => {
      await tx.execute(sql`select ${'{"preview":"\\u0000"}'}::jsonb`)
    })

    expect(await handle(fileCreated())).toBe('rejected')
  })
})
