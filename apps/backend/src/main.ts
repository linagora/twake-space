import { setTimeout as delay } from 'node:timers/promises'
import * as Sentry from '@sentry/node'
import { pino } from 'pino'
import { loadConfig } from './config.ts'
import { postgresDeduplicator } from './events/dedupe.ts'
import { parkIn, scheduleParkedRetries } from './events/parking.ts'
import { createMessageHandler, type Routes } from './events/router.ts'
import {
  consumerAlive,
  consumerStats,
  deadLetterQueue,
  startConsumer
} from './infra/amqp.ts'
import { createDb, migrateDb } from './infra/db.ts'
import { createServer } from './infra/http.ts'
import { handleSignals } from './infra/lifecycle.ts'
import {
  createLdapRestClient,
  ldapRestDirectory,
  ldapRestSpaces
} from './infra/ldap-rest.ts'
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
import { controlPlaneHomeservers } from './modules/organizations/control-plane.ts'
import { registerDirectoryRoutes } from './modules/organizations/directory.ts'
import { configureHomeserver } from './modules/organizations/homeservers.ts'
import { spacePlatformRoutes } from './modules/spaces/events.ts'
import { resourceActivityRoutes } from './modules/spaces/resources.ts'
import { registerSpaceRoutes } from './modules/spaces/routes.ts'
import { registerSpaceWriteRoutes } from './modules/spaces/writes.ts'
import { registerTokenRoutes } from './modules/tokens/routes.ts'

// Readiness answers 503 this long before the server closes, so the load
// balancer stops routing here first. Both fit the default 30 s grace period.
const DRAIN_MS = 5000
const SHUTDOWN_DEADLINE_MS = 25_000

const config = loadConfig()
const logger = pino({ level: config.LOG_LEVEL })
const lifecycle = handleSignals({
  log: logger,
  deadlineMs: SHUTDOWN_DEADLINE_MS
})

const { sql, db } = createDb(config.DATABASE_URL)
await migrateDb(sql)
let homeserverId: string | undefined
if (config.homeserver) {
  const { key, ...homeserver } = config.homeserver
  homeserverId = await configureHomeserver(db, key, homeserver)
}

const ldapRest = createLdapRestClient(config)
const directory = ldapRestDirectory(ldapRest)
const routes: Routes = {
  activity: {
    get: type => resourceActivityRoutes.get(type) ?? activityRoute.get(type)
  },
  platform: meetingOrganizations(
    {
      directory,
      homeserverId,
      tenants: config.controlPlane && {
        homeservers: controlPlaneHomeservers(config.controlPlane),
        key: config.controlPlane.key
      }
    },
    {
      get: key =>
        spacePlatformRoutes.get(key) ?? organizationPlatformRoutes.get(key)
    }
  )
}

let accepting = false
const consumerStatus = consumerStats()
let isAlive = () => true
const server = createServer({
  logger,
  isReady: async () => accepting && (await sql`select 1`).length === 1,
  isAlive: () => isAlive()
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
registerSpaceRoutes(server, { db, authorize, apps: config.spaceApps })
registerSpaceWriteRoutes(server, {
  db,
  authorize,
  directory: ldapRestSpaces(ldapRest)
})
registerTokenRoutes(server, { db, authorize, directory })
registerDirectoryRoutes(server, { authorize, directory })
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
registerMetrics(metrics, { db, consumer: consumerStatus })
await metrics.listen({ host: config.HTTP_HOST, port: config.METRICS_PORT })

const handle = createMessageHandler({
  routes,
  dedupe: postgresDeduplicator(db, 'twake-space'),
  park: parkIn(db),
  logger
})
const consumer = await startConsumer(config, logger, handle, consumerStatus)
isAlive = consumerAlive(consumer, consumerStatus)
const stopParked = scheduleParkedRetries(
  db,
  handle,
  deadLetterQueue(consumer, config.amqp.queue),
  logger
)
const stopPurge = schedulePurge(db, logger)
const secretsKey = (config.homeserver ?? config.controlPlane)?.key
const stopPosting = secretsKey
  ? schedulePosting(db, secretsKey, logger)
  : () => undefined
accepting = true
lifecycle.started(async () => {
  accepting = false
  const parkedStopped = stopParked()
  stopPurge()
  stopPosting()
  try {
    await parkedStopped
    await consumer.close()
    await delay(DRAIN_MS)
    await server.close()
    await metrics.close()
    await sql.end({ timeout: 5 })
  } finally {
    await Sentry.close(2000)
  }
})
logger.info('twake-space backend started')
