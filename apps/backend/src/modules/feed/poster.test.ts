import { randomBytes } from 'node:crypto'
import { asc } from 'drizzle-orm'
import { pino } from 'pino'
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest'
import { createTestDb, type TestDb } from '../../infra/testing.ts'
import { configureHomeserver } from '../organizations/homeservers.ts'
import { homeservers, organizations } from '../organizations/schema.ts'
import { spaceResources, spaces } from '../spaces/schema.ts'
import { MatrixError, type Matrix } from '../../infra/matrix.ts'
import { postCards, posterState } from './poster.ts'
import { activityEvents } from './schema.ts'

const DESIGN = '3b9e2c71-5d4a-4f0e-9c8b-1a2d6e7f8091'
const SALES = '9d1c7a52-0b3e-4f6a-8c2d-5e4f3a2b1c0d'
const HR = '6a1f3e2d-8c4b-4a5e-9f7d-2b3c4d5e6f70'
const KEY = randomBytes(32)
const log = pino({ level: 'silent' })

let testDb: TestDb
beforeAll(async () => {
  testDb = await createTestDb()
})
afterAll(() => testDb.drop())

beforeEach(async () => {
  const { db } = testDb
  for (const table of [
    activityEvents,
    spaceResources,
    spaces,
    organizations,
    homeservers
  ]) {
    await db.delete(table)
  }
  await db.insert(organizations).values([
    { organizationId: 'acme', domain: 'acme.example.com', chatAvailable: true },
    { organizationId: 'globex', domain: 'globex.example.com' }
  ])
  await configureHomeserver(db, KEY, {
    url: 'https://matrix.example.com',
    serverName: 'example.com',
    asToken: 'as-secret',
    hsToken: 'hs-secret'
  })
  await db.insert(spaces).values([
    { spaceId: DESIGN, organizationId: 'acme', name: 'Design' },
    { spaceId: SALES, organizationId: 'acme', name: 'Sales' },
    { spaceId: HR, organizationId: 'globex', name: 'HR' }
  ])
  await db.insert(spaceResources).values(
    [DESIGN, SALES, HR].map(spaceId => ({
      spaceId,
      kind: 'matrix_space' as const,
      organizationId: spaceId === HR ? 'globex' : 'acme',
      resourceId: `!${spaceId}:example.com`
    }))
  )
})

let n = 0
async function stored(
  spaceId: string,
  minute: number,
  title = 'Q3 plan',
  object = { type: 'file', category: 'files' as const, id: '' }
) {
  n += 1
  const objectId = object.id || `f${String(n)}`
  await testDb.db.insert(activityEvents).values({
    source: 'twake://drive',
    eventId: `e${String(n)}`,
    organizationId: 'acme',
    spaceId,
    type: `com.twake.drive.${object.type}.changed.v1`,
    category: object.category,
    actor: { type: 'user', id: null, email: 'alice@acme.example.com' },
    objectType: object.type,
    objectId,
    content: {
      object: { type: object.type, id: objectId, title, url: 'https://drive' },
      preview: 'First draft'
    },
    time: new Date(`2026-10-05T09:${String(minute).padStart(2, '0')}:00Z`)
  })
}

const posted = () =>
  testDb.db
    .select({
      spaceId: activityEvents.spaceId,
      matrixEventId: activityEvents.matrixEventId
    })
    .from(activityEvents)
    .orderBy(asc(activityEvents.time))

function recording(fail: (roomId: string) => boolean = () => false) {
  const sent: {
    roomId: string
    type: string
    txnId: string
    content: object
  }[] = []
  const joined: string[] = []
  const matrix: Matrix = {
    send(homeserver, roomId, type, txnId, content) {
      expect(homeserver).toEqual({
        url: 'https://matrix.example.com',
        asToken: 'as-secret'
      })
      if (fail(roomId)) return Promise.reject(new Error('synapse down'))
      sent.push({ roomId, type, txnId, content })
      return Promise.resolve(`$card${String(sent.length)}`)
    },
    join(_homeserver, roomId) {
      if (fail(roomId)) return Promise.reject(new Error('not invited'))
      joined.push(roomId)
      return Promise.resolve()
    }
  }
  return { sent, joined, matrix }
}

