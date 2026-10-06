import { sql } from 'drizzle-orm'
import { pino } from 'pino'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createTestDb, type TestDb } from '../infra/testing.ts'
import { postgresDeduplicator } from './dedupe.ts'
import type { CloudEvent } from './envelope.ts'
import {
  createMessageHandler,
  type DeadLetter,
  type Handler
} from './router.ts'

let testDb: TestDb
beforeAll(async () => {
  testDb = await createTestDb()
})
afterAll(() => testDb.drop())

let next = 0
function fileCreated() {
  next += 1
  return {
    value: Buffer.from(
      JSON.stringify({
        specversion: '1.0',
        id: `evt-${String(next)}`,
        source: 'twake://drive',
        type: 'com.twake.drive.file.created.v1',
        data: {}
      })
    ),
    offset: String(next)
  }
}

function setup(handler: Handler<CloudEvent>) {
  const deadLetter = vi.fn<DeadLetter>().mockResolvedValue()
  const handle = createMessageHandler({
    routes: {
      activity: new Map([['com.twake.drive.file.created.v1', handler]]),
      platform: new Map()
    },
    dedupe: postgresDeduplicator(testDb.db, 'twake-space'),
    deadLetter,
    logger: pino({ level: 'silent' })
  })
  return { handle, deadLetter }
}

describe('postgresDeduplicator', () => {
  it('sends an event Postgres refuses to store to the dead letter topic', async () => {
    const { handle, deadLetter } = setup(async (_event, tx) => {
      await tx.execute(sql`select ${'{"preview":"\\u0000"}'}::jsonb`)
    })
    const incoming = fileCreated()

    expect(await handle('twake.drive.events.v1', incoming)).toBe('rejected')
    expect(deadLetter).toHaveBeenCalledWith(
      'twake.drive.events.v1.dlq.twake-space',
      incoming,
      expect.stringContaining('22P05')
    )
  })
})
