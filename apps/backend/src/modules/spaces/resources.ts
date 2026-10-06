import { sql } from 'drizzle-orm'
import { z } from 'zod'
import type { CloudEvent } from '../../events/envelope.ts'
import { fresh } from '../../events/freshness.ts'
import { parseOrDrop, type Handler } from '../../events/router.ts'
import { tellSpaceMembers } from '../live/notify.ts'
import { deletedAfter, resourceKey } from './events.ts'
import { spaceResourceKind, spaceResources } from './schema.ts'

type SpaceResourceKind = (typeof spaceResourceKind.enumValues)[number]

const APP_KINDS = {
  drive: 'drive',
  mail: 'mailbox',
  calendar: 'calendar',
  chat: 'matrix_space',
  tasks: 'tasks'
} as const satisfies Record<string, SpaceResourceKind>

function onProvisioned(kind: SpaceResourceKind): Handler<CloudEvent> {
  const provisioned = z.looseObject({
    twakeorg: z.string().min(1),
    data: z.looseObject({
      space_id: z.uuid(),
      resource: z.looseObject({ kind: z.literal(kind), id: z.string().min(1) })
    })
  })
  return async (event, tx) => {
    const {
      twakeorg,
      data: { space_id, resource }
    } = parseOrDrop(provisioned, event, event.type)
    const at = event.time === undefined ? undefined : new Date(event.time)
    if (await deletedAfter(tx, space_id, at)) return
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
