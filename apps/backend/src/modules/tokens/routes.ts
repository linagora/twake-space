import { randomBytes } from 'node:crypto'
import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import type { Db } from '../../infra/db.ts'
import type { HttpServer } from '../../infra/http.ts'
import { sha256 } from '../auth/authenticator.ts'
import type { Authorize } from '../auth/index.ts'
import { spaceMembers, spaces } from '../spaces/schema.ts'
import { API_TOKEN_PREFIX } from './authenticator.ts'
import {
  apiTokens,
  apiTokenSpaces,
  organizationTokenPolicy,
  tokenAudit,
  tokenScope
} from './schema.ts'

const DAY_MS = 24 * 60 * 60 * 1000
const DEFAULT_LIFETIME_DAYS = 30

const name = z.string().trim().min(1).max(100)

const createBody = z
  .object({
    name,
    scopes: z.array(z.enum(tokenScope.enumValues)).min(1),
    spaces: z.union([z.literal('all'), z.array(z.uuid()).min(1)]),
    expiresInDays: z.literal([7, 30, 90, 365]).optional(),
    // Null for a token that never expires.
    expiresAt: z.iso.datetime({ offset: true }).nullable().optional()
  })
  .refine(
    body => body.expiresInDays === undefined || body.expiresAt === undefined,
    'expiresInDays or expiresAt, not both'
  )

const tokenParams = z.object({ id: z.uuid() })

function invalid(reply: FastifyReply, message: string) {
  return reply.code(400).send({ error: 'invalid_request', message })
}

function forbidden(reply: FastifyReply, message: string) {
  return reply.code(403).send({ error: 'forbidden', message })
}

// The account whose tokens the caller manages, and who the audit log names.
function accountOf(request: FastifyRequest) {
  const caller = request.caller
  if (!caller) throw new Error('authorize let a request through')
  if (caller.userId === null) return null
  return {
    caller,
    userId: caller.userId,
    actor: caller.kind === 'session' ? caller.userId : `token:${caller.tokenId}`
  }
}

