import { afterAll, beforeAll, expect, it, vi } from 'vitest'
import { createTestDb, type TestDb } from '../../infra/testing.ts'
import { tell, tellRevoked } from './notify.ts'
import { listenInMemory } from './testing.ts'

let testDb: TestDb
const replicas = [
  { send: vi.fn(), closeSession: vi.fn() },
  { send: vi.fn(), closeSession: vi.fn() }
]
beforeAll(async () => {
  testDb = await createTestDb()
  await listenInMemory(...replicas)
})
afterAll(() => testDb.drop())

const ALICE = '8f14e45f-ceea-467a-9575-1d1c2b0c4b2e'
const BOB = 'c9f0f895-fb98-4b91-a1a4-7f3e2d1c0b5a'

it('reaches every replica once the change is committed', async () => {
  await testDb.db
    .transaction(tx => {
      tell(tx, 'notification', [ALICE], {})
      return Promise.reject(new Error('rolled back'))
    })
    .catch(() => undefined)
  await testDb.db.transaction(async tx => {
    tell(tx, 'spaces', [ALICE, BOB, ALICE], { spaceId: 'design' })
    await tx.transaction(savepoint => {
      tell(savepoint, 'notification', [BOB], {})
      return Promise.resolve()
    })
    await tx
      .transaction(savepoint => {
        tell(savepoint, 'notification', [ALICE], {})
        return Promise.reject(new Error('rolled back'))
      })
      .catch(() => undefined)
  })

  for (const { send } of replicas) {
    await vi.waitFor(() => {
      expect(send.mock.calls).toEqual([
        [ALICE, 'spaces', { spaceId: 'design' }],
        [BOB, 'spaces', { spaceId: 'design' }],
        [BOB, 'notification', {}]
      ])
    })
  }
})

it('closes the revoked session on every replica', async () => {
  await testDb.db.transaction(tx => {
    tellRevoked(tx, 'session-1')
    return Promise.resolve()
  })

  for (const { closeSession } of replicas) {
    await vi.waitFor(() => {
      expect(closeSession).toHaveBeenCalledWith('session-1')
    })
  }
})
