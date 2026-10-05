import * as Sentry from '@sentry/node'
import { pino } from 'pino'
import { loadConfig } from './config.ts'
import { postgresDeduplicator } from './events/dedupe.ts'
import { createMessageHandler, type Routes } from './events/router.ts'
import { createDb, migrateDb } from './infra/db.ts'
import { createServer } from './infra/http.ts'
import { startConsumer, startDeadLetterProducer } from './infra/kafka.ts'
import { createLdapRestClient, ldapRestDirectory } from './infra/ldap-rest.ts'
import { listenForRevocations, setUpAuth } from './modules/auth/index.ts'
import { activityRoute } from './modules/feed/activity.ts'
import { registerMetrics } from './modules/feed/metrics.ts'
import { schedulePosting } from './modules/feed/poster.ts'
import { schedulePurge } from './modules/feed/retention.ts'
import { registerTransactionRoutes } from './modules/feed/transactions.ts'
import { listenForLive } from './modules/live/notify.ts'
import { registerLiveRoutes } from './modules/live/routes.ts'
import { createStreams } from './modules/live/streams.ts'
import { registerNotificationRoutes } from './modules/notifications/routes.ts'
import {
  meetingOrganizations,
  organizationPlatformRoutes
} from './modules/organizations/availability.ts'
import { configureHomeserver } from './modules/organizations/homeservers.ts'
import { spacePlatformRoutes } from './modules/spaces/events.ts'
import { resourceActivityRoutes } from './modules/spaces/resources.ts'
import { registerSpaceRoutes } from './modules/spaces/routes.ts'
import { registerTokenRoutes } from './modules/tokens/routes.ts'

const config = loadConfig()
const logger = pino({ level: config.LOG_LEVEL })

const { sql, db } = createDb(config.DATABASE_URL)
await migrateDb(db)
let homeserverId: string | undefined
if (config.homeserver) {
  const { key, ...homeserver } = config.homeserver
  homeserverId = await configureHomeserver(db, key, homeserver)
}

const directory = ldapRestDirectory(createLdapRestClient(config))
const routes: Routes = {
  activity: {
    get: type => resourceActivityRoutes.get(type) ?? activityRoute.get(type)
  },
  platform: meetingOrganizations(
    { directory, homeserverId },
    {
      get: key =>
        spacePlatformRoutes.get(key) ?? organizationPlatformRoutes.get(key)
    }
  )
}

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
  },
  directory
})
registerSpaceRoutes(server, { db, authorize })
registerTokenRoutes(server, { db, authorize, directory })
registerNotificationRoutes(server, { db, authorize })
registerTransactionRoutes(server, { db, localpart: config.MATRIX_LOCALPART })
const streams = createStreams()
registerLiveRoutes(server, { authorize, streams })
await listenForRevocations(sql, sessionId => {
  streams.closeSession(sessionId)
})
await listenForLive(sql, streams)
await server.listen({ host: config.HTTP_HOST, port: config.HTTP_PORT })
const metrics = createServer({ logger, isReady: () => Promise.resolve(true) })
registerMetrics(metrics, { db })
await metrics.listen({ host: config.HTTP_HOST, port: config.METRICS_PORT })

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
const stopPosting = config.homeserver
  ? schedulePosting(db, config.homeserver.key, logger)
  : () => undefined
accepting = true
logger.info('twake-space backend started')

let stopping = false
async function shutdown(signal: string): Promise<void> {
  if (stopping) return
  stopping = true
  accepting = false
  logger.info({ signal }, 'shutting down')
  stopPurge()
  stopPosting()
  try {
    await consumer.disconnect()
    await deadLetters.disconnect()
    await server.close()
    await metrics.close()
    await sql.end({ timeout: 5 })
  } catch (error) {
    logger.error({ err: error }, 'shutdown failed')
    process.exitCode = 1
  }
  await Sentry.close(2000)
}

process.once('SIGTERM', signal => void shutdown(signal))
process.once('SIGINT', signal => void shutdown(signal))
