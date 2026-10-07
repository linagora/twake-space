import { pino } from 'pino'
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest'
import type { PlatformEvent } from '../../events/envelope.ts'
import { MalformedEventError } from '../../events/router.ts'
import { createTestDb, type TestDb } from '../../infra/testing.ts'
import { settingsPlatformRoutes } from './events.ts'
import { userSettings } from './schema.ts'

const log = pino({ level: 'silent' })

let testDb: TestDb
beforeAll(async () => {
  testDb = await createTestDb()
})
afterAll(() => testDb.drop())

beforeEach(async () => {
  await testDb.db.delete(userSettings)
})

function updated(
  version: number,
  payload: Record<string, unknown>,
  nickname = 'alice'
) {
  const handler = settingsPlatformRoutes.get('user.settings.updated')
  if (!handler) throw new Error('no handler for user.settings.updated')
  const event: PlatformEvent = {
    routingKey: 'user.settings.updated',
    messageId: `req-${nickname}-${String(version)}`,
    body: {
      source: 'registration',
      nickname,
      request_id: `req-${nickname}-${String(version)}`,
      timestamp: 1718897400000,
      version,
      payload: { nickname, version, ...payload }
    }
  }
  return testDb.db.transaction(tx => handler(event, tx, log))
}

const stored = () =>
  testDb.db
    .select({
      email: userSettings.email,
      nickname: userSettings.nickname,
      version: userSettings.version,
      settings: userSettings.settings
    })
    .from(userSettings)

it('keeps the settings TwakeSpace applies, under the lowercased email', async () => {
  await updated(3, {
    email: 'Alice@Example.com',
    language: 'fr',
    timezone: 'Europe/Paris',
    theme: 'dark',
    avatar: 'https://alice.example.com/avatar.png',
    display_name: 'Alice Martin',
    phone: '+33612345678'
  })

  expect(await stored()).toEqual([
    {
      email: 'alice@example.com',
      nickname: 'alice',
      version: 3,
      settings: {
        language: 'fr',
        timezone: 'Europe/Paris',
        theme: 'dark',
        avatar: 'https://alice.example.com/avatar.png',
        displayName: 'Alice Martin'
      }
    }
  ])
})

it('replaces the settings with a newer version, all fields at once', async () => {
  await updated(1, { email: 'alice@example.com', language: 'fr' })
  await updated(2, { email: 'alice@example.com', timezone: 'Asia/Tokyo' })

  expect(await stored()).toMatchObject([
    { version: 2, settings: { timezone: 'Asia/Tokyo' } }
  ])
  expect((await stored())[0]?.settings).not.toHaveProperty('language')
})

it('drops a version it already holds or an older one', async () => {
  await updated(2, { email: 'alice@example.com', language: 'fr' })
  await updated(2, { email: 'alice@example.com', language: 'de' })
  await updated(1, { email: 'alice@example.com', language: 'it' })

  expect(await stored()).toMatchObject([
    { version: 2, settings: { language: 'fr' } }
  ])
})

it('leaves out a theme or field it does not know', async () => {
  await updated(1, {
    email: 'alice@example.com',
    theme: 'sepia',
    language: 42
  })

  expect((await stored())[0]?.settings).toEqual({})
})

it('takes the settings of another account behind the same email, whatever its version', async () => {
  await updated(5, { email: 'alice@example.com', language: 'fr' })
  await updated(1, { email: 'alice@example.com', language: 'de' }, 'alice2')

  expect(await stored()).toMatchObject([
    { nickname: 'alice2', version: 1, settings: { language: 'de' } }
  ])
})

it('leaves out an avatar that is not a web address', async () => {
  await updated(1, {
    email: 'alice@example.com',
    avatar: 'javascript:alert(1)'
  })
  expect((await stored())[0]?.settings).toEqual({})

  await updated(2, {
    email: 'alice@example.com',
    avatar: 'https://alice.example.com/public/avatar'
  })
  expect((await stored())[0]?.settings).toEqual({
    avatar: 'https://alice.example.com/public/avatar'
  })
})

it('drops settings without an email, which match no one', async () => {
  await expect(updated(1, { language: 'fr' })).rejects.toBeInstanceOf(
    MalformedEventError
  )
})
