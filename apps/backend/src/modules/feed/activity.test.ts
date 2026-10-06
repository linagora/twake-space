import { pino } from 'pino'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { CloudEvent } from '../../events/envelope.ts'
import { NotYetKnownError, RejectedEventError } from '../../events/router.ts'
import { createTestDb, type TestDb } from '../../infra/testing.ts'
import { notifications, notificationSettings } from '../notifications/schema.ts'
import {
  spaceGroups,
  spaceMembers,
  spaceResources,
  spaces
} from '../spaces/schema.ts'
import { activityRoute } from './activity.ts'
import { activityEvents } from './schema.ts'

const SPACE_ID = '3b9e2c71-5d4a-4f0e-9c8b-1a2d6e7f8091'
const ALICE = '8f14e45f-ceea-467a-9575-1d1c2b0c4b2e'
const BOB = '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f'

let testDb: TestDb
beforeAll(async () => {
  testDb = await createTestDb()
})
afterAll(() => testDb.drop())
beforeEach(async () => {
  const { db } = testDb
  await db.delete(activityEvents)
  await db.delete(spaceGroups)
  await db.delete(spaceMembers)
  await db.delete(spaceResources)
  await db.delete(spaces)
  await db
    .insert(spaces)
    .values({ spaceId: SPACE_ID, organizationId: 'linagora', name: 'Design' })
  await db.insert(spaceResources).values({
    spaceId: SPACE_ID,
    kind: 'drive',
    organizationId: 'linagora',
    resourceId: 'drive-1'
  })
  await db.insert(spaceMembers).values({
    spaceId: SPACE_ID,
    userId: ALICE,
    username: 'alice',
    email: 'alice@linagora.com',
    role: 'editor'
  })
})

function anEvent(overrides: Record<string, unknown> = {}): CloudEvent {
  return {
    specversion: '1.0',
    id: '01J9Z6K4X8M2Q7R5T3V1W0Y9AB',
    source: 'twake://drive',
    type: 'com.twake.drive.file.created.v1',
    time: '2026-10-05T09:14:22Z',
    twakeorg: 'linagora',
    twakeactorid: ALICE,
    twakeactor: 'alice@linagora.com',
    data: {
      object: {
        type: 'file',
        id: 'f1',
        container: { kind: 'drive', id: 'drive-1' },
        title: 'Roadmap.odt',
        url: 'https://drive.example.com/f1'
      },
      preview: 'First draft'
    },
    ...overrides
  }
}

function store(event: CloudEvent) {
  const handler = activityRoute.get(event.type)
  if (!handler) throw new Error(`no handler for ${event.type}`)
  return testDb.db.transaction(tx =>
    handler(event, tx, pino({ level: 'silent' }))
  )
}

const stored = () =>
  testDb.db
    .select({
      source: activityEvents.source,
      eventId: activityEvents.eventId,
      organizationId: activityEvents.organizationId,
      spaceId: activityEvents.spaceId,
      type: activityEvents.type,
      category: activityEvents.category,
      actor: activityEvents.actor,
      objectType: activityEvents.objectType,
      objectId: activityEvents.objectId,
      content: activityEvents.content,
      time: activityEvents.time
    })
    .from(activityEvents)

