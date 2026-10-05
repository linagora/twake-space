import * as Sentry from '@sentry/node'
import { pino } from 'pino'
import { loadConfig } from './config.ts'
import { postgresDeduplicator } from './events/dedupe.ts'
import { createMessageHandler, type Routes } from './events/router.ts'
import { createDb, migrateDb } from './infra/db.ts'
import { createServer } from './infra/http.ts'
import { startConsumer, startDeadLetterProducer } from './infra/kafka.ts'
import { listenForRevocations, setUpAuth } from './modules/auth/index.ts'
import { activityRoute } from './modules/feed/activity.ts'
import { schedulePurge } from './modules/feed/retention.ts'
import { registerLiveRoutes } from './modules/live/routes.ts'
import { createStreams } from './modules/live/streams.ts'
import { spacePlatformRoutes } from './modules/spaces/events.ts'
import { resourceActivityRoutes } from './modules/spaces/resources.ts'
import { registerSpaceRoutes } from './modules/spaces/routes.ts'
import { registerTokenRoutes } from './modules/tokens/routes.ts'

const config = loadConfig()
const logger = pino({ level: config.LOG_LEVEL })

const routes: Routes = {
  activity: {
    get: type => resourceActivityRoutes.get(type) ?? activityRoute.get(type)
  },
  platform: spacePlatformRoutes
}

const { sql, db } = createDb(config.DATABASE_URL)
await migrateDb(db)

let accepting = false
const server = createServer({
  logger,
  isReady: async () => accepting && (await sql`select 1`).length === 1
})
const authorize = await setUpAuth(server, {
  db,
  oidc: {
    issuer: new URL(config.OIDC_ISSUER),
    clientId: config.OIDC_CLIENT_ID,
    clientSecret: config.OIDC_CLIENT_SECRET,
    audience: config.OIDC_AUDIENCE
  }
})
registerSpaceRoutes(server, { db, authorize })
registerTokenRoutes(server, { db, authorize })
const streams = createStreams()
registerLiveRoutes(server, { authorize, streams })
await listenForRevocations(sql, sessionId => {
  streams.closeSession(sessionId)
})
await server.listen({ host: config.HTTP_HOST, port: config.HTTP_PORT })

const deadLetters = await startDeadLetterProducer(config, logger)
const consumer = await startConsumer(
  config,
  logger,
  createMessageHandler({
    routes,
    dedupe: postgresDeduplicator(db, config.KAFKA_GROUP_ID),
    deadLetter: deadLetters.send,
    logger
  })
)
const stopPurge = schedulePurge(db, logger)
accepting = true
logger.info('twake-space backend started')

let stopping = false
async function shutdown(signal: string): Promise<void> {
  if (stopping) return
  stopping = true
  accepting = false
  logger.info({ signal }, 'shutting down')
  stopPurge()
  try {
    await consumer.disconnect()
    await deadLetters.disconnect()
    await server.close()
    await sql.end({ timeout: 5 })
  } catch (error) {
    logger.error({ err: error }, 'shutdown failed')
    process.exitCode = 1
  }
  await Sentry.close(2000)
}

process.once('SIGTERM', signal => void shutdown(signal))
process.once('SIGINT', signal => void shutdown(signal))
