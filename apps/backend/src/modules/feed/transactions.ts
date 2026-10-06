import { and, eq, inArray, isNull, lt, or, sql } from 'drizzle-orm'
import type { FastifyRequest } from 'fastify'
import { z } from 'zod'
import { postgresRefusal, type Db, type Tx } from '../../infra/db.ts'
import type { HttpServer } from '../../infra/http.ts'
import { hashSecret } from '../../infra/secrets.ts'
import { notifyUsers } from '../notifications/recipients.ts'
import { homeservers, organizations } from '../organizations/schema.ts'
import { spaceMembers, spaceResources } from '../spaces/schema.ts'
import {
  appServiceTransactions,
  feedMessages,
  feedReactions
} from './schema.ts'

const MAX_TRANSACTION_BYTES = 8 * 1024 * 1024

const params = z.object({ txnId: z.string().min(1) })

const transaction = z.object({ events: z.array(z.unknown()).default([]) })

const roomEvent = z.looseObject({
  type: z.string(),
  event_id: z.string().min(1),
  room_id: z.string().min(1),
  sender: z.string().min(1),
  origin_server_ts: z.number().transform(ts => new Date(ts)),
  content: z.looseObject({}),
  redacts: z.string().optional()
})
type RoomEvent = z.infer<typeof roomEvent>

const edit = z.looseObject({
  'm.new_content': z.looseObject({}),
  'm.relates_to': z.looseObject({
    rel_type: z.literal('m.replace'),
    event_id: z.string().min(1)
  })
})

const reaction = z.looseObject({
  'm.relates_to': z.looseObject({
    rel_type: z.literal('m.annotation'),
    event_id: z.string().min(1),
    key: z.string().min(1)
  })
})

const mentions = z.looseObject({
  'm.mentions': z.looseObject({ user_ids: z.array(z.string()) })
})

// How Synapse's SSO mapping builds a person's Matrix localpart.
export type Localpart = 'uid' | 'email'

interface Homeserver {
  id: string
  serverName: string
}

interface Space {
  spaceId: string
  organizationId: string
}

async function notifyMentions(
  tx: Tx,
  homeserver: Homeserver,
  localpart: Localpart,
  space: Space,
  event: RoomEvent
) {
  const userIds =
    mentions.safeParse(event.content).data?.['m.mentions'].user_ids ?? []
  const suffix = `:${homeserver.serverName}`
  const localparts = userIds
    .filter(
      id => id !== event.sender && id.startsWith('@') && id.endsWith(suffix)
    )
    .map(id => id.slice(1, -suffix.length).toLowerCase())
  if (localparts.length === 0) return
  const members = await tx
    .select({ userId: spaceMembers.userId })
    .from(spaceMembers)
    .where(
      and(
        eq(spaceMembers.spaceId, space.spaceId),
        inArray(
          localpart === 'uid'
            ? sql`lower(${spaceMembers.username})`
            : sql`lower(split_part(${spaceMembers.email}, '@', 1))`,
          localparts
        )
      )
    )
  await notifyUsers(
    tx,
    members.map(m => ({ userId: m.userId, type: 'message_mention' as const })),
    { ...space, matrixEventId: event.event_id }
  )
}

// Room v11 moved redacts into the content.
const redaction = z.looseObject({ redacts: z.string().min(1) })

function hsTokenOf(request: FastifyRequest): string | undefined {
  const bearer = /^Bearer (.+)$/.exec(request.headers.authorization ?? '')
  if (bearer) return bearer[1]
  const { access_token } = request.query as { access_token?: unknown }
  return typeof access_token === 'string' ? access_token : undefined
}

