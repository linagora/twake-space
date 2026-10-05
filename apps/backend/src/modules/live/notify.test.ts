import { afterAll, beforeAll, expect, it, vi } from 'vitest'
import { createTestDb, type TestDb } from '../../infra/testing.ts'
import { listenForLive, tell } from './notify.ts'

let testDb: TestDb
beforeAll(async () => {
  testDb = await createTestDb()
})
afterAll(() => testDb.drop())

const ALICE = '8f14e45f-ceea-467a-9575-1d1c2b0c4b2e'
const BOB = 'c9f0f895-fb98-4b91-a1a4-7f3e2d1c0b5a'

it('reaches every replica once the change is committed', async () => {
  const send = vi.fn()
  await listenForLive(testDb.sql, { send })

  await testDb.db
    .transaction(async tx => {
      await tell(tx, 'notification', [ALICE], {})
      tx.rollback()
    })
    .catch(() => undefined)
  await testDb.db.transaction(tx =>
    tell(tx, 'spaces', [ALICE, BOB], { spaceId: 'design' })
  )

  await vi.waitFor(() => {
    expect(send).toHaveBeenCalledTimes(2)
  })
  expect(send.mock.calls).toEqual([
    [ALICE, 'spaces', { spaceId: 'design' }],
    [BOB, 'spaces', { spaceId: 'design' }]
  ])
})

it('splits a large audience under the notification size limit', async () => {
  const send = vi.fn()
  await listenForLive(testDb.sql, { send })
  const everyone = Array.from(
    { length: 500 },
    (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`
  )

  await testDb.db.transaction(tx => tell(tx, 'notification', everyone, {}))

  await vi.waitFor(() => {
    expect(send).toHaveBeenCalledTimes(500)
  })
})
