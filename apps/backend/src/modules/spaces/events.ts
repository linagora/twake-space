import { and, eq, gt, inArray, isNull, or, sql, type SQL } from 'drizzle-orm'
import type { Logger } from 'pino'
import { z } from 'zod'
import type { PlatformEvent } from '../../events/envelope.ts'
import { fresh } from '../../events/freshness.ts'
import { lastChanges } from '../../events/schema.ts'
import { parseOrDrop, type Handler } from '../../events/router.ts'
import type { Tx } from '../../infra/db.ts'
import { forgetActor } from '../feed/activity.ts'
import { deleteNotificationsOf } from '../notifications/recipients.ts'
import { resourceKey } from './resources.ts'
import {
  organizationMembers,
  organizationRole,
  spaceGroups,
  spaceMembers,
  spaceResources,
  spaceRole,
  spaces
} from './schema.ts'

const timestamp = z.iso
  .datetime({ offset: true })
  .optional()
  .transform(t => (t === undefined ? undefined : new Date(t)))

const spaceEvent = z.looseObject({
  organizationId: z.string().min(1),
  id: z.uuid(),
  timestamp
})

// Only created and deleted change it: a rename applied before a replayed creation must
// not hold the creation back.
const spaceKey = (spaceId: string) => `space:${spaceId}`
const spaceNameKey = (spaceId: string) => `space:${spaceId}:name`
const memberKey = (spaceId: string, user: string) =>
  `space:${spaceId}:member:${user}`
const groupKey = (spaceId: string, groupId: string) =>
  `space:${spaceId}:group:${groupId}`

const role = z.enum(spaceRole.enumValues)

