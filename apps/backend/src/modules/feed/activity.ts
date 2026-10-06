import { and, eq, or, sql } from 'drizzle-orm'
import type { Logger } from 'pino'
import { z } from 'zod'
import type { CloudEvent } from '../../events/envelope.ts'
import {
  NotYetKnownError,
  parseOrDrop,
  RejectedEventError,
  type Handler
} from '../../events/router.ts'
import type { Tx } from '../../infra/db.ts'
import { notifyRecipients } from '../notifications/recipients.ts'
import {
  spaceGroups,
  spaceMembers,
  spaceResourceKind,
  spaceResources
} from '../spaces/schema.ts'
import { tellFeed } from './live.ts'
import {
  activityEvents,
  feedCards,
  feedItemReactions,
  feedPosts,
  type Actor,
  type feedCategory
} from './schema.ts'

type Category = (typeof feedCategory.enumValues)[number]
type SpaceResourceKind = (typeof spaceResourceKind.enumValues)[number]

// Chat makes no card: its messages are already in Matrix.
const CATEGORIES: Record<string, Category> = {
  mail: 'messages',
  drive: 'files',
  calendar: 'events',
  meet: 'activities',
  tasks: 'activities'
}

const activity = z.looseObject({
  twakeorg: z.string().min(1).optional(),
  twakeactorid: z.uuid().optional(),
  twakeactor: z.email().optional(),
  data: z.looseObject({
    object: z.looseObject({
      type: z.string().min(1),
      id: z.string().min(1),
      // The app's own resource the object lives in.
      container: z
        .looseObject({
          kind: z.enum(spaceResourceKind.enumValues),
          id: z.string().min(1)
        })
        .optional(),
      title: z.string().min(1)
    }),
    preview: z
      .string()
      .transform(p => Array.from(p).slice(0, 280).join(''))
      .optional(),
    actor: z
      .looseObject({
        type: z.literal('token'),
        id: z.string().min(1),
        name: z.string().min(1)
      })
      .optional(),
    recipients: z.array(z.unknown()).default([])
  })
})

async function findUser(
  tx: Tx,
  spaceId: string | undefined,
  id: string | undefined,
  email: string | undefined
): Promise<Actor | null> {
  if (id) return { type: 'user', id, email: email ?? null }
  if (!email) return null
  const [member] = await tx
    .select({ userId: spaceMembers.userId })
    .from(spaceMembers)
    .where(
      and(
        eq(spaceMembers.email, email),
        spaceId ? eq(spaceMembers.spaceId, spaceId) : undefined
      )
    )
    .limit(1)
  return { type: 'user', id: member?.userId ?? null, email }
}

// A resource no space has belongs to a person: notifications only. The app
// publishes a space resource's provisioned event before any activity on it,
// and both reach the one queue in that order, so it is never just late.
async function findSpace(
  tx: Tx,
  container: { kind: SpaceResourceKind; id: string } | undefined,
  organizationId: string | undefined
): Promise<string | undefined> {
  if (!container) return undefined
  const holders = await tx
    .select({
      spaceId: spaceResources.spaceId,
      organizationId: spaceResources.organizationId
    })
    .from(spaceResources)
    .where(
      and(
        eq(spaceResources.kind, container.kind),
        eq(spaceResources.resourceId, container.id)
      )
    )
  const holder = holders.find(h => h.organizationId === organizationId)
  if (holder) return holder.spaceId
  // So a resource id never shows content to another organization's space.
  if (holders.length > 0) {
    throw new RejectedEventError(
      `${container.kind} ${container.id} is not in organization ${organizationId ?? 'none'}`
    )
  }
  return undefined
}

async function checkActor(
  tx: Tx,
  log: Logger,
  spaceId: string,
  actor: Actor | null
) {
  if (actor?.type !== 'user') return
  // Sent by email only and no member has it: someone outside the space, such
  // as an attendee replying to a team calendar event.
  if (!actor.id) return
  const [member] = await tx
    .select({ userId: spaceMembers.userId })
    .from(spaceMembers)
    .where(
      and(eq(spaceMembers.spaceId, spaceId), eq(spaceMembers.userId, actor.id))
    )
  if (member) return
  // The copy keeps linked groups, not their members.
  const [group] = await tx
    .select({ groupId: spaceGroups.groupId })
    .from(spaceGroups)
    .where(eq(spaceGroups.spaceId, spaceId))
    .limit(1)
  if (!group) {
    throw new NotYetKnownError(`actor is not a member of space ${spaceId}`)
  }
  log.warn(
    { spaceId, actorId: actor.id },
    'actor not a direct member of a space with linked groups'
  )
}