async function storeEvent(
  tx: Tx,
  homeserver: Homeserver,
  localpart: Localpart,
  event: RoomEvent
): Promise<void> {
  const [space] = await tx
    .select({
      spaceId: spaceResources.spaceId,
      organizationId: spaceResources.organizationId
    })
    .from(spaceResources)
    .innerJoin(
      organizations,
      eq(organizations.organizationId, spaceResources.organizationId)
    )
    .where(
      and(
        eq(spaceResources.kind, 'matrix_space'),
        eq(spaceResources.resourceId, event.room_id),
        eq(organizations.homeserverId, homeserver.id)
      )
    )
  if (!space) return

  if (event.type === 'm.room.message') {
    const edited = edit.safeParse(event.content)
    if (edited.success) {
      const replaced = edited.data['m.relates_to'].event_id
      await tx
        .update(feedMessages)
        .set({
          editedContent: edited.data['m.new_content'],
          editedAt: event.origin_server_ts
        })
        .where(
          and(
            eq(feedMessages.matrixEventId, replaced),
            eq(feedMessages.sender, event.sender),
            or(
              isNull(feedMessages.editedAt),
              lt(feedMessages.editedAt, event.origin_server_ts)
            )
          )
        )
      return
    }
    const [stored] = await tx
      .insert(feedMessages)
      .values({
        matrixEventId: event.event_id,
        organizationId: space.organizationId,
        spaceId: space.spaceId,
        sender: event.sender,
        content: event.content,
        originServerTs: event.origin_server_ts
      })
      .onConflictDoNothing()
      .returning({ matrixEventId: feedMessages.matrixEventId })
    if (stored) await notifyMentions(tx, homeserver, localpart, space, event)
    return
  }

  if (event.type === 'm.reaction') {
    const reacted = reaction.safeParse(event.content)
    if (!reacted.success) return
    await tx
      .insert(feedReactions)
      .values({
        matrixEventId: event.event_id,
        targetEventId: reacted.data['m.relates_to'].event_id,
        sender: event.sender,
        key: reacted.data['m.relates_to'].key
      })
      .onConflictDoNothing()
    return
  }

  if (event.type === 'm.room.redaction') {
    const redacts =
      event.redacts ?? redaction.safeParse(event.content).data?.redacts
    if (!redacts) return
    await tx
      .update(feedMessages)
      .set({ redactedAt: event.origin_server_ts })
      .where(eq(feedMessages.matrixEventId, redacts))
    await tx
      .update(feedReactions)
      .set({ redactedAt: event.origin_server_ts })
      .where(eq(feedReactions.matrixEventId, redacts))
  }
}

export function registerTransactionRoutes(
  app: HttpServer,
  deps: { db: Db; localpart: Localpart }
) {
  const { db, localpart } = deps

  app.put(
    '/_matrix/app/v1/transactions/:txnId',
    { bodyLimit: MAX_TRANSACTION_BYTES },
    async (request, reply) => {
      const token = hsTokenOf(request)
      if (!token) {
        return reply
          .code(401)
          .send({ errcode: 'M_UNAUTHORIZED', error: 'missing hs_token' })
      }
      const [homeserver] = await db
        .select({ id: homeservers.id, serverName: homeservers.serverName })
        .from(homeservers)
        .where(eq(homeservers.hsTokenHash, hashSecret(token)))
      if (!homeserver) {
        return reply
          .code(403)
          .send({ errcode: 'M_FORBIDDEN', error: 'unknown hs_token' })
      }
      const txnId = params.safeParse(request.params)
      const body = transaction.safeParse(request.body)
      if (!txnId.success || !body.success) {
        return reply
          .code(400)
          .send({ errcode: 'M_BAD_JSON', error: 'invalid transaction' })
      }

      await db.transaction(async tx => {
        const [first] = await tx
          .insert(appServiceTransactions)
          .values({ homeserverId: homeserver.id, txnId: txnId.data.txnId })
          .onConflictDoNothing()
          .returning({ txnId: appServiceTransactions.txnId })
        if (!first) return
        for (const raw of body.data.events) {
          // One malformed event must not make Synapse resend the batch forever.
          const event = roomEvent.safeParse(raw)
          if (!event.success) continue
          try {
            await tx.transaction(savepoint =>
              storeEvent(savepoint, homeserver, localpart, event.data)
            )
          } catch (error) {
            const reason = postgresRefusal(error)
            if (!reason) throw error
            request.log.warn(
              { eventId: event.data.event_id, reason },
              'skipping a Matrix event Postgres refuses'
            )
          }
        }
      })
      return reply.send({})
    }
  )
}
