import {
  and,
  asc,
  eq,
  gt,
  isNotNull,
  isNull,
  ne,
  notInArray,
  sql
} from 'drizzle-orm'
import type { Logger } from 'pino'
import type { Db } from '../../infra/db.ts'
import { matrixClient, MatrixError, type Matrix } from '../../infra/matrix.ts'
import { decrypt } from '../../infra/secrets.ts'
import { homeservers, organizations } from '../organizations/schema.ts'
import { spaceResources, spaces } from '../spaces/schema.ts'
import { activityEvents } from './schema.ts'

const POST_EVERY_MS = 1000
const CARDS_PER_SPACE = 50
const SPACES_PER_PASS = 50
const MAX_BACKOFF_MS = 5 * 60_000

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

// The first card about the object shows its latest state, so an event older
// than one already posted leaves it alone.
async function cardToEdit(db: Db, spaceId: string, card: StoredEvent) {
  const postedAbout = and(
    eq(activityEvents.spaceId, spaceId),
    eq(activityEvents.objectType, card.objectType),
    eq(activityEvents.objectId, card.objectId),
    isNotNull(activityEvents.matrixEventId),
    ne(activityEvents.id, card.id)
  )
  const [newer] = await db
    .select({ id: activityEvents.id })
    .from(activityEvents)
    .where(and(postedAbout, gt(activityEvents.time, card.time)))
    .limit(1)
  if (newer) return undefined
  const [first] = await db
    .select({
      matrixEventId: activityEvents.matrixEventId,
      category: activityEvents.category
    })
    .from(activityEvents)
    .where(postedAbout)
    .orderBy(asc(activityEvents.time), asc(activityEvents.id))
    .limit(1)
  return first
}

// A card Synapse rejects as malformed or too large fails the same way every time.
const refusedForGood = (error: unknown) =>
  error instanceof MatrixError && (error.status === 400 || error.status === 413)

export function posterState() {
  return {
    joined: new Set<string>(),
    backoff: new Map<string, { failures: number; retryAt: number }>()
  }
}

type PosterState = ReturnType<typeof posterState>

// Cards of a space go out in order, so a space stops at its first failure;
// spaces post in parallel, so one Synapse down delays only its own cards.
export async function postCards(
  db: Db,
  key: Buffer,
  matrix: Matrix,
  log: Logger,
  state: PosterState = posterState()
): Promise<void> {
  const { joined, backoff } = state
  const now = Date.now()
  // Left out of the query, so spaces waiting out a failure don't take every slot.
  const resting = [...backoff]
    .filter(([, b]) => b.retryAt > now)
    .map(([spaceId]) => spaceId)
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
    .where(
      and(
        isNull(activityEvents.matrixEventId),
        isNull(activityEvents.postFailedAt),
        notInArray(spaces.spaceId, resting)
      )
    )
    .limit(SPACES_PER_PASS)

  await Promise.all(
    waiting.map(async space => {
      const room = `${space.url}|${space.roomId}`
      // A space stops at its first failure; nothing escapes, so the pass and
      // its lock end only once every space is done.
      try {
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
              isNull(activityEvents.matrixEventId),
              isNull(activityEvents.postFailedAt)
            )
          )
          .orderBy(asc(activityEvents.time), asc(activityEvents.id))
          .limit(CARDS_PER_SPACE)
        for (const card of cards) {
          if (!joined.has(room)) {
            await matrix.join(homeserver, space.roomId)
            joined.add(room)
          }
          const content = cardContent(card)
          let matrixEventId: string
          try {
            matrixEventId = await matrix.send(
              homeserver,
              space.roomId,
              `com.twake.feed.${card.category}`,
              card.id,
              content
            )
          } catch (error) {
            if (!refusedForGood(error)) throw error
            log.error(
              { err: error, spaceId: space.spaceId, cardId: card.id },
              'card refused by the homeserver, not posted'
            )
            await db
              .update(activityEvents)
              .set({ postFailedAt: new Date() })
              .where(eq(activityEvents.id, card.id))
            continue
          }
          // Before storing the card's id, so a failed edit is retried with it.
          const first = await cardToEdit(db, space.spaceId, card)
          if (first?.matrixEventId) {
            await matrix
              .send(
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
              .catch((error: unknown) => {
                if (!refusedForGood(error)) throw error
                // The card itself is posted; only the first card stays as it was.
                log.error(
                  { err: error, spaceId: space.spaceId, cardId: card.id },
                  'card edit refused by the homeserver, not posted'
                )
              })
          }
          await db
            .update(activityEvents)
            .set({ matrixEventId })
            .where(eq(activityEvents.id, card.id))
        }
        backoff.delete(space.spaceId)
      } catch (error) {
        // The bot may have been kicked; join again on the next pass.
        joined.delete(room)
        const failures = (backoff.get(space.spaceId)?.failures ?? 0) + 1
        const delayMs = Math.min(
          MAX_BACKOFF_MS,
          POST_EVERY_MS * 2 ** (failures - 1)
        )
        backoff.set(space.spaceId, {
          failures,
          retryAt: Date.now() + delayMs
        })
        log.warn(
          { err: error, spaceId: space.spaceId, failures, delayMs },
          'card not posted, retrying'
        )
      }
    })
  )
}

// One replica posts at a time: the lock holds while the pass runs, and the
// Matrix ids commit on their own as each card is posted.
export function schedulePosting(db: Db, key: Buffer, log: Logger): () => void {
  const matrix = matrixClient()
  const state = posterState()
  let timer: NodeJS.Timeout | undefined
  let stopped = false
  const pass = async () => {
    await db.transaction(async tx => {
      const [lock] = await tx.execute<{ locked: boolean }>(
        sql`select pg_try_advisory_xact_lock(hashtext('poster')) as locked`
      )
      if (lock?.locked) await postCards(db, key, matrix, log, state)
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
