import { pino } from 'pino'
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest'
import { parkedEvents } from '../../events/schema.ts'
import { createServer } from '../../infra/http.ts'
import { consumerStats } from '../../infra/kafka.ts'
import { createTestDb, type TestDb } from '../../infra/testing.ts'
import { organizations } from '../organizations/schema.ts'
import { spaces } from '../spaces/schema.ts'
import { registerMetrics } from './metrics.ts'
import { activityEvents } from './schema.ts'

const DESIGN = '3b9e2c71-5d4a-4f0e-9c8b-1a2d6e7f8091'
const SALES = '9d1c7a52-0b3e-4f6a-8c2d-5e4f3a2b1c0d'
const HR = '6a1f3e2d-8c4b-4a5e-9f7d-2b3c4d5e6f70'

let testDb: TestDb
beforeAll(async () => {
  testDb = await createTestDb()
})
afterAll(() => testDb.drop())

beforeEach(async () => {
  const { db } = testDb
  for (const table of [parkedEvents, activityEvents, spaces, organizations]) {
    await db.delete(table)
  }
  await db.insert(organizations).values([
    { organizationId: 'acme', domain: 'acme.example.com', chatAvailable: true },
    {
      organizationId: 'globex',
      domain: 'globex.example.com',
      chatAvailable: true
    },
    { organizationId: 'initech', domain: 'initech.example.com' }
  ])
  await db.insert(spaces).values([
    { spaceId: DESIGN, organizationId: 'acme', name: 'Design' },
    { spaceId: SALES, organizationId: 'globex', name: 'Sales' },
    { spaceId: HR, organizationId: 'initech', name: 'HR' }
  ])
})

let n = 0
async function stored(spaceId: string, matrixEventId: string | null = null) {
  n += 1
  await testDb.db.insert(activityEvents).values({
    source: 'twake://drive',
    eventId: `e${String(n)}`,
    spaceId,
    type: 'com.twake.drive.file.created.v1',
    category: 'files',
    objectType: 'file',
    objectId: 'f1',
    content: {},
    time: new Date(),
    matrixEventId
  })
}

it('counts the events waiting to be posted, per organization with chat', async () => {
  await stored(DESIGN)
  await stored(DESIGN)
  await stored(DESIGN, '$posted')
  await stored(SALES, '$posted')
  await stored(HR)
  await testDb.db.insert(parkedEvents).values({
    topic: 'twake.drive.events.v1',
    source: 'twake://drive',
    id: 'e-late',
    value: '{}',
    headers: {},
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
      '# HELP twake_space_cards_waiting Stored events not posted to Matrix yet.',
      '# TYPE twake_space_cards_waiting gauge',
      'twake_space_cards_waiting{organization="acme"} 2',
      'twake_space_cards_waiting{organization="globex"} 0',
      '# HELP twake_space_events_total Kafka messages handled, by outcome.',
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
