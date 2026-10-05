import { and, asc, eq } from 'drizzle-orm'
import { z } from 'zod'
import type { Db } from '../../infra/db.ts'
import type { HttpServer } from '../../infra/http.ts'
import type { RequireIdentity } from '../auth/index.ts'
import {
  spaceGroups,
  spaceMembers,
  spaceResourceKind,
  spaceResources,
  spaces
} from './schema.ts'

const spaceParams = z.object({ id: z.uuid() })

export function registerSpaceRoutes(
  app: HttpServer,
  deps: { db: Db; requireIdentity: RequireIdentity }
) {
  const { db, requireIdentity } = deps

  app.get('/spaces', { preHandler: requireIdentity }, async request => {
    const identity = request.identity
    if (!identity) throw new Error('requireIdentity let a request through')
    const rows = await db
      .select({
        id: spaces.spaceId,
        name: spaces.name,
        role: spaceMembers.role
      })
      .from(spaceMembers)
      .innerJoin(spaces, eq(spaces.spaceId, spaceMembers.spaceId))
      .where(
        and(
          eq(spaceMembers.userId, identity.userId),
          eq(spaces.organizationId, identity.organizationId)
        )
      )
      .orderBy(asc(spaces.name))
    return { spaces: rows }
  })

  app.get(
    '/spaces/:id',
    { preHandler: requireIdentity },
    async (request, reply) => {
      const identity = request.identity
      if (!identity) throw new Error('requireIdentity let a request through')
      const params = spaceParams.safeParse(request.params)
      if (!params.success) return reply.code(404).send({ error: 'not_found' })
      const spaceId = params.data.id

      const [space] = await db
        .select({ name: spaces.name, role: spaceMembers.role })
        .from(spaces)
        .innerJoin(
          spaceMembers,
          and(
            eq(spaceMembers.spaceId, spaces.spaceId),
            eq(spaceMembers.userId, identity.userId)
          )
        )
        .where(
          and(
            eq(spaces.spaceId, spaceId),
            eq(spaces.organizationId, identity.organizationId)
          )
        )
      if (!space) {
        return reply.code(404).send({ error: 'not_found' })
      }

      const [members, groups, resources] = await Promise.all([
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
          .where(eq(spaceResources.spaceId, spaceId))
      ])
      const resourceIds = new Map(resources.map(r => [r.kind, r.id]))

      return {
        id: spaceId,
        ...space,
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
