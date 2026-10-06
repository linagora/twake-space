import * as Sentry from '@sentry/node'

// Loaded with --import: in ESM, pino and Fastify are only instrumented when
// Sentry is initialised before they are imported. Unset SENTRY_DSN disables it.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.SENTRY_ENVIRONMENT,
  integrations: [
    Sentry.pinoIntegration({ error: { levels: ['error', 'fatal'] } }),
    // Sentry's default only warns, where Node would stop the process.
    Sentry.onUnhandledRejectionIntegration({ mode: 'strict' })
  ]
})