// The card keeps the place of the object's first event and shows its latest,
// whatever order the events arrive in.
async function showCard(tx: Tx, card: typeof feedCards.$inferInsert) {
  const [shown] = await tx
    .insert(feedCards)
    .values(card)
    .onConflictDoUpdate({
      target: [feedCards.spaceId, feedCards.objectType, feedCards.objectId],
      set: {
        time: sql`least(${feedCards.time}, excluded.time)`,
        latestEventId: sql`case when excluded.latest_time >= ${feedCards.latestTime}
          then excluded.latest_event_id else ${feedCards.latestEventId} end`,
        latestTime: sql`greatest(${feedCards.latestTime}, excluded.latest_time)`
      }
    })
    .returning({ id: feedCards.id, added: sql<boolean>`xmax = 0` })
  if (!shown) throw new Error('the card upsert returned no row')
  await tellFeed(tx, card.spaceId, shown.id, shown.added ? 'added' : 'changed')
}

function store(category: Category): Handler<CloudEvent> {
  return async (event, tx, log) => {
    const { twakeorg, twakeactorid, twakeactor, data } = parseOrDrop(
      activity,
      event,
      event.type
    )
    const spaceId = await findSpace(tx, data.object.container, twakeorg)
    const actor: Actor | null = data.actor
      ? { type: 'token', id: data.actor.id, name: data.actor.name }
      : await findUser(tx, spaceId, twakeactorid, twakeactor)
    if (spaceId) await checkActor(tx, log, spaceId, actor)
    // Recipients stay out of the card every space member sees.
    const { recipients, ...content } = data
    const organizationId = twakeorg ?? null
    const [stored] = await tx
      .insert(activityEvents)
      .values({
        source: event.source,
        eventId: event.id,
        organizationId,
        spaceId: spaceId ?? null,
        type: event.type,
        category,
        actor,
        objectType: data.object.type,
        objectId: data.object.id,
        content,
        time: event.time ? new Date(event.time) : new Date()
      })
      .onConflictDoNothing()
      .returning({ id: activityEvents.id, time: activityEvents.time })
    // Replayed under another consumer group: stored and notified already.
    if (!stored) return
    if (spaceId) {
      await showCard(tx, {
        spaceId,
        objectType: data.object.type,
        objectId: data.object.id,
        category,
        time: stored.time,
        latestEventId: stored.id,
        latestTime: stored.time
      })
    }
    // Twake Tasks notifies its own users.
    if (event.type.startsWith('com.twake.tasks.')) return
    await notifyRecipients(
      tx,
      log,
      { id: stored.id, organizationId, spaceId: spaceId ?? null },
      recipients
    )
  }
}

const handlers = new Map(
  Object.entries(CATEGORIES).map(([app, category]) => [app, store(category)])
)

export async function forgetActor(
  tx: Tx,
  user: { uuid: string; email?: string } | { uuid?: never; email: string }
) {
  const { uuid, email } = user
  if (uuid) {
    await tx
      .update(feedPosts)
      .set({ authorId: null })
      .where(eq(feedPosts.authorId, uuid))
    await tx.delete(feedItemReactions).where(eq(feedItemReactions.userId, uuid))
  }
  // An actor sent by email only keeps a null id, so the email matches it too.
  await tx
    .update(activityEvents)
    .set({ actor: { type: 'deleted_user' } satisfies Actor })
    .where(
      and(
        sql`${activityEvents.actor}->>'type' = 'user'`,
        or(
          uuid ? sql`${activityEvents.actor}->>'id' = ${uuid}` : undefined,
          email ? sql`${activityEvents.actor}->>'email' = ${email}` : undefined
        )
      )
    )
}

export const activityRoute = {
  get(type: string): Handler<CloudEvent> | undefined {
    const app = /^com\.twake\.([a-z]+)\./.exec(type)?.[1]
    if (!app || type.includes('.space.provisioned.')) return undefined
    return handlers.get(app)
  }
}
