import { count } from 'drizzle-orm'
import type { Logger } from 'pino'
import { parkedEvents } from '../../events/schema.ts'
import type { Db } from '../../infra/db.ts'
import { createServer } from '../../infra/http.ts'
import type { ConsumerStats } from '../../infra/amqp.ts'

// The metrics take no token: they get a server of their own, on a port kept
// off the public network, and are never registered on the API server.
export function createMetricsServer(deps: {
  logger: Logger
  db: Db
  consumer: ConsumerStats
}) {
  const { db, consumer } = deps
  const app = createServer({
    logger: deps.logger,
    isReady: () => Promise.resolve(true)
  })

  app.get('/metrics', async (_request, reply) => {
    const [parked] = await db.select({ events: count() }).from(parkedEvents)
    return reply
      .type('text/plain; version=0.0.4; charset=utf-8')
      .send(
        [
          '# HELP twake_space_events_total Messages handled, by outcome.',
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
  return app
}