describe('postCards', () => {
  it('posts each stored event as a card, oldest first, and keeps its Matrix id', async () => {
    await stored(DESIGN, 2, 'later')
    await stored(DESIGN, 1, 'earlier')
    const { sent, matrix } = recording()

    await postCards(testDb.db, KEY, matrix, log)

    const [rows, first] = [await posted(), sent[0]]
    expect(sent.map(s => s.content)).toMatchObject([
      { object: { title: 'earlier' } },
      { object: { title: 'later' } }
    ])
    expect(first).toEqual({
      roomId: `!${DESIGN}:example.com`,
      type: 'com.twake.feed.files',
      txnId: expect.any(String) as string,
      content: {
        type: 'com.twake.drive.file.changed.v1',
        id: expect.stringMatching(/^e\d+$/) as string,
        actor: { type: 'user', id: null, email: 'alice@acme.example.com' },
        object: {
          type: 'file',
          id: expect.any(String) as string,
          title: 'earlier',
          url: 'https://drive'
        },
        preview: 'First draft',
        state: {},
        body: 'earlier\nFirst draft',
        'm.mentions': {}
      }
    })
    expect(rows.map(r => r.matrixEventId)).toEqual(['$card1', '$card2'])
  })

  it('edits the first card of an object with each later event about it', async () => {
    await stored(DESIGN, 1, 'Q3 plan', {
      type: 'file',
      category: 'files',
      id: 'f-q3'
    })
    await stored(DESIGN, 2, 'Q3 plan v2', {
      type: 'file',
      category: 'files',
      id: 'f-q3'
    })
    const { sent, matrix } = recording()

    await postCards(testDb.db, KEY, matrix, log)

    const [, second, edit] = sent
    expect(sent).toHaveLength(3)
    expect(edit).toEqual({
      roomId: `!${DESIGN}:example.com`,
      type: 'com.twake.feed.files',
      txnId: `${second?.txnId ?? ''}.edit`,
      content: {
        ...second?.content,
        'm.new_content': second?.content,
        'm.relates_to': { rel_type: 'm.replace', event_id: '$card1' }
      }
    })
  })

  it('edits the first card, not the latest, when more events follow', async () => {
    const q3 = { type: 'file', category: 'files' as const, id: 'f-q3' }
    await stored(DESIGN, 1, 'Q3 plan', q3)
    await stored(DESIGN, 2, 'Q3 plan v2', q3)
    await stored(DESIGN, 3, 'Q3 plan v3', q3)
    const { sent, matrix } = recording()

    await postCards(testDb.db, KEY, matrix, log)

    expect(
      sent
        .filter(s => s.txnId.endsWith('.edit'))
        .map(
          s =>
            (s.content as { 'm.relates_to': { event_id: string } })[
              'm.relates_to'
            ].event_id
        )
    ).toEqual(['$card1', '$card1'])
  })

  it('uses the stored row id as transaction id, so a retry posts once', async () => {
    await stored(DESIGN, 1)
    const { sent, matrix } = recording()

    await postCards(testDb.db, KEY, matrix, log)

    const [row] = await testDb.db
      .select({ id: activityEvents.id })
      .from(activityEvents)
    expect(sent[0]?.txnId).toBe(row?.id)
  })

  it('stops a space at its first failure and lets other spaces post', async () => {
    await stored(DESIGN, 1)
    await stored(DESIGN, 2)
    await stored(SALES, 3)
    const down = recording(roomId => roomId.includes(DESIGN))

    await postCards(testDb.db, KEY, down.matrix, log)
    const afterFailure = await posted()
    await postCards(testDb.db, KEY, recording().matrix, log)

    expect(afterFailure.map(r => [r.spaceId, r.matrixEventId])).toEqual([
      [DESIGN, null],
      [DESIGN, null],
      [SALES, '$card1']
    ])
    expect((await posted()).every(r => r.matrixEventId !== null)).toBe(true)
  })

  it('marks a card Synapse refuses for good as failed and posts the next one', async () => {
    await stored(DESIGN, 1, 'huge')
    await stored(DESIGN, 2, 'small')
    const { sent, matrix } = recording()
    const send = matrix.send.bind(matrix)
    matrix.send = (homeserver, roomId, type, txnId, content) =>
      (content as { body: string }).body.startsWith('huge')
        ? Promise.reject(new MatrixError(413, 'M_TOO_LARGE'))
        : send(homeserver, roomId, type, txnId, content)

    await postCards(testDb.db, KEY, matrix, log)
    await postCards(testDb.db, KEY, matrix, log)

    expect(
      await testDb.db
        .select({
          matrixEventId: activityEvents.matrixEventId,
          failed: activityEvents.postFailedAt
        })
        .from(activityEvents)
        .orderBy(asc(activityEvents.time))
    ).toEqual([
      { matrixEventId: null, failed: expect.any(Date) as Date },
      { matrixEventId: '$card1', failed: null }
    ])
    expect(sent).toHaveLength(1)
  })

  it('keeps a posted card whose edit of the first card Synapse refuses for good', async () => {
    const q3 = { type: 'file', category: 'files' as const, id: 'f-q3' }
    await stored(DESIGN, 1, 'Q3 plan', q3)
    await stored(DESIGN, 2, 'Q3 plan v2', q3)
    const { matrix } = recording()
    const send = matrix.send.bind(matrix)
    matrix.send = (homeserver, roomId, type, txnId, content) =>
      txnId.endsWith('.edit')
        ? Promise.reject(new MatrixError(413, 'M_TOO_LARGE'))
        : send(homeserver, roomId, type, txnId, content)

    await postCards(testDb.db, KEY, matrix, log)

    expect((await posted()).map(r => r.matrixEventId)).toEqual([
      '$card1',
      '$card2'
    ])
  })

  it('tries a failing space again later and later, and the others meanwhile', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      await stored(DESIGN, 1)
      let designDown = true
      const { sent, matrix } = recording(
        roomId => designDown && roomId.includes(DESIGN)
      )
      const state = posterState()
      const pass = () => postCards(testDb.db, KEY, matrix, log, state)
      const designSent = () =>
        sent.filter(s => s.roomId.includes(DESIGN)).length

      await pass()
      designDown = false
      await stored(SALES, 2)
      await pass()
      expect(designSent()).toBe(0)
      expect(sent).toHaveLength(1)

      vi.advanceTimersByTime(1000)
      designDown = true
      await pass()
      vi.advanceTimersByTime(1000)
      designDown = false
      await pass()
      expect(designSent()).toBe(0)

      vi.advanceTimersByTime(1000)
      await pass()
      expect(designSent()).toBe(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('joins each Matrix space once before posting there', async () => {
    await stored(DESIGN, 1)
    await stored(SALES, 2)
    const { joined, matrix } = recording()
    const state = posterState()

    await postCards(testDb.db, KEY, matrix, log, state)
    await stored(DESIGN, 3)
    await postCards(testDb.db, KEY, matrix, log, state)

    expect(joined.sort()).toEqual(
      [`!${DESIGN}:example.com`, `!${SALES}:example.com`].sort()
    )
  })

  it('joins a space again after a card fails there', async () => {
    await stored(DESIGN, 1)
    const state = posterState()
    state.joined.add(`https://matrix.example.com|!${DESIGN}:example.com`)
    const { joined, matrix } = recording()

    await postCards(
      testDb.db,
      KEY,
      recording(roomId => roomId.includes(DESIGN)).matrix,
      log,
      state
    )
    state.backoff.clear()
    await postCards(testDb.db, KEY, matrix, log, state)

    expect(joined).toEqual([`!${DESIGN}:example.com`])
  })

  it('keeps the cards of a space it cannot join yet', async () => {
    await stored(DESIGN, 1)
    const { sent, matrix } = recording(roomId => roomId.includes(DESIGN))

    await postCards(testDb.db, KEY, matrix, log)

    expect(sent).toEqual([])
    expect(await posted()).toMatchObject([{ matrixEventId: null }])
  })

  it('keeps the events of an organization without chat', async () => {
    await stored(HR, 1)
    const { sent, matrix } = recording()

    await postCards(testDb.db, KEY, matrix, log)

    expect(sent).toEqual([])
    expect(await posted()).toMatchObject([{ matrixEventId: null }])
  })

  it('waits for the Matrix space of a space', async () => {
    await testDb.db.delete(spaceResources)
    await stored(DESIGN, 1)
    const { sent, matrix } = recording()

    await postCards(testDb.db, KEY, matrix, log)

    expect(sent).toEqual([])
  })
})