describe('activity events', () => {
  it('stores an event with its category, actor, object and preview', async () => {
    await store(anEvent())

    expect(await stored()).toEqual([
      {
        source: 'twake://drive',
        eventId: '01J9Z6K4X8M2Q7R5T3V1W0Y9AB',
        organizationId: 'linagora',
        spaceId: SPACE_ID,
        type: 'com.twake.drive.file.created.v1',
        category: 'files',
        actor: { type: 'user', id: ALICE, email: 'alice@linagora.com' },
        objectType: 'file',
        objectId: 'f1',
        content: {
          object: {
            type: 'file',
            id: 'f1',
            container: { kind: 'drive', id: 'drive-1' },
            title: 'Roadmap.odt',
            url: 'https://drive.example.com/f1'
          },
          preview: 'First draft'
        },
        time: new Date('2026-10-05T09:14:22Z')
      }
    ])
  })

  it.each([
    ['mail', 'message.received', 'messages'],
    ['calendar', 'event.accepted', 'events'],
    ['tasks', 'task.moved', 'activities'],
    ['meet', 'call.started', 'activities']
  ])('files %s %s under %s', async (app, action, category) => {
    await store(anEvent({ type: `com.twake.${app}.${action}.v1` }))

    expect((await stored())[0]?.category).toBe(category)
  })

  it('finds an actor sent by email only among the space members', async () => {
    await store(anEvent({ twakeactorid: undefined }))

    expect((await stored())[0]?.actor).toEqual({
      type: 'user',
      id: ALICE,
      email: 'alice@linagora.com'
    })
  })

  it('stores the token an organization token action names', async () => {
    const event = anEvent({ twakeactorid: undefined, twakeactor: undefined })
    event.data.actor = { type: 'token', id: 't1', name: 'CI bot' }

    await store(event)

    expect((await stored())[0]?.actor).toEqual({
      type: 'token',
      id: 't1',
      name: 'CI bot'
    })
  })

  it('stores an event outside any space for notifications only', async () => {
    const event = anEvent({ twakeorg: undefined, twakeactorid: BOB })
    event.data.object = { type: 'file', id: 'f2', title: 'Taxes', url: 'u' }

    await store(event)

    expect(await stored()).toMatchObject([
      { spaceId: null, organizationId: null, actor: { id: BOB } }
    ])
  })

  it('cuts a preview longer than 280 characters', async () => {
    const event = anEvent()
    event.data.preview = 'a'.repeat(300)

    await store(event)

    expect((await stored())[0]?.content).toMatchObject({
      preview: 'a'.repeat(280)
    })
  })

  it('rejects an event whose organization is not the space one', async () => {
    await expect(store(anEvent({ twakeorg: 'acme' }))).rejects.toThrow(
      RejectedEventError
    )
    expect(await stored()).toEqual([])
  })

  it('keeps an event on a resource no space has for notifications only', async () => {
    const event = anEvent()
    event.data.object = {
      ...event.data.object,
      container: { kind: 'drive', id: 'my-own-drive' }
    }

    await store(event)

    expect(await stored()).toMatchObject([
      { spaceId: null, organizationId: 'linagora' }
    ])
  })

  it('matches the resource by its kind as well as its id', async () => {
    const event = anEvent()
    event.data.object = {
      ...event.data.object,
      container: { kind: 'calendar', id: 'drive-1' }
    }

    await store(event)

    expect((await stored())[0]?.spaceId).toBeNull()
  })

  it('files a Tasks event under the space of its project', async () => {
    await testDb.db.insert(spaceResources).values({
      spaceId: SPACE_ID,
      kind: 'project',
      organizationId: 'linagora',
      resourceId: 'project-7'
    })
    const event = anEvent({ type: 'com.twake.tasks.task.moved.v1' })
    event.data.object = {
      ...event.data.object,
      container: { kind: 'project', id: 'project-7' }
    }

    await store(event)

    expect((await stored())[0]?.spaceId).toBe(SPACE_ID)
  })

  it('waits for an actor who is not a member of the space yet', async () => {
    await expect(
      store(anEvent({ twakeactorid: BOB, twakeactor: 'bob@linagora.com' }))
    ).rejects.toThrow(NotYetKnownError)
  })

  it('lets a non-member act in a space with linked groups', async () => {
    await testDb.db.insert(spaceGroups).values({
      spaceId: SPACE_ID,
      groupId: '6d5c4b3a-2918-4f7e-8d6c-5b4a39281706',
      name: 'Designers',
      role: 'editor'
    })

    await store(anEvent({ twakeactorid: BOB, twakeactor: 'bob@linagora.com' }))

    expect((await stored())[0]?.actor).toEqual({
      type: 'user',
      id: BOB,
      email: 'bob@linagora.com'
    })
  })

  it('makes no card from chat or provisioned events', () => {
    expect(
      activityRoute.get('com.twake.chat.message.posted.v1')
    ).toBeUndefined()
    expect(
      activityRoute.get('com.twake.meet.space.provisioned.v1')
    ).toBeUndefined()
    expect(activityRoute.get('com.acme.drive.file.created.v1')).toBeUndefined()
  })
})

