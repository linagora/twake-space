import { and, eq } from 'drizzle-orm'
import type { Logger } from 'pino'
import { z } from 'zod'
import type { CloudEvent } from '../../events/envelope.ts'
import {
  parseOrDrop,
  RejectedEventError,
  type Handler
} from '../../events/router.ts'
import type { Tx } from '../../infra/db.ts'
import { notifyRecipients } from '../notifications/recipients.ts'
import { spaceGroups, spaceMembers, spaces } from '../spaces/schema.ts'
import { activityEvents, type Actor, type feedCategory } from './schema.ts'

type Category = (typeof feedCategory.enumValues)[number]

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
      space_id: z.uuid().optional(),
      title: z.string().min(1),
      url: z.string().min(1)
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

// So a wrong space_id never shows content to another space.
async function checkSpace(
  tx: Tx,
  log: Logger,
  spaceId: string,
  organizationId: string | undefined,
  actor: Actor | null
) {
  const [space] = await tx
    .select({ organizationId: spaces.organizationId })
    .from(spaces)
    .where(eq(spaces.spaceId, spaceId))
  if (!space) throw new RejectedEventError(`unknown space ${spaceId}`)
  if (space.organizationId !== organizationId) {
    throw new RejectedEventError(
      `space ${spaceId} is not in organization ${organizationId ?? 'none'}`
    )
  }
  if (actor?.type !== 'user') return
  if (actor.id) {
    const [member] = await tx
      .select({ userId: spaceMembers.userId })
      .from(spaceMembers)
      .where(
        and(
          eq(spaceMembers.spaceId, spaceId),
          eq(spaceMembers.userId, actor.id)
        )
      )
    if (member) return
  }
  // The copy keeps linked groups, not their members.
  const [group] = await tx
    .select({ groupId: spaceGroups.groupId })
    .from(spaceGroups)
    .where(eq(spaceGroups.spaceId, spaceId))
    .limit(1)
  if (!group) {
    throw new RejectedEventError(`actor is not a member of space ${spaceId}`)
  }
  log.warn(
    { spaceId, actorId: actor.id },
    'actor not a direct member of a space with linked groups'
  )
}

function store(category: Category): Handler<CloudEvent> {
  return async (event, tx, log) => {
    const { twakeorg, twakeactorid, twakeactor, data } = parseOrDrop(
      activity,
      event,
      event.type
    )
    const spaceId = data.object.space_id
    const actor: Actor | null = data.actor
      ? { type: 'token', id: data.actor.id, name: data.actor.name }
      : await findUser(tx, spaceId, twakeactorid, twakeactor)
    if (spaceId) await checkSpace(tx, log, spaceId, twakeorg, actor)
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
      .returning({ id: activityEvents.id })
    if (!stored) throw new Error('insert returned no row')
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

export const activityRoute = {
  get(type: string): Handler<CloudEvent> | undefined {
    const app = /^com\.twake\.([a-z]+)\./.exec(type)?.[1]
    if (!app || type.includes('.space.provisioned.')) return undefined
    return handlers.get(app)
  }
}
