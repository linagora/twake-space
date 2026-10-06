import { afterAll, beforeAll, expect, it, vi } from 'vitest'
import { createTestDb, type TestDb } from '../../infra/testing.ts'
import { listenForLive, tell, tellEmail } from './notify.ts'

let testDb: TestDb
beforeAll(async () => {
  testDb = await createTestDb()
})
afterAll(() => testDb.drop())

const ALICE = '8f14e45f-ceea-467a-9575-1d1c2b0c4b2e'
const BOB = 'c9f0f895-fb98-4b91-a1a4-7f3e2d1c0b5a'

it('reaches every replica once the change is committed', async () => {
  const send = vi.fn()
  await listenForLive(testDb.sql, { send, sendToEmail: vi.fn() })

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

it('reaches the streams of an email', async () => {
  const sendToEmail = vi.fn()
  await listenForLive(testDb.sql, { send: vi.fn(), sendToEmail })

  await testDb.db.transaction(tx =>
    tellEmail(tx, 'settings', 'alice@example.com')
  )

  await vi.waitFor(() => {
    expect(sendToEmail).toHaveBeenCalledWith(
      'alice@example.com',
      'settings',
      {}
    )
  })
})

it('splits a large audience under the notification size limit', async () => {
  const send = vi.fn()
  await listenForLive(testDb.sql, { send, sendToEmail: vi.fn() })
  const everyone = Array.from(
    { length: 500 },
    (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`
  )

  await testDb.db.transaction(tx => tell(tx, 'notification', everyone, {}))

  await vi.waitFor(() => {
    expect(send).toHaveBeenCalledTimes(500)
  })
})
