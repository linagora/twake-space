import { randomUUID } from 'node:crypto'
import { pino } from 'pino'
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import type { CloudEvent, PlatformEvent } from '../../events/envelope.ts'
import { createTestDb, type TestDb } from '../../infra/testing.ts'
import { notifyRecipients } from '../notifications/recipients.ts'
import { spacePlatformRoutes } from '../spaces/events.ts'
import { resourceActivityRoutes } from '../spaces/resources.ts'
import { listenForLive } from './notify.ts'

const SPACE_ID = '3b9e2c71-5d4a-4f0e-9c8b-1a2d6e7f8091'
const ALICE = '8f14e45f-ceea-467a-9575-1d1c2b0c4b2e'
const BOB = 'c9f0f895-fb98-4b91-a1a4-7f3e2d1c0b5a'
const alice = {
  uuid: ALICE,
  username: 'alice',
  email: 'alice@example.com',
  role: 'admin'
}
const bob = {
  uuid: BOB,
  username: 'bob',
  email: 'bob@example.com',
  role: 'viewer'
}
const log = pino({ level: 'silent' })

let testDb: TestDb
const send = vi.fn()
beforeAll(async () => {
  testDb = await createTestDb()
  await listenForLive(testDb.sql, { send })
})
afterAll(() => testDb.drop())

let at = 0
const next = () => new Date(Date.UTC(2026, 9, 5, 9, 0, at++)).toISOString()

beforeEach(async () => {
  await handle('twake.space.created', {
    organizationId: 'org-1',
    id: SPACE_ID,
    name: 'Design',
    members: [alice, bob],
    timestamp: next()
  })
  await vi.waitFor(() => {
    expect(send).toHaveBeenCalledTimes(2)
  })
  send.mockClear()
})

function handle(routingKey: string, body: unknown) {
  const handler = spacePlatformRoutes.get(routingKey)
  if (!handler) throw new Error(`no handler for ${routingKey}`)
  const event: PlatformEvent = { routingKey, messageId: 'msg-1', body }
  return testDb.db.transaction(tx => handler(event, tx, log))
}

async function told(count: number) {
  await vi.waitFor(() => {
    expect(send).toHaveBeenCalledTimes(count)
  })
  return send.mock.calls
}

const space = { spaceId: SPACE_ID }

it('tells members their role changed', async () => {
  await handle('twake.space.member.role.changed', {
    organizationId: 'org-1',
    id: SPACE_ID,
    members: [{ ...bob, role: 'editor' }],
    timestamp: next()
  })

  expect(await told(1)).toEqual([[BOB, 'spaces', space]])
})

it('tells a removed member', async () => {
  await handle('twake.space.member.removed', {
    organizationId: 'org-1',
    id: SPACE_ID,
    members: [{ uuid: BOB, username: 'bob', email: 'bob@example.com' }],
    timestamp: next()
  })

  expect(await told(1)).toEqual([[BOB, 'spaces', space]])
})

it('tells every member when the space is deleted', async () => {
  await handle('twake.space.deleted', {
    organizationId: 'org-1',
    id: SPACE_ID,
    timestamp: next()
  })

  expect(await told(2)).toEqual(
    expect.arrayContaining([
      [ALICE, 'spaces', space],
      [BOB, 'spaces', space]
    ])
  )
})

it('tells every member when a group role changes', async () => {
  await handle('twake.space.group.linked', {
    organizationId: 'org-1',
    id: SPACE_ID,
    groups: [{ id: randomUUID(), name: 'Designers', role: 'editor' }],
    timestamp: next()
  })

  expect(await told(2)).toHaveLength(2)
})

it('tells every member when a resource is ready', async () => {
  const type = 'com.twake.drive.space.provisioned.v1'
  const handler = resourceActivityRoutes.get(type)
  if (!handler) throw new Error(`no handler for ${type}`)
  const event: CloudEvent = {
    specversion: '1.0',
    id: randomUUID(),
    source: 'twake://drive',
    type,
    twakeorg: 'org-1',
    data: { space_id: SPACE_ID, resource: { kind: 'drive', id: 'folder-1' } }
  }

  await testDb.db.transaction(tx => handler(event, tx, log))

  expect(await told(2)).toEqual(
    expect.arrayContaining([
      [ALICE, 'spaces', space],
      [BOB, 'spaces', space]
    ])
  )
})

it('tells a recipient about a new notification', async () => {
  await testDb.db.transaction(tx =>
    notifyRecipients(
      tx,
      log,
      { id: randomUUID(), organizationId: 'org-1', spaceId: SPACE_ID },
      [{ uuid: BOB, email: 'bob@example.com', reason: 'mentioned' }]
    )
  )

  expect(await told(1)).toEqual([[BOB, 'notification', {}]])
})
