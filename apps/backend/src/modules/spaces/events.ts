import { eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import type { PlatformEvent } from '../../events/envelope.ts'
import { MalformedEventError, type Handler } from '../../events/router.ts'
import type { Tx } from '../../infra/db.ts'
import { spaceGroups, spaceMembers, spaceResources, spaces } from './schema.ts'

const spaceEvent = z.looseObject({
  organizationId: z.string().min(1),
  id: z.uuid()
})

const member = z.looseObject({
  username: z.string().min(1),
  email: z.email(),
  role: z.enum(['viewer', 'editor', 'admin'])
})

const spaceCreated = spaceEvent.extend({
  name: z.string().min(1),
  members: z.array(member).default([])
})

const spaceUpdated = spaceEvent.extend({ name: z.string().min(1).optional() })

function parse<T extends z.ZodType>(schema: T, event: PlatformEvent) {
  const result = schema.safeParse(event.body)
  if (!result.success) {
    throw new MalformedEventError(
      `${event.routingKey}: ${z.prettifyError(result.error)}`
    )
  }
  return result.data
}

async function upsertMembers(
  tx: Tx,
  spaceId: string,
  members: z.infer<typeof member>[]
) {
  // One upsert cannot touch a row twice, so a member listed twice keeps its last entry.
  const byUsername = new Map(
    members.map(({ username, email, role }) => [
      username,
      { spaceId, username, email, role }
    ])
  )
  if (byUsername.size === 0) return
  await tx
    .insert(spaceMembers)
    .values([...byUsername.values()])
    .onConflictDoUpdate({
      target: [spaceMembers.spaceId, spaceMembers.username],
      set: {
        email: sql`excluded.email`,
        role: sql`excluded.role`
      }
    })
}

const onCreated: Handler<PlatformEvent> = async (event, tx) => {
  const space = parse(spaceCreated, event)
  await tx
    .insert(spaces)
    .values({
      spaceId: space.id,
      organizationId: space.organizationId,
      name: space.name
    })
    .onConflictDoUpdate({
      target: spaces.spaceId,
      set: { name: space.name, updatedAt: sql`now()` }
    })
  await upsertMembers(tx, space.id, space.members)
}

const onUpdated: Handler<PlatformEvent> = async (event, tx) => {
  const { id, name } = parse(spaceUpdated, event)
  if (name === undefined) return
  await tx
    .update(spaces)
    .set({ name, updatedAt: sql`now()` })
    .where(eq(spaces.spaceId, id))
}

const onDeleted: Handler<PlatformEvent> = async (event, tx) => {
  const { id } = parse(spaceEvent, event)
  await tx.delete(spaceMembers).where(eq(spaceMembers.spaceId, id))
  await tx.delete(spaceGroups).where(eq(spaceGroups.spaceId, id))
  await tx.delete(spaceResources).where(eq(spaceResources.spaceId, id))
  await tx.delete(spaces).where(eq(spaces.spaceId, id))
}

export const spacePlatformRoutes: ReadonlyMap<
  string,
  Handler<PlatformEvent>
> = new Map([
  ['twake.space.created', onCreated],
  ['twake.space.updated', onUpdated],
  ['twake.space.deleted', onDeleted]
])
