import { and, asc, count, eq, isNull } from 'drizzle-orm'
import type { Db } from '../../infra/db.ts'
import type { HttpServer } from '../../infra/http.ts'
import { organizations } from '../organizations/schema.ts'
import { spaces } from '../spaces/schema.ts'
import { activityEvents } from './schema.ts'

const label = (value: string) =>
  value.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('\n', '\\n')

export function registerMetrics(app: HttpServer, deps: { db: Db }) {
  const { db } = deps

  app.get('/metrics', async (_request, reply) => {
    // Organizations with chat and nothing waiting report 0, so alerts resolve.
    const waiting = await db
      .select({
        organizationId: organizations.organizationId,
        cards: count(activityEvents.id)
      })
      .from(organizations)
      .leftJoin(spaces, eq(spaces.organizationId, organizations.organizationId))
      .leftJoin(
        activityEvents,
        and(
          eq(activityEvents.spaceId, spaces.spaceId),
          isNull(activityEvents.matrixEventId)
        )
      )
      .where(eq(organizations.chatAvailable, true))
      .groupBy(organizations.organizationId)
      .orderBy(asc(organizations.organizationId))
    return reply
      .type('text/plain; version=0.0.4; charset=utf-8')
      .send(
        [
          '# HELP twake_space_cards_waiting Stored events not posted to Matrix yet.',
          '# TYPE twake_space_cards_waiting gauge',
          ...waiting.map(
            w =>
              `twake_space_cards_waiting{organization="${label(w.organizationId)}"} ${String(w.cards)}`
          ),
          ''
        ].join('\n')
      )
  })
}
