import { pino } from 'pino'
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest'
import { parkedEvents } from '../../events/schema.ts'
import { createServer } from '../../infra/http.ts'
import { consumerStats } from '../../infra/amqp.ts'
import { createTestDb, type TestDb } from '../../infra/testing.ts'
import { registerMetrics } from './metrics.ts'

let testDb: TestDb
beforeAll(async () => {
  testDb = await createTestDb()
})
afterAll(() => testDb.drop())

beforeEach(async () => {
  await testDb.db.delete(parkedEvents)
})

it('counts messages by outcome and the parked events', async () => {
  await testDb.db.insert(parkedEvents).values({
    source: 'twake://drive',
    id: 'e-late',
    exchange: 'activity',
    routingKey: 'com.twake.drive.file.created.v1',
    body: {},
    reason: 'unknown space'
  })
  const stats = consumerStats()
  stats.ended('processed')
  stats.ended('processed')
  stats.ended('failed')
  const app = createServer({
    logger: pino({ level: 'silent' }),
    isReady: () => Promise.resolve(true)
  })
  registerMetrics(app, { db: testDb.db, consumer: stats })

  const response = await app.inject({ method: 'GET', url: '/metrics' })

  expect(response.statusCode).toBe(200)
  expect(response.headers['content-type']).toMatch(
    /^text\/plain; version=0\.0\.4/
  )
  expect(response.body).toBe(
    [
      '# HELP twake_space_events_total Messages handled, by outcome.',
      '# TYPE twake_space_events_total counter',
      'twake_space_events_total{outcome="processed"} 2',
      'twake_space_events_total{outcome="failed"} 1',
      '# HELP twake_space_parked_events Events waiting for a space or member.',
      '# TYPE twake_space_parked_events gauge',
      'twake_space_parked_events 1',
      ''
    ].join('\n')
  )
})
