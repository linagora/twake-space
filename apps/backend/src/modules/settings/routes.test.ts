import { pino } from 'pino'
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest'
import { createServer } from '../../infra/http.ts'
import { createTestDb, type TestDb } from '../../infra/testing.ts'
import { aTokenCaller, anIdentity, fakeAuth } from '../auth/testing.ts'
import { registerSettingsRoutes } from './routes.ts'
import { userSettings } from './schema.ts'

let testDb: TestDb
beforeAll(async () => {
  testDb = await createTestDb()
})
afterAll(() => testDb.drop())

beforeEach(async () => {
  await testDb.db.delete(userSettings)
})

function get(token = 'alice') {
  const app = createServer({
    logger: pino({ level: 'silent' }),
    isReady: () => Promise.resolve(true)
  })
  const authorize = fakeAuth(
    app,
    t => (t === 'alice' ? anIdentity({ email: 'Alice@Example.com' }) : null),
    t => (t === 'tws_bot' ? aTokenCaller() : null)
  )
  registerSettingsRoutes(app, { db: testDb.db, authorize })
  return app.inject({
    method: 'GET',
    url: '/settings',
    headers: { authorization: `Bearer ${token}` }
  })
}

it('gives the caller their common settings, found by email', async () => {
  await testDb.db.insert(userSettings).values({
    email: 'alice@example.com',
    nickname: 'alice',
    version: 3,
    settings: { language: 'fr', theme: 'dark', displayName: 'Alice Martin' }
  })

  const response = await get()

  expect(response.statusCode).toBe(200)
  expect(response.json()).toEqual({
    language: 'fr',
    timezone: null,
    theme: 'dark',
    avatar: null,
    displayName: 'Alice Martin'
  })
})

it('gives nothing set to someone common settings has not told about', async () => {
  const response = await get()

  expect(response.json()).toEqual({
    language: null,
    timezone: null,
    theme: null,
    avatar: null,
    displayName: null
  })
})

it('serves a person, not an API token', async () => {
  expect((await get('tws_bot')).statusCode).toBe(403)
})
