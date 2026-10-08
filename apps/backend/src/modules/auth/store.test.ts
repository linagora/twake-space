import { pino } from 'pino'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createTestDb, type TestDb } from '../../infra/testing.ts'
import { listenInMemory } from '../live/testing.ts'
import { postgresAuthStore, scheduleRevocationSweep } from './store.ts'

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

  it('closes the streams of the revoked session', async () => {
    const closeSession = vi.fn()
    await listenInMemory({ send: vi.fn(), closeSession })

    await postgresAuthStore(testDb.db).revoke(
      'session-3',
      new Date(Date.now() + 60_000)
    )

    await vi.waitFor(() => {
      expect(closeSession).toHaveBeenCalledWith('session-3')
    })
  })

  it('closes the streams of a session revoked while the message was lost', async () => {
    vi.useFakeTimers({ toFake: ['setInterval'] })
    const closeSession = vi.fn()
    const stop = scheduleRevocationSweep(
      testDb.db,
      { sessions: () => ['session-1', 'session-open'], closeSession },
      pino({ level: 'silent' })
    )

    await vi.advanceTimersByTimeAsync(60_000)
    stop()
    vi.useRealTimers()

    await vi.waitFor(() => {
      expect(closeSession.mock.calls).toEqual([['session-1']])
    })
  })
})