const member = z.looseObject({
  uuid: z.uuid().optional(),
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

const person = z
  .looseObject({ uuid: z.uuid().optional(), email: z.email().optional() })
  .refine(p => p.uuid ?? p.email, 'needs a uuid or an email')

const memberRemoved = spaceEvent.extend({
  members: z.array(person).min(1)
})

const groupChanged = spaceEvent.extend({ groups: z.array(group).min(1) })

const groupUnlinked = spaceEvent.extend({
  groups: z.array(z.looseObject({ id: z.uuid() })).min(1)
})

interface Person {
  uuid?: string | undefined
  email?: string | undefined
}

// ldap-rest does not send the uuid yet, so a person without one is matched in
// the copy by email. Remove withoutUuid and its uses once it does.
function withoutUuid(log: Logger, people: Person[]) {
  const emails = people.flatMap(p => (!p.uuid && p.email ? [p.email] : []))
  if (emails.length > 0) {
    log.warn(
      { withoutUuid: emails.length },
      'matching people sent without a uuid by email'
    )
  }
  return emails
}

function matching(log: Logger, people: Person[]) {
  return or(
    inArray(
      spaceMembers.userId,
      people.flatMap(p => (p.uuid ? [p.uuid] : []))
    ),
    inArray(spaceMembers.email, withoutUuid(log, people))
  )
}

async function withUserIds<T extends Person>(
  tx: Tx,
  log: Logger,
  people: T[]
): Promise<(T & { uuid: string })[]> {
  const emails = withoutUuid(log, people)
  const known = new Map<string, string>()
  if (emails.length > 0) {
    const rows = await tx
      .selectDistinct({
        email: spaceMembers.email,
        userId: spaceMembers.userId
      })
      .from(spaceMembers)
      .where(inArray(spaceMembers.email, emails))
    for (const row of rows) known.set(row.email, row.userId)
  }
  return people.flatMap(p => {
    const uuid = p.uuid ?? (p.email ? known.get(p.email) : undefined)
    return uuid ? [{ ...p, uuid }] : []
  })
}

async function upsertGroups(
  tx: Tx,
  spaceId: string,
  at: Date | undefined,
  groups: z.infer<typeof group>[]
) {
  if (await deletedAfter(tx, spaceId, at)) return
  const changed = await fresh(
    tx,
    at,
    groups.map(g => groupKey(spaceId, g.id))
  )
  const byId = new Map(
    groups
      .filter(g => changed.has(groupKey(spaceId, g.id)))
      .map(({ id, name, role }) => [id, { spaceId, groupId: id, name, role }])
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
  log: Logger,
  spaceId: string,
  at: Date | undefined,
  members: z.infer<typeof member>[]
) {
  if (await deletedAfter(tx, spaceId, at)) return
  const known = await withUserIds(tx, log, members)
  const changed = await fresh(
    tx,
    at,
    known.map(m => memberKey(spaceId, m.uuid))
  )
  // One upsert cannot touch a row twice, so a member listed twice keeps its last entry.
  const byUser = new Map(
    known
      .filter(m => changed.has(memberKey(spaceId, m.uuid)))
      .map(({ uuid, username, email, role }) => [
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

async function deletedAfter(tx: Tx, spaceId: string, at: Date | undefined) {
  if (at === undefined) return false
  const [deletion] = await tx
    .select({ at: lastChanges.at })
    .from(lastChanges)
    .leftJoin(spaces, eq(spaces.spaceId, spaceId))
    .where(
      and(
        eq(lastChanges.object, spaceKey(spaceId)),
        gt(lastChanges.at, at),
        isNull(spaces.spaceId)
      )
    )
  return deletion !== undefined
}

// Each caller scopes `where` to one space or one user, so the pairs left after the
// freshness check are the rows of the remaining user ids.
async function removeMembers(
  tx: Tx,
  at: Date | undefined,
  where: SQL | undefined
) {
  const named = await tx
    .select({ spaceId: spaceMembers.spaceId, userId: spaceMembers.userId })
    .from(spaceMembers)
    .where(where)
  const changed = await fresh(
    tx,
    at,
    named.map(m => memberKey(m.spaceId, m.userId))
  )
  const removed = named.filter(m => changed.has(memberKey(m.spaceId, m.userId)))
  if (removed.length === 0) return
  await tx.delete(spaceMembers).where(
    and(
      where,
      inArray(
        spaceMembers.spaceId,
        removed.map(m => m.spaceId)
      ),
      inArray(
        spaceMembers.userId,
        removed.map(m => m.userId)
      )
    )
  )
}

const onCreated: Handler<PlatformEvent> = async (event, tx, log) => {
  const space = parseOrDrop(spaceCreated, event.body, event.routingKey)
  const at = space.timestamp
  if (!(await fresh(tx, at, [spaceKey(space.id)])).size) return
  const renamed = (await fresh(tx, at, [spaceNameKey(space.id)])).size > 0
  const insert = tx.insert(spaces).values({
    spaceId: space.id,
    organizationId: space.organizationId,
    name: space.name
  })
  await (renamed
    ? insert.onConflictDoUpdate({
        target: spaces.spaceId,
        set: { name: space.name, updatedAt: sql`now()` }
      })
    : insert.onConflictDoNothing())
  await upsertMembers(tx, log, space.id, at, space.members)
  await upsertGroups(tx, space.id, at, space.groups)
}

const onUpdated: Handler<PlatformEvent> = async (event, tx) => {
  const { id, name, timestamp } = parseOrDrop(
    spaceUpdated,
    event.body,
    event.routingKey
  )
  if (name === undefined) return
  if (!(await fresh(tx, timestamp, [spaceNameKey(id)])).size) return
  await tx
    .update(spaces)
    .set({ name, updatedAt: sql`now()` })
    .where(eq(spaces.spaceId, id))
}

const onDeleted: Handler<PlatformEvent> = async (event, tx) => {
  const { id, timestamp } = parseOrDrop(
    spaceEvent,
    event.body,
    event.routingKey
  )
  if (!(await fresh(tx, timestamp, [spaceKey(id)])).size) return
  const members = await tx
    .delete(spaceMembers)
    .where(eq(spaceMembers.spaceId, id))
    .returning({ userId: spaceMembers.userId })
  const groups = await tx
    .delete(spaceGroups)
    .where(eq(spaceGroups.spaceId, id))
    .returning({ groupId: spaceGroups.groupId })
  const resources = await tx
    .delete(spaceResources)
    .where(eq(spaceResources.spaceId, id))
    .returning({ kind: spaceResources.kind })
  // So a replayed event older than the deletion cannot bring them back.
  await fresh(tx, timestamp, [
    ...members.map(m => memberKey(id, m.userId)),
    ...groups.map(g => groupKey(id, g.groupId)),
    ...resources.map(r => resourceKey(id, r.kind))
  ])
  await tx.delete(spaces).where(eq(spaces.spaceId, id))
}

const onMemberChanged: Handler<PlatformEvent> = async (event, tx, log) => {
  const { id, timestamp, members } = parseOrDrop(
    memberChanged,
    event.body,
    event.routingKey
  )
  await upsertMembers(tx, log, id, timestamp, members)
}

const onMemberRemoved: Handler<PlatformEvent> = async (event, tx, log) => {
  const { id, timestamp, members } = parseOrDrop(
    memberRemoved,
    event.body,
    event.routingKey
  )
  await removeMembers(
    tx,
    timestamp,
    and(eq(spaceMembers.spaceId, id), matching(log, members))
  )
}

const onGroupChanged: Handler<PlatformEvent> = async (event, tx) => {
  const { id, timestamp, groups } = parseOrDrop(
    groupChanged,
    event.body,
    event.routingKey
  )
  await upsertGroups(tx, id, timestamp, groups)
}

const onGroupUnlinked: Handler<PlatformEvent> = async (event, tx) => {
  const { id, timestamp, groups } = parseOrDrop(
    groupUnlinked,
    event.body,
    event.routingKey
  )
  const changed = await fresh(
    tx,
    timestamp,
    groups.map(g => groupKey(id, g.id))
  )
  if (changed.size === 0) return
  await tx.delete(spaceGroups).where(
    and(
      eq(spaceGroups.spaceId, id),
      inArray(
        spaceGroups.groupId,
        groups.filter(g => changed.has(groupKey(id, g.id))).map(g => g.id)
      )
    )
  )
}

const groupUpdated = z.looseObject({
  id: z.uuid(),
  name: z.string().optional(),
  timestamp
})

const onGroupUpdated: Handler<PlatformEvent> = async (event, tx) => {
  const { id, name, timestamp } = parseOrDrop(
    groupUpdated,
    event.body,
    event.routingKey
  )
  if (!name) return
  if (!(await fresh(tx, timestamp, [`group:${id}:name`])).size) return
  await tx.update(spaceGroups).set({ name }).where(eq(spaceGroups.groupId, id))
}

const userDeleted = z
  .looseObject({
    uuid: z.uuid().optional(),
    internalEmail: z.email().optional(),
    timestamp
  })
  .refine(u => u.uuid ?? u.internalEmail, 'needs a uuid or an internalEmail')

const onUserDeleted: Handler<PlatformEvent> = async (event, tx, log) => {
  const { uuid, internalEmail, timestamp } = parseOrDrop(
    userDeleted,
    event.body,
    event.routingKey
  )
  // Before removing members: the email-to-uuid lookup reads them.
  const [known] = await withUserIds(tx, log, [{ uuid, email: internalEmail }])
  if (known) {
    await deleteNotificationsOf(tx, known.uuid)
    await forgetActor(tx, { uuid: known.uuid })
  } else if (internalEmail) {
    await forgetActor(tx, { email: internalEmail })
  }
  await removeMembers(
    tx,
    timestamp,
    matching(log, [known ?? { uuid, email: internalEmail }])
  )
  await tx
    .delete(organizationMembers)
    .where(
      or(
        uuid === undefined ? undefined : eq(organizationMembers.userId, uuid),
        internalEmail === undefined
          ? undefined
          : eq(organizationMembers.email, internalEmail)
      )
    )
}

const organizationRoleChanged = z.looseObject({
  organizationId: z.string().min(1),
  uuid: z.uuid().optional(),
  email: z.email(),
  role: z.enum(organizationRole.enumValues),
  timestamp
})

const onOrganizationRoleChanged: Handler<PlatformEvent> = async (
  event,
  tx,
  log
) => {
  const change = parseOrDrop(
    organizationRoleChanged,
    event.body,
    event.routingKey
  )
  const [user] = await withUserIds(tx, log, [change])
  if (!user) return
  const key = `organization:${user.organizationId}:member:${user.uuid}`
  if (!(await fresh(tx, user.timestamp, [key])).size) return
  await tx
    .insert(organizationMembers)
    .values({
      organizationId: user.organizationId,
      userId: user.uuid,
      email: user.email,
      role: user.role
    })
    .onConflictDoUpdate({
      target: [organizationMembers.organizationId, organizationMembers.userId],
      set: { email: user.email, role: user.role }
    })
}

export const spacePlatformRoutes: ReadonlyMap<
  string,
  Handler<PlatformEvent>
> = new Map([
  ['twake.space.created', onCreated],
  ['b2b.member.role.changed', onOrganizationRoleChanged],
  ['twake.space.updated', onUpdated],
  ['twake.space.deleted', onDeleted],
  ['twake.space.member.added', onMemberChanged],
  ['twake.space.member.role.changed', onMemberChanged],
  ['twake.space.member.removed', onMemberRemoved],
  ['twake.space.group.linked', onGroupChanged],
  ['twake.space.group.role.changed', onGroupChanged],
  ['twake.space.group.unlinked', onGroupUnlinked],
  ['b2b.group.updated', onGroupUpdated],
  ['domain.user.deleted', onUserDeleted]
])
