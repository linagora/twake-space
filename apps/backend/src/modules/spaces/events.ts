import { and, eq, inArray, sql } from 'drizzle-orm'
import { z } from 'zod'
import type { PlatformEvent } from '../../events/envelope.ts'
import { parseOrDrop, type Handler } from '../../events/router.ts'
import type { Tx } from '../../infra/db.ts'
import {
  spaceGroups,
  spaceMembers,
  spaceResources,
  spaceRole,
  spaces
} from './schema.ts'

const spaceEvent = z.looseObject({
  organizationId: z.string().min(1),
  id: z.uuid()
})

const role = z.enum(spaceRole.enumValues)

const member = z.looseObject({
  uuid: z.uuid(),
  username: z.string().min(1),
  email: z.email(),
  role
})

const group = z.looseObject({
  id: z.uuid(),
  name: z.string().min(1),
  role
})

const spaceCreated = spaceEvent.extend({
  name: z.string().min(1),
  members: z.array(member).default([]),
  groups: z.array(group).default([])
})

const spaceUpdated = spaceEvent.extend({ name: z.string().min(1).optional() })

const memberChanged = spaceEvent.extend({ members: z.array(member).min(1) })

const memberRemoved = spaceEvent.extend({
  members: z.array(z.looseObject({ uuid: z.uuid() })).min(1)
})

const groupChanged = spaceEvent.extend({ groups: z.array(group).min(1) })

const groupUnlinked = spaceEvent.extend({
  groups: z.array(z.looseObject({ id: z.uuid() })).min(1)
})

async function upsertGroups(
  tx: Tx,
  spaceId: string,
  groups: z.infer<typeof group>[]
) {
  const byId = new Map(
    groups.map(({ id, name, role }) => [
      id,
      { spaceId, groupId: id, name, role }
    ])
  )
  if (byId.size === 0) return
  await tx
    .insert(spaceGroups)
    .values([...byId.values()])
    .onConflictDoUpdate({
      target: [spaceGroups.spaceId, spaceGroups.groupId],
      set: { name: sql`excluded.name`, role: sql`excluded.role` }
    })
}

async function upsertMembers(
  tx: Tx,
  spaceId: string,
  members: z.infer<typeof member>[]
) {
  // One upsert cannot touch a row twice, so a member listed twice keeps its last entry.
  const byUser = new Map(
    members.map(({ uuid, username, email, role }) => [
      uuid,
      { spaceId, userId: uuid, username, email, role }
    ])
  )
  if (byUser.size === 0) return
  await tx
    .insert(spaceMembers)
    .values([...byUser.values()])
    .onConflictDoUpdate({
      target: [spaceMembers.spaceId, spaceMembers.userId],
      set: {
        username: sql`excluded.username`,
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
  await upsertGroups(tx, space.id, space.groups)
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
        spaceMembers.userId,
        members.map(m => m.uuid)
      )
    )
  )
}

const onGroupChanged: Handler<PlatformEvent> = async (event, tx) => {
  const { id, groups } = parseOrDrop(groupChanged, event.body, event.routingKey)
  await upsertGroups(tx, id, groups)
}

const onGroupUnlinked: Handler<PlatformEvent> = async (event, tx) => {
  const { id, groups } = parseOrDrop(
    groupUnlinked,
    event.body,
    event.routingKey
  )
  await tx.delete(spaceGroups).where(
    and(
      eq(spaceGroups.spaceId, id),
      inArray(
        spaceGroups.groupId,
        groups.map(g => g.id)
      )
    )
  )
}

const userDeleted = z.looseObject({ uuid: z.uuid() })

const onUserDeleted: Handler<PlatformEvent> = async (event, tx) => {
  const { uuid } = parseOrDrop(userDeleted, event.body, event.routingKey)
  await tx.delete(spaceMembers).where(eq(spaceMembers.userId, uuid))
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
  ['twake.space.group.linked', onGroupChanged],
  ['twake.space.group.role.changed', onGroupChanged],
  ['twake.space.group.unlinked', onGroupUnlinked],
  ['domain.user.deleted', onUserDeleted]
])
