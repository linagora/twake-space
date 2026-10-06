import { and, asc, count, eq, isNull, sql } from 'drizzle-orm'
import { parkedEvents } from '../../events/schema.ts'
import type { Db } from '../../infra/db.ts'
import type { HttpServer } from '../../infra/http.ts'
import type { ConsumerStats } from '../../infra/kafka.ts'
import { organizations } from '../organizations/schema.ts'
import { spaces } from '../spaces/schema.ts'
import { activityEvents } from './schema.ts'

const label = (value: string) =>
  value.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('\n', '\\n')

export function registerMetrics(
  app: HttpServer,
  deps: { db: Db; consumer: ConsumerStats }
) {
  const { db, consumer } = deps

  app.get('/metrics', async (_request, reply) => {
    // Organizations with chat and nothing waiting report 0, so alerts resolve.
    const waiting = await db
      .select({
        organizationId: organizations.organizationId,
        cards: sql<number>`(count(${activityEvents.id}) filter (where ${activityEvents.postFailedAt} is null))::int`,
        failed: count(activityEvents.postFailedAt)
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
    const [parked] = await db.select({ events: count() }).from(parkedEvents)
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
          '# HELP twake_space_cards_failed Stored events the homeserver refused for good.',
          '# TYPE twake_space_cards_failed gauge',
          ...waiting.map(
            w =>
              `twake_space_cards_failed{organization="${label(w.organizationId)}"} ${String(w.failed)}`
          ),
          '# HELP twake_space_events_total Kafka messages handled, by outcome.',
          '# TYPE twake_space_events_total counter',
          ...[...consumer.outcomes].map(
            ([outcome, total]) =>
              `twake_space_events_total{outcome="${outcome}"} ${String(total)}`
          ),
          '# HELP twake_space_parked_events Events waiting for a space or member.',
          '# TYPE twake_space_parked_events gauge',
          `twake_space_parked_events ${String(parked?.events ?? 0)}`,
          ''
        ].join('\n')
      )
  })
}
