import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestDb, type TestDb } from '../../infra/testing.ts'
import { listenForRevocations, postgresAuthStore } from './store.ts'

let testDb: TestDb
beforeAll(async () => {
  testDb = await createTestDb()
})
afterAll(() => testDb.drop())

describe('revoke', () => {
  it('marks the session as revoked', async () => {
    const store = postgresAuthStore(testDb.db)

    await store.revoke('session-1', new Date(Date.now() + 60_000))

    expect(await store.isRevoked('session-1')).toBe(true)
    expect(await store.isRevoked('session-2')).toBe(false)
  })

  it('tells every listener which session was revoked', async () => {
    let notify: (sessionId: string) => void = () => undefined
    const revoked = new Promise<string>(resolve => (notify = resolve))
    await listenForRevocations(testDb.sql, notify)

    await postgresAuthStore(testDb.db).revoke(
      'session-3',
      new Date(Date.now() + 60_000)
    )

    await expect(revoked).resolves.toBe('session-3')
  })
})
