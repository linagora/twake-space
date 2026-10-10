import { eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import type { CloudEvent } from '../../events/envelope.ts'
import { fresh } from '../../events/freshness.ts'
import {
  parseOrDrop,
  RejectedEventError,
  type Handler
} from '../../events/router.ts'
import { attachToSpace } from '../feed/activity.ts'
import { tellSpaceMembers } from '../live/notify.ts'
import { deletedAfter, resourceKey } from './events.ts'
import { spaceResourceKind, spaceResources, spaces } from './schema.ts'

type SpaceResourceKind = (typeof spaceResourceKind.enumValues)[number]

export const spaceApp = z.enum(['chat', 'tasks', 'drive', 'mail', 'calendar'])
export type SpaceApp = z.infer<typeof spaceApp>

export const APP_KINDS = {
  drive: 'drive',
  mail: 'mailbox',
  calendar: 'calendar',
  chat: 'matrix_space',
  tasks: 'project'
} as const satisfies Record<SpaceApp, SpaceResourceKind>

function onProvisioned(kind: SpaceResourceKind): Handler<CloudEvent> {
  const provisioned = z.looseObject({
    twakeorg: z.string().min(1),
    data: z.looseObject({
      space_id: z.uuid(),
      resource: z.looseObject({ kind: z.literal(kind), id: z.string().min(1) })
    })
  })
  return async (event, tx, log) => {
    const {
      twakeorg,
      data: { space_id, resource }
    } = parseOrDrop(provisioned, event, event.type)
    const at = event.time === undefined ? undefined : new Date(event.time)
    if (await deletedAfter(tx, space_id, at)) return
    const [space] = await tx
      .select({ organizationId: spaces.organizationId })
      .from(spaces)
      .where(eq(spaces.spaceId, space_id))
    // An app provisions on the space's created event, which reached our queue
    // before this one, so the space was deleted meanwhile; the app's next sync
    // removes the resource.
    if (!space) {
      log.warn({ spaceId: space_id, kind }, 'resource of an unknown space')
      return
    }
    if (space.organizationId !== twakeorg) {
      throw new RejectedEventError(
        `space ${space_id} belongs to another organization`
      )
    }
    if (!(await fresh(tx, at, [resourceKey(space_id, kind)])).size) return
    await tx
      .insert(spaceResources)
      .values({
        spaceId: space_id,
        kind,
        organizationId: twakeorg,
        resourceId: resource.id
      })
      .onConflictDoUpdate({
        target: [spaceResources.spaceId, spaceResources.kind],
        set: { resourceId: resource.id, provisionedAt: sql`now()` }
      })
    await attachToSpace(tx, space_id, twakeorg, { kind, id: resource.id })
    await tellSpaceMembers(tx, space_id)
  }
}

export const resourceActivityRoutes: ReadonlyMap<
  string,
  Handler<CloudEvent>
> = new Map(
  Object.entries(APP_KINDS).map(([app, kind]) => [
    `com.twake.${app}.space.provisioned.v1`,
    onProvisioned(kind)
  ])
)
