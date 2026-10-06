import '@linagora/twake-css/dist/utils.css'

import * as Sentry from '@sentry/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { backend } from '@/adapters/http/backend'
import { httpSpaces } from '@/adapters/http/httpSpaces'
import { liveStream } from '@/adapters/http/liveStream'
import { matrixFeed } from '@/adapters/matrix/matrixFeed'
import { matrixSession } from '@/adapters/matrix/matrixSession'
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

if (!window.API_URL) throw new Error('/.env.js must set API_URL')
const apiUrl = new URL(window.API_URL, window.location.origin).href
const oidc = oidcSession(readSsoConfig(window, apiUrl))
const matrix = matrixSession(localStorage)
const session = {
  ...oidc,
  signOut: async () => {
    await matrix.signOut()
    await oidc.signOut()
  }
}
const api = backend(apiUrl)
const services = {
  spaces: httpSpaces(api),
  live: liveStream(api),
  matrix,
  feed: matrixFeed(matrix.client),
  tasksUrl: window.TASKS_URL ?? null
}

const reportUncaughtError = Sentry.reactErrorHandler((error, info) => {
  console.error(error, info.componentStack)
})

createRoot(container, {
  onUncaughtError: (error, { componentStack }) => {
    reportUncaughtError(error, { componentStack: componentStack ?? null })
  }
}).render(
  <StrictMode>
    <App session={session} services={services} />
  </StrictMode>
)