describe('notifications', () => {
  const readNotifications = () =>
    testDb.db
      .select({
        userId: notifications.userId,
        type: notifications.type,
        spaceId: notifications.spaceId,
        organizationId: notifications.organizationId
      })
      .from(notifications)
      .orderBy(notifications.type)

  beforeEach(async () => {
    await testDb.db.delete(notifications)
    await testDb.db.delete(notificationSettings)
  })

  function withRecipients(recipients: unknown[], type?: string) {
    const event = anEvent(type ? { type } : {})
    event.data.recipients = recipients
    return event
  }

  it('stores a replayed event and its notifications once', async () => {
    const event = withRecipients([
      { uuid: ALICE, email: 'alice@linagora.com', reason: 'mentioned' }
    ])

    await store(event)
    await store(event)

    expect(await stored()).toHaveLength(1)
    expect(await readNotifications()).toHaveLength(1)
  })

  it('notifies each recipient with the type of its reason', async () => {
    await store(
      withRecipients([
        { uuid: BOB, email: 'bob@linagora.com', reason: 'mentioned' },
        { uuid: BOB, email: 'bob@linagora.com', reason: 'invited' },
        { uuid: ALICE, email: 'alice@linagora.com', reason: 'attendee' }
      ])
    )

    expect(await readNotifications()).toEqual([
      {
        userId: BOB,
        type: 'card_mention',
        spaceId: SPACE_ID,
        organizationId: 'linagora'
      },
      {
        userId: BOB,
        type: 'invitation',
        spaceId: SPACE_ID,
        organizationId: 'linagora'
      },
      {
        userId: ALICE,
        type: 'attended_event_change',
        spaceId: SPACE_ID,
        organizationId: 'linagora'
      }
    ])
  })

  it('skips an invalid recipient and keeps the event and the others', async () => {
    await store(
      withRecipients([
        { uuid: BOB, email: 'bob@linagora.com', reason: 'cheered' },
        { uuid: ALICE, email: 'alice@linagora.com', reason: 'mentioned' }
      ])
    )

    expect(await stored()).toHaveLength(1)
    expect(await readNotifications()).toMatchObject([{ userId: ALICE }])
  })

  it('finds a recipient sent without a uuid by email', async () => {
    await store(
      withRecipients([{ email: 'alice@linagora.com', reason: 'mentioned' }])
    )

    expect(await readNotifications()).toMatchObject([{ userId: ALICE }])
  })

  it('skips a recipient it cannot find', async () => {
    await store(
      withRecipients([{ email: 'nobody@linagora.com', reason: 'mentioned' }])
    )

    expect(await readNotifications()).toEqual([])
  })

  describe('in another organization', () => {
    const OTHER_SPACE = '5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b'
    const CAROL = '2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e'
    beforeEach(async () => {
      await testDb.db.insert(spaces).values({
        spaceId: OTHER_SPACE,
        organizationId: 'globex',
        name: 'Sales'
      })
      await testDb.db.insert(spaceMembers).values({
        spaceId: OTHER_SPACE,
        userId: CAROL,
        username: 'carol',
        email: 'carol@globex.com',
        role: 'viewer'
      })
    })

    it('does not find a recipient by email', async () => {
      await store(
        withRecipients([{ email: 'carol@globex.com', reason: 'mentioned' }])
      )

      expect(await readNotifications()).toEqual([])
    })

    it('skips a recipient the copy knows only there', async () => {
      await store(
        withRecipients([
          { uuid: CAROL, email: 'carol@globex.com', reason: 'mentioned' }
        ])
      )

      expect(await readNotifications()).toEqual([])
    })
  })

  it('makes none from task events', async () => {
    await store(
      withRecipients(
        [{ uuid: BOB, email: 'bob@linagora.com', reason: 'mentioned' }],
        'com.twake.tasks.task.assigned.v1'
      )
    )

    expect(await readNotifications()).toEqual([])
  })

  it('leaves out a type the recipient turned off, and space changes by default', async () => {
    await testDb.db.insert(notificationSettings).values([
      { userId: BOB, type: 'card_mention', enabled: false },
      { userId: ALICE, type: 'space_change', enabled: true }
    ])

    await store(
      withRecipients([
        { uuid: BOB, email: 'bob@linagora.com', reason: 'mentioned' },
        { uuid: BOB, email: 'bob@linagora.com', reason: 'member' },
        { uuid: ALICE, email: 'alice@linagora.com', reason: 'member' }
      ])
    )

    expect(await readNotifications()).toMatchObject([
      { userId: ALICE, type: 'space_change' }
    ])
  })
})
