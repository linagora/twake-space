import '@linagora/twake-css/dist/utils.css'

import * as Sentry from '@sentry/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { oidcSession, readSsoConfig } from '@/adapters/oidc/oidcSession'
import { App } from '@/app/App'

Sentry.init({
  dsn: window.SENTRY_DSN,
  environment: window.SENTRY_ENVIRONMENT,
  integrations: [
    Sentry.consoleLoggingIntegration({ levels: ['info', 'warn', 'error'] })
  ],
  denyUrls: [/^(chrome|moz|safari(-web)?)-extension:\/\//]
})

const container = document.getElementById('root')
if (!container) throw new Error('Root element #root not found')

const session = oidcSession(readSsoConfig(window, window.location.origin))

const reportUncaughtError = Sentry.reactErrorHandler((error, info) => {
  console.error(error, info.componentStack)
})

createRoot(container, {
  onUncaughtError: (error, { componentStack }) => {
    reportUncaughtError(error, { componentStack: componentStack ?? null })
  }
}).render(
  <StrictMode>
    <App session={session} />
  </StrictMode>
)
