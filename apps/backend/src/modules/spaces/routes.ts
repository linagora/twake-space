import { and, asc, eq, inArray } from 'drizzle-orm'
import type { FastifyRequest } from 'fastify'
import { z } from 'zod'
import type { Db } from '../../infra/db.ts'
import type { HttpServer } from '../../infra/http.ts'
import type { Authorize, Caller } from '../auth/index.ts'
import { homeservers, organizations } from '../organizations/schema.ts'
import {
  spaceGroups,
  spaceMembers,
  spaceResourceKind,
  spaceResources,
  spaces
} from './schema.ts'

const spaceParams = z.object({ id: z.uuid() })

// The spaces a caller reaches, with the role it acts with in each: its account's
// membership, or an organization token's own role on every space it covers.
export function reachableSpaces(db: Db, caller: Caller, spaceId?: string) {
  const covered = and(
    eq(spaces.organizationId, caller.organizationId),
    spaceId === undefined ? undefined : eq(spaces.spaceId, spaceId),
    caller.kind === 'token' && caller.spaceIds
      ? inArray(spaces.spaceId, caller.spaceIds)
      : undefined
  )
  const fields = { id: spaces.spaceId, name: spaces.name }
  const { userId } = caller
  if (userId === null) {
    const role = caller.kind === 'token' ? caller.role : null
    if (!role) throw new Error('an organization token has no role')
    return db
      .select(fields)
      .from(spaces)
      .where(covered)
      .orderBy(asc(spaces.name))
      .then(rows => rows.map(row => ({ ...row, role })))
  }
  return db
    .select({ ...fields, role: spaceMembers.role })
    .from(spaces)
    .innerJoin(
      spaceMembers,
      and(
        eq(spaceMembers.spaceId, spaces.spaceId),
        eq(spaceMembers.userId, userId)
      )
    )
    .where(covered)
    .orderBy(asc(spaces.name))
}

function callerOf(request: FastifyRequest) {
  if (!request.caller) throw new Error('authorize let a request through')
  return request.caller
}

export function registerSpaceRoutes(
  app: HttpServer,
  deps: { db: Db; authorize: Authorize }
) {
  const { db, authorize } = deps

  app.get('/spaces', { preHandler: authorize('space:read') }, async request => {
    return { spaces: await reachableSpaces(db, callerOf(request)) }
  })

  app.get(
    '/spaces/:id',
    { preHandler: authorize('space:read') },
    async (request, reply) => {
      const params = spaceParams.safeParse(request.params)
      if (!params.success) return reply.code(404).send({ error: 'not_found' })
      const spaceId = params.data.id

      const [space] = await reachableSpaces(db, callerOf(request), spaceId)
      if (!space) {
        return reply.code(404).send({ error: 'not_found' })
      }

      const [members, groups, resources, [organization]] = await Promise.all([
        db
          .select({
            id: spaceMembers.userId,
            username: spaceMembers.username,
            email: spaceMembers.email,
            role: spaceMembers.role
          })
          .from(spaceMembers)
          .where(eq(spaceMembers.spaceId, spaceId))
          .orderBy(asc(spaceMembers.username)),
        db
          .select({
            id: spaceGroups.groupId,
            name: spaceGroups.name,
            role: spaceGroups.role
          })
          .from(spaceGroups)
          .where(eq(spaceGroups.spaceId, spaceId))
          .orderBy(asc(spaceGroups.name)),
        db
          .select({ kind: spaceResources.kind, id: spaceResources.resourceId })
          .from(spaceResources)
          .where(eq(spaceResources.spaceId, spaceId)),
        db
          .select({
            chat: organizations.chatAvailable,
            mail: organizations.mailAvailable,
            homeserverUrl: homeservers.url
          })
          .from(organizations)
          .leftJoin(homeservers, eq(homeservers.id, organizations.homeserverId))
          .where(
            eq(organizations.organizationId, callerOf(request).organizationId)
          )
      ])
      const resourceIds = new Map(resources.map(r => [r.kind, r.id]))

      return {
        ...space,
        chat: organization?.chat ?? false,
        mail: organization?.mail ?? false,
        homeserverUrl: organization?.homeserverUrl ?? null,
        members,
        groups,
        // A kind without an id is still being prepared by its app.
        resources: spaceResourceKind.enumValues.map(kind => ({
          kind,
          id: resourceIds.get(kind) ?? null
        }))
      }
    }
  )
}
