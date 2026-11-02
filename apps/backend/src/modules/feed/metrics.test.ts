import { pino } from 'pino'
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest'
import { parkedEvents } from '../../events/schema.ts'
import { consumerStats } from '../../infra/amqp.ts'
import { createTestDb, type TestDb } from '../../infra/testing.ts'
import { createMetricsServer } from './metrics.ts'

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
  stats.ended(stats.started(), 'processed')
  stats.ended(stats.started(), 'processed')
  stats.ended(stats.started(), 'failed')
  const app = createMetricsServer({
    logger: pino({ level: 'silent' }),
    db: testDb.db,
    consumer: stats
  })

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

it('offers the metrics only on a server of their own', async () => {
  expect(Object.keys(await import('./metrics.ts'))).toEqual([
    'createMetricsServer'
  ])
})
