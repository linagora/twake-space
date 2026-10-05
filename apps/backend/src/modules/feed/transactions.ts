import { and, eq, isNull, lt, or } from 'drizzle-orm'
import type { FastifyRequest } from 'fastify'
import { z } from 'zod'
import type { Db, Tx } from '../../infra/db.ts'
import type { HttpServer } from '../../infra/http.ts'
import { hashSecret } from '../../infra/secrets.ts'
import { homeservers, organizations } from '../organizations/schema.ts'
import { spaceResources } from '../spaces/schema.ts'
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
  homeserverId: string,
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
        eq(organizations.homeserverId, homeserverId)
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
    await tx
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

export function registerTransactionRoutes(app: HttpServer, deps: { db: Db }) {
  const { db } = deps

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
        .select({ id: homeservers.id })
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
          if (event.success) await storeEvent(tx, homeserver.id, event.data)
        }
      })
      return reply.send({})
    }
  )
}
