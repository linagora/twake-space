import { and, eq, lt } from 'drizzle-orm'
import type { Logger } from 'pino'
import type { Db } from '../../infra/db.ts'
import type { ListedMember, SpaceDirectory } from '../../infra/ldap-rest.ts'
import { organizations } from '../organizations/schema.ts'
import {
  createSpace,
  deleteSpace,
  removeSpaceMembers,
  renameSpace,
  unlinkGroups,
  upsertGroups,
  upsertMembers
} from './events.ts'
import {
  spaceGroups,
  spaceMembers,
  spaceReconciliations,
  spaces
} from './schema.ts'

type Reader = Pick<SpaceDirectory, 'list' | 'members' | 'groups' | 'exists'>

const CHECK_EVERY_MS = 60 * 60 * 1000
const ACTOR = 'reconciliation'

const readable = (
  m: ListedMember
): m is ListedMember & { uuid: string; email: string } =>
  m.uuid !== undefined && m.email !== undefined

// Repairs what lost events left behind. Each step is stamped with the time
// taken before reading ldap-rest, so a change applied since then wins: the
// name with the time before listing, members and groups with the time before
// reading them.
export async function reconcileOrganization(
  db: Db,
  directory: Reader,
  log: Logger,
  organizationId: string
) {
  const listedAt = new Date()
  const listed = await directory.list(organizationId)
  // Its deletion event cleans up; deleting every space on a 404 is too blunt.
  if (!listed) {
    log.info({ organizationId }, 'ldap-rest does not know the organization')
    return
  }
  for (const { id, name } of listed) {
    const at = new Date()
    const read = await Promise.all([
      directory.members(organizationId, id),
      directory.groups(organizationId, id)
    ]).catch(async (error: unknown) => {
      // Deleted since the listing: its deletion event removes it.
      if (!(await directory.exists(organizationId, id))) return undefined
      throw error
    })
    if (!read) continue
    const [members, groups] = read
    const people = members.filter(readable)
    await db.transaction(async tx => {
      const [space] = await tx
        .select({ name: spaces.name })
        .from(spaces)
        .where(eq(spaces.spaceId, id))
      if (!space) {
        await createSpace(
          tx,
          log,
          { id, organizationId, name, members: people, groups },
          listedAt
        )
        return
      }
      if (space.name !== name) await renameSpace(tx, id, name, listedAt)

      const copied = await tx
        .select()
        .from(spaceMembers)
        .where(eq(spaceMembers.spaceId, id))
      const byUser = new Map(copied.map(m => [m.userId, m]))
      await upsertMembers(
        tx,
        log,
        id,
        at,
        people.filter(p => {
          const row = byUser.get(p.uuid)
          return (
            row?.role !== p.role ||
            row.username !== p.username ||
            row.email !== p.email
          )
        })
      )
      const listedIds = new Set(people.map(p => p.uuid))
      const unreadable = new Set(
        members.filter(m => !readable(m)).map(m => m.username)
      )
      const gone = copied.filter(
        m => !listedIds.has(m.userId) && !unreadable.has(m.username)
      )
      if (gone.length > 0) {
        await removeSpaceMembers(
          tx,
          log,
          id,
          at,
          gone.map(m => ({ uuid: m.userId }))
        )
      }

      const linked = await tx
        .select()
        .from(spaceGroups)
        .where(eq(spaceGroups.spaceId, id))
      const byGroup = new Map(linked.map(g => [g.groupId, g]))
      const changed = groups.filter(g => {
        const row = byGroup.get(g.id)
        return row?.role !== g.role || row.name !== g.name
      })
      if (changed.length > 0) await upsertGroups(tx, id, at, changed)
      const listedGroups = new Set(groups.map(g => g.id))
      const unlinked = linked
        .filter(g => !listedGroups.has(g.groupId))
        .map(g => g.groupId)
      if (unlinked.length > 0) await unlinkGroups(tx, id, at, unlinked)
    })
  }

  const kept = new Set(listed.map(s => s.id))
  const copied = await db
    .select({ id: spaces.spaceId })
    .from(spaces)
    .where(eq(spaces.organizationId, organizationId))
  for (const { id } of copied.filter(s => !kept.has(s.id))) {
    // A paged listing skips a space when one before it goes away mid-read.
    if (await directory.exists(organizationId, id)) continue
    await db.transaction(tx => deleteSpace(tx, id, listedAt, ACTOR))
  }
}

function lastNight(now: Date) {
  const night = new Date(now)
  night.setUTCHours(2, 0, 0, 0)
  if (night > now) night.setUTCDate(night.getUTCDate() - 1)
  return night
}

// One replica wins each organization's claim; an organization never
// reconciled is due at once.
async function claim(db: Db, organizationId: string, now: Date) {
  const claimed = await db
    .insert(spaceReconciliations)
    .values({ organizationId, ranAt: now })
    .onConflictDoUpdate({
      target: spaceReconciliations.organizationId,
      set: { ranAt: now },
      setWhere: lt(spaceReconciliations.ranAt, lastNight(now))
    })
    .returning({ organizationId: spaceReconciliations.organizationId })
  return claimed.length > 0
}

export async function reconcileDue(
  db: Db,
  directory: Reader,
  log: Logger,
  now = new Date()
) {
  const known = await db
    .select({ id: organizations.organizationId })
    .from(organizations)
    .union(db.selectDistinct({ id: spaces.organizationId }).from(spaces))
  for (const { id } of known) {
    if (!(await claim(db, id, now))) continue
    try {
      await reconcileOrganization(db, directory, log, id)
    } catch (error) {
      log.error({ err: error, organizationId: id }, 'reconciliation failed')
      // So the next pass tries again.
      await db
        .delete(spaceReconciliations)
        .where(
          and(
            eq(spaceReconciliations.organizationId, id),
            eq(spaceReconciliations.ranAt, now)
          )
        )
    }
  }
}

export function scheduleReconciliation(
  db: Db,
  directory: Reader,
  logger: Logger
): () => void {
  const reconcile = () => {
    reconcileDue(db, directory, logger).catch((error: unknown) => {
      logger.error({ err: error }, 'reconciliation failed')
    })
  }
  reconcile()
  const timer = setInterval(reconcile, CHECK_EVERY_MS)
  return () => {
    clearInterval(timer)
  }
}