export function registerTokenRoutes(
  app: HttpServer,
  deps: { db: Db; authorize: Authorize }
) {
  const { db } = deps
  const preHandler = deps.authorize('tokens:write')

  app.post('/tokens', { preHandler }, async (request, reply) => {
    const account = accountOf(request)
    if (!account) return forbidden(reply, 'not an account token')
    const { caller, userId, actor } = account
    const parsed = createBody.safeParse(request.body)
    if (!parsed.success) return invalid(reply, z.prettifyError(parsed.error))
    const body = parsed.data

    const now = Date.now()
    const expiresAt =
      body.expiresAt === null
        ? null
        : body.expiresAt
          ? new Date(body.expiresAt)
          : new Date(
              now + (body.expiresInDays ?? DEFAULT_LIFETIME_DAYS) * DAY_MS
            )
    if (expiresAt && expiresAt.getTime() <= now) {
      return invalid(reply, 'expiresAt is in the past')
    }
    const [policy] = await db
      .select()
      .from(organizationTokenPolicy)
      .where(eq(organizationTokenPolicy.organizationId, caller.organizationId))
    if (expiresAt === null && !policy?.allowNoExpiry) {
      return invalid(reply, 'the organization requires an expiry')
    }
    if (
      expiresAt &&
      policy?.maxLifetimeDays &&
      expiresAt.getTime() > now + policy.maxLifetimeDays * DAY_MS
    ) {
      return invalid(
        reply,
        `the organization caps tokens at ${String(policy.maxLifetimeDays)} days`
      )
    }

    const scopes = [...new Set(body.scopes)]
    const spaceIds = body.spaces === 'all' ? null : [...new Set(body.spaces)]
    if (spaceIds) {
      const memberOf = await db
        .select({ spaceId: spaceMembers.spaceId })
        .from(spaceMembers)
        .innerJoin(spaces, eq(spaces.spaceId, spaceMembers.spaceId))
        .where(
          and(
            eq(spaceMembers.userId, userId),
            eq(spaces.organizationId, caller.organizationId),
            inArray(spaceMembers.spaceId, spaceIds)
          )
        )
      if (memberOf.length !== spaceIds.length) {
        return invalid(reply, 'spaces must be spaces of the account')
      }
    }

    if (caller.kind === 'token') {
      const covered = caller.spaceIds
      if (
        !scopes.every(s => caller.scopes.includes(s)) ||
        (covered && (!spaceIds || !spaceIds.every(s => covered.includes(s)))) ||
        (caller.expiresAt && (!expiresAt || expiresAt > caller.expiresAt))
      ) {
        return forbidden(reply, 'more rights than the token creating it')
      }
    }

    const token = `${API_TOKEN_PREFIX}${randomBytes(32).toString('base64url')}`
    const id = await db.transaction(async tx => {
      const [row] = await tx
        .insert(apiTokens)
        .values({
          organizationId: caller.organizationId,
          ownerKind: 'account',
          accountId: userId,
          name: body.name,
          tokenHash: sha256(token),
          scopes,
          allSpaces: spaceIds === null,
          expiresAt,
          createdBy: actor
        })
        .returning({ id: apiTokens.id })
      if (!row) throw new Error('insert returned no row')
      if (spaceIds) {
        await tx
          .insert(apiTokenSpaces)
          .values(spaceIds.map(spaceId => ({ tokenId: row.id, spaceId })))
      }
      await tx
        .insert(tokenAudit)
        .values({ tokenId: row.id, action: 'created', actor })
      return row.id
    })
    return reply.code(201).send({
      id,
      name: body.name,
      token,
      scopes,
      spaces: spaceIds ?? 'all',
      expiresAt
    })
  })

  app.get('/tokens', { preHandler }, async (request, reply) => {
    const account = accountOf(request)
    if (!account) return forbidden(reply, 'not an account token')
    const rows = await db
      .select({
        id: apiTokens.id,
        name: apiTokens.name,
        scopes: apiTokens.scopes,
        allSpaces: apiTokens.allSpaces,
        expiresAt: apiTokens.expiresAt,
        lastUsedAt: apiTokens.lastUsedAt,
        createdAt: apiTokens.createdAt
      })
      .from(apiTokens)
      .where(
        and(
          eq(apiTokens.organizationId, account.caller.organizationId),
          eq(apiTokens.accountId, account.userId),
          isNull(apiTokens.revokedAt)
        )
      )
      .orderBy(asc(apiTokens.createdAt))
    const covered = await db
      .select()
      .from(apiTokenSpaces)
      .where(
        inArray(
          apiTokenSpaces.tokenId,
          rows.map(r => r.id)
        )
      )
    return {
      tokens: rows.map(({ allSpaces, ...row }) => ({
        ...row,
        spaces: allSpaces
          ? 'all'
          : covered.filter(c => c.tokenId === row.id).map(c => c.spaceId)
      }))
    }
  })

  // An active token of the caller's account, or nothing.
  const ownToken = (request: FastifyRequest) => {
    const account = accountOf(request)
    const params = tokenParams.safeParse(request.params)
    if (!account || !params.success) return null
    return {
      actor: account.actor,
      where: and(
        eq(apiTokens.id, params.data.id),
        eq(apiTokens.organizationId, account.caller.organizationId),
        eq(apiTokens.accountId, account.userId),
        isNull(apiTokens.revokedAt)
      )
    }
  }

  app.patch('/tokens/:id', { preHandler }, async (request, reply) => {
    const target = ownToken(request)
    if (!target) return reply.code(404).send({ error: 'not_found' })
    const parsed = z.object({ name }).safeParse(request.body)
    if (!parsed.success) return invalid(reply, z.prettifyError(parsed.error))
    const renamed = await db.transaction(async tx => {
      const [row] = await tx
        .update(apiTokens)
        .set({ name: parsed.data.name })
        .where(target.where)
        .returning({ id: apiTokens.id })
      if (row) {
        await tx
          .insert(tokenAudit)
          .values({ tokenId: row.id, action: 'renamed', actor: target.actor })
      }
      return row
    })
    if (!renamed) return reply.code(404).send({ error: 'not_found' })
    return reply.code(204).send()
  })

  app.delete('/tokens/:id', { preHandler }, async (request, reply) => {
    const target = ownToken(request)
    if (!target) return reply.code(404).send({ error: 'not_found' })
    const reason = 'revoked by its owner'
    const revoked = await db.transaction(async tx => {
      const [row] = await tx
        .update(apiTokens)
        .set({ revokedAt: sql`now()`, revokedReason: reason })
        .where(target.where)
        .returning({ id: apiTokens.id })
      if (row) {
        await tx.insert(tokenAudit).values({
          tokenId: row.id,
          action: 'revoked',
          actor: target.actor,
          reason
        })
      }
      return row
    })
    if (!revoked) return reply.code(404).send({ error: 'not_found' })
    return reply.code(204).send()
  })
}
