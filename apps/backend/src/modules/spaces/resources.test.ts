import { pino } from 'pino'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { CloudEvent } from '../../events/envelope.ts'
import { lastChanges } from '../../events/schema.ts'
import {
  MalformedEventError,
  NotYetKnownError,
  RejectedEventError
} from '../../events/router.ts'
import { createTestDb, type TestDb } from '../../infra/testing.ts'
import { resourceActivityRoutes } from './resources.ts'
import { spaceResources, spaces } from './schema.ts'

const SPACE_ID = '3b9e2c71-5d4a-4f0e-9c8b-1a2d6e7f8091'

let testDb: TestDb
beforeAll(async () => {
  testDb = await createTestDb()
})
afterAll(() => testDb.drop())
beforeEach(async () => {
  await testDb.db.delete(spaceResources)
  await testDb.db.delete(lastChanges)
  await testDb.db.delete(spaces)
  await testDb.db
    .insert(spaces)
    .values({ spaceId: SPACE_ID, organizationId: 'linagora', name: 'Design' })
})

function provisioned(
  app: string,
  resource: Record<string, unknown>,
  overrides: Partial<CloudEvent> = {}
) {
  const type = `com.twake.${app}.space.provisioned.v1`
  const handler = resourceActivityRoutes.get(type)
  if (!handler) throw new Error(`no handler for ${type}`)
  const event: CloudEvent = {
    specversion: '1.0',
    id: '01J9Z7A2B3C4D5E6F7G8H9J0KM',
    source: `twake://${app}`,
    type,
    twakeorg: 'linagora',
    data: { space_id: SPACE_ID, resource },
    ...overrides
  }
  return testDb.db.transaction(tx =>
    handler(event, tx, pino({ level: 'silent' }))
  )
}

const readResources = () =>
  testDb.db
    .select({
      spaceId: spaceResources.spaceId,
      kind: spaceResources.kind,
      organizationId: spaceResources.organizationId,
      resourceId: spaceResources.resourceId
    })
    .from(spaceResources)

describe('provisioned events', () => {
  it('does not bring back a resource of a space deleted after the event', async () => {
    await testDb.db.delete(spaces)
    await testDb.db.insert(lastChanges).values({
      object: `space:${SPACE_ID}`,
      at: new Date('2026-10-05T10:00:00Z')
    })

    await provisioned(
      'drive',
      { kind: 'drive', id: 'a1f0c3e2d4b5' },
      { time: '2026-10-05T09:30:00Z' }
    )

    expect(await readResources()).toEqual([])
  })

  it('waits for a space it does not know yet', async () => {
    await testDb.db.delete(spaces)

    await expect(
      provisioned('drive', { kind: 'drive', id: 'a1f0c3e2d4b5' })
    ).rejects.toBeInstanceOf(NotYetKnownError)
  })

  it('rejects a resource sent for a space of another organization', async () => {
    await expect(
      provisioned(
        'drive',
        { kind: 'drive', id: 'a1f0c3e2d4b5' },
        { twakeorg: 'globex' }
      )
    ).rejects.toBeInstanceOf(RejectedEventError)
    expect(await readResources()).toEqual([])
  })

  it('stores the resource id of a space', async () => {
    await provisioned('drive', { kind: 'drive', id: 'a1f0c3e2d4b5' })

    expect(await readResources()).toEqual([
      {
        spaceId: SPACE_ID,
        kind: 'drive',
        organizationId: 'linagora',
        resourceId: 'a1f0c3e2d4b5'
      }
    ])
  })

  it('stores the tasks resource, whose id is the space id', async () => {
    await provisioned('tasks', { kind: 'tasks', id: SPACE_ID })

    expect(await readResources()).toMatchObject([
      { kind: 'tasks', resourceId: SPACE_ID }
    ])
  })

  it('keeps one resource per kind when provisioned again', async () => {
    await provisioned('mail', { kind: 'mailbox', id: 'team-1' })
    await provisioned('mail', { kind: 'mailbox', id: 'team-2' })

    expect(await readResources()).toMatchObject([{ resourceId: 'team-2' }])
  })

  it('refuses an unknown kind', async () => {
    await expect(
      provisioned('drive', { kind: 'matrix_room', id: 'x' })
    ).rejects.toBeInstanceOf(MalformedEventError)
  })

  it("refuses a kind that is not the app's own", async () => {
    await expect(
      provisioned('drive', { kind: 'mailbox', id: 'team-1' })
    ).rejects.toBeInstanceOf(MalformedEventError)
  })

  it('refuses a provisioned event without an organization', async () => {
    await expect(
      provisioned('drive', { kind: 'drive', id: 'a1' }, { twakeorg: undefined })
    ).rejects.toBeInstanceOf(MalformedEventError)
  })

  it('ignores a provisioned event older than the last one', async () => {
    await provisioned(
      'drive',
      { kind: 'drive', id: 'new' },
      { time: '2026-10-05T10:00:00Z' }
    )

    await provisioned(
      'drive',
      { kind: 'drive', id: 'old' },
      { time: '2026-10-05T09:00:00Z' }
    )

    expect(await readResources()).toMatchObject([{ resourceId: 'new' }])
  })
})
