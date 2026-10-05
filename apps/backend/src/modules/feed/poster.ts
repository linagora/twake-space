import { and, asc, eq, isNotNull, isNull, ne, sql } from 'drizzle-orm'
import type { Logger } from 'pino'
import type { Db } from '../../infra/db.ts'
import { matrixClient, type Matrix } from '../../infra/matrix.ts'
import { decrypt } from '../../infra/secrets.ts'
import { homeservers, organizations } from '../organizations/schema.ts'
import { spaceResources, spaces } from '../spaces/schema.ts'
import { activityEvents } from './schema.ts'

const POST_EVERY_MS = 1000
const CARDS_PER_SPACE = 50
const SPACES_PER_PASS = 50

interface StoredContent {
  object: { title: string }
  preview?: string
  state?: object
}

type StoredEvent = typeof activityEvents.$inferSelect

function cardContent(card: StoredEvent) {
  const content = card.content as StoredContent
  return {
    type: card.type,
    id: card.eventId,
    actor: card.actor,
    object: content.object,
    preview: content.preview,
    state: content.state ?? {},
    body: [content.object.title, content.preview].filter(Boolean).join('\n'),
    'm.mentions': {}
  }
}

async function firstCardOf(db: Db, spaceId: string, card: StoredEvent) {
  const [first] = await db
    .select({
      matrixEventId: activityEvents.matrixEventId,
      category: activityEvents.category
    })
    .from(activityEvents)
    .where(
      and(
        eq(activityEvents.spaceId, spaceId),
        eq(activityEvents.objectType, card.objectType),
        eq(activityEvents.objectId, card.objectId),
        isNotNull(activityEvents.matrixEventId),
        ne(activityEvents.id, card.id)
      )
    )
    .orderBy(asc(activityEvents.time), asc(activityEvents.id))
    .limit(1)
  return first
}

// Cards of a space go out in order, so a space stops at its first failure;
// spaces post in parallel, so one Synapse down delays only its own cards.
export async function postCards(
  db: Db,
  key: Buffer,
  matrix: Matrix,
  log: Logger,
  joined = new Set<string>()
): Promise<void> {
  const waiting = await db
    .selectDistinct({
      spaceId: spaces.spaceId,
      roomId: spaceResources.resourceId,
      url: homeservers.url,
      asToken: homeservers.asToken
    })
    .from(activityEvents)
    .innerJoin(spaces, eq(spaces.spaceId, activityEvents.spaceId))
    .innerJoin(
      spaceResources,
      and(
        eq(spaceResources.spaceId, spaces.spaceId),
        eq(spaceResources.kind, 'matrix_space')
      )
    )
    .innerJoin(
      organizations,
      and(
        eq(organizations.organizationId, spaces.organizationId),
        eq(organizations.chatAvailable, true)
      )
    )
    .innerJoin(homeservers, eq(homeservers.id, organizations.homeserverId))
    .where(isNull(activityEvents.matrixEventId))
    .limit(SPACES_PER_PASS)

  await Promise.all(
    waiting.map(async space => {
      const homeserver = {
        url: space.url,
        asToken: decrypt(key, space.asToken)
      }
      const cards = await db
        .select()
        .from(activityEvents)
        .where(
          and(
            eq(activityEvents.spaceId, space.spaceId),
            isNull(activityEvents.matrixEventId)
          )
        )
        .orderBy(asc(activityEvents.time), asc(activityEvents.id))
        .limit(CARDS_PER_SPACE)
      const room = `${space.url}|${space.roomId}`
      for (const card of cards) {
        try {
          if (!joined.has(room)) {
            await matrix.join(homeserver, space.roomId)
            joined.add(room)
          }
          const content = cardContent(card)
          const matrixEventId = await matrix.send(
            homeserver,
            space.roomId,
            `com.twake.feed.${card.category}`,
            card.id,
            content
          )
          // Before storing the card's id, so a failed edit is retried with it.
          const first = await firstCardOf(db, space.spaceId, card)
          if (first?.matrixEventId) {
            await matrix.send(
              homeserver,
              space.roomId,
              `com.twake.feed.${first.category}`,
              `${card.id}.edit`,
              {
                ...content,
                'm.new_content': content,
                'm.relates_to': {
                  rel_type: 'm.replace',
                  event_id: first.matrixEventId
                }
              }
            )
          }
          await db
            .update(activityEvents)
            .set({ matrixEventId })
            .where(eq(activityEvents.id, card.id))
        } catch (error) {
          // The bot may have been kicked; join again on the next pass.
          joined.delete(room)
          log.warn(
            { err: error, spaceId: space.spaceId },
            'card not posted, retrying'
          )
          return
        }
      }
    })
  )
}

// One replica posts at a time: the lock holds while the pass runs, and the
// Matrix ids commit on their own as each card is posted.
export function schedulePosting(db: Db, key: Buffer, log: Logger): () => void {
  const matrix = matrixClient()
  const joined = new Set<string>()
  let timer: NodeJS.Timeout | undefined
  let stopped = false
  const pass = async () => {
    await db.transaction(async tx => {
      const [lock] = await tx.execute<{ locked: boolean }>(
        sql`select pg_try_advisory_xact_lock(hashtext('poster')) as locked`
      )
      if (lock?.locked) await postCards(db, key, matrix, log, joined)
    })
  }
  const loop = () => {
    pass()
      .catch((error: unknown) => {
        log.error({ err: error }, 'posting cards failed')
      })
      .finally(() => {
        if (!stopped) timer = setTimeout(loop, POST_EVERY_MS)
      })
  }
  loop()
  return () => {
    stopped = true
    clearTimeout(timer)
  }
}
