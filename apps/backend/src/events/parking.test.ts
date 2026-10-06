import { sql } from 'drizzle-orm'
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
import { createTestDb, type TestDb } from '../infra/testing.ts'
import { postgresDeduplicator } from './dedupe.ts'
import type { PlatformEvent } from './envelope.ts'
import { parkIn, retryParked } from './parking.ts'
import {
  createMessageHandler,
  NotYetKnownError,
  type DeadLetter,
  type Handler
} from './router.ts'
import { parkedEvents } from './schema.ts'

let testDb: TestDb
beforeAll(async () => {
  testDb = await createTestDb()
})
afterAll(() => testDb.drop())
beforeEach(async () => {
  await testDb.db.delete(parkedEvents)
})

const log = pino({ level: 'silent' })
const topic = 'twake.platform.events.v1'

let next = 0
function memberAdded() {
  next += 1
  return {
    key: Buffer.from('space-1'),
    value: Buffer.from(JSON.stringify({ spaceId: 'space-1' })),
    offset: String(next),
    headers: {
      amqp_routing_key: Buffer.from('twake.space.member.added'),
      amqp_message_id: Buffer.from(`msg-${String(next)}`)
    }
  }
}

function setup() {
  const handler = vi
    .fn<Handler<PlatformEvent>>()
    .mockRejectedValue(new NotYetKnownError('unknown space space-1'))
  const deadLetter = vi.fn<DeadLetter>().mockResolvedValue()
  const handle = createMessageHandler({
    routes: {
      activity: new Map(),
      platform: new Map([['twake.space.member.added', handler]])
    },
    dedupe: postgresDeduplicator(testDb.db, 'twake-space'),
    deadLetter,
    park: parkIn(testDb.db),
    logger: log
  })
  const retry = () => retryParked(testDb.db, handle, deadLetter, log)
  return { handler, deadLetter, handle, retry }
}

const parked = () =>
  testDb.db.select({ id: parkedEvents.id }).from(parkedEvents)

describe('parked events', () => {
  it('handles a parked event once the copy holds what it waited for', async () => {
    const { handler, handle, retry } = setup()
    const message = memberAdded()

    expect(await handle(topic, message)).toBe('parked')
    expect(await parked()).toEqual([{ id: `msg-${message.offset}` }])

    handler.mockResolvedValueOnce()
    await retry()

    expect(handler).toHaveBeenLastCalledWith(
      {
        routingKey: 'twake.space.member.added',
        messageId: `msg-${message.offset}`,
        body: { spaceId: 'space-1' }
      },
      expect.anything(),
      expect.anything()
    )
    expect(await parked()).toEqual([])
  })

  it('keeps an event that still waits, or whose retry fails', async () => {
    const { handler, deadLetter, handle, retry } = setup()
    await handle(topic, memberAdded())

    await retry()
    handler.mockRejectedValueOnce(new Error('db down'))
    await retry()

    expect(await parked()).toHaveLength(1)
    expect(deadLetter).not.toHaveBeenCalled()
  })

  it('sends an event parked for over 5 minutes to the dead letter topic', async () => {
    const { deadLetter, handle, retry } = setup()
    const message = memberAdded()
    await handle(topic, message)
    await testDb.db.execute(
      sql`update parked_events set parked_at = now() - interval '6 minutes'`
    )

    await retry()

    expect(deadLetter).toHaveBeenCalledWith(
      'twake.platform.events.v1.dlq.twake-space',
      expect.objectContaining({
        key: message.key,
        value: message.value,
        headers: {
          amqp_routing_key: 'twake.space.member.added',
          amqp_message_id: `msg-${message.offset}`
        }
      }),
      'unknown space space-1'
    )
    expect(await parked()).toEqual([])
  })
})
