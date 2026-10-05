import { and, eq, inArray, sql } from 'drizzle-orm'
import { z } from 'zod'
import type { PlatformEvent } from '../../events/envelope.ts'
import { parseOrDrop, type Handler } from '../../events/router.ts'
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

const memberChanged = spaceEvent.extend({ members: z.array(member).min(1) })

const memberRemoved = spaceEvent.extend({
  members: z.array(z.looseObject({ username: z.string().min(1) })).min(1)
})

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
  const space = parseOrDrop(spaceCreated, event.body, event.routingKey)
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
  const { id, name } = parseOrDrop(spaceUpdated, event.body, event.routingKey)
  if (name === undefined) return
  await tx
    .update(spaces)
    .set({ name, updatedAt: sql`now()` })
    .where(eq(spaces.spaceId, id))
}

const onDeleted: Handler<PlatformEvent> = async (event, tx) => {
  const { id } = parseOrDrop(spaceEvent, event.body, event.routingKey)
  await tx.delete(spaceMembers).where(eq(spaceMembers.spaceId, id))
  await tx.delete(spaceGroups).where(eq(spaceGroups.spaceId, id))
  await tx.delete(spaceResources).where(eq(spaceResources.spaceId, id))
  await tx.delete(spaces).where(eq(spaces.spaceId, id))
}

const onMemberChanged: Handler<PlatformEvent> = async (event, tx) => {
  const { id, members } = parseOrDrop(
    memberChanged,
    event.body,
    event.routingKey
  )
  await upsertMembers(tx, id, members)
}

const onMemberRemoved: Handler<PlatformEvent> = async (event, tx) => {
  const { id, members } = parseOrDrop(
    memberRemoved,
    event.body,
    event.routingKey
  )
  await tx.delete(spaceMembers).where(
    and(
      eq(spaceMembers.spaceId, id),
      inArray(
        spaceMembers.username,
        members.map(m => m.username)
      )
    )
  )
}

const userDeleted = z.looseObject({
  organizationId: z.string().min(1),
  userId: z.string().min(1)
})

const onUserDeleted: Handler<PlatformEvent> = async (event, tx) => {
  const { organizationId, userId } = parseOrDrop(
    userDeleted,
    event.body,
    event.routingKey
  )
  await tx
    .delete(spaceMembers)
    .where(
      and(
        eq(spaceMembers.username, userId),
        inArray(
          spaceMembers.spaceId,
          tx
            .select({ spaceId: spaces.spaceId })
            .from(spaces)
            .where(eq(spaces.organizationId, organizationId))
        )
      )
    )
}

export const spacePlatformRoutes: ReadonlyMap<
  string,
  Handler<PlatformEvent>
> = new Map([
  ['twake.space.created', onCreated],
  ['twake.space.updated', onUpdated],
  ['twake.space.deleted', onDeleted],
  ['twake.space.member.added', onMemberChanged],
  ['twake.space.member.role.changed', onMemberChanged],
  ['twake.space.member.removed', onMemberRemoved],
  ['domain.user.deleted', onUserDeleted]
])
