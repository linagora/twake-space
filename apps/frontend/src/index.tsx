import '@linagora/twake-css/dist/utils.css'

import * as Sentry from '@sentry/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { backend } from '@/adapters/http/backend'
import { httpDirectory } from '@/adapters/http/httpDirectory'
import { httpFeed } from '@/adapters/http/httpFeed'
import { httpSettings } from '@/adapters/http/httpSettings'
import { httpSpaces } from '@/adapters/http/httpSpaces'
import { liveStream } from '@/adapters/http/liveStream'
import { oidcSession, readSsoConfig } from '@/adapters/oidc/oidcSession'
import { readSentryConfig } from '@/adapters/sentry/sentryConfig'
import { startSentry } from '@/adapters/sentry/sentryReporting'
import { App } from '@/app/App'

const feedback = startSentry(readSentryConfig(), __APP_VERSION__)

const container = document.getElementById('root')
if (!container) throw new Error('Root element #root not found')

if (!window.API_URL) throw new Error('/.env.js must set API_URL')
const apiUrl = new URL(window.API_URL, window.location.origin).href
const session = oidcSession(readSsoConfig(window, apiUrl))
const api = backend(apiUrl)
const services = {
  spaces: httpSpaces(api),
  settings: httpSettings(api),
  directory: httpDirectory(api),
  live: liveStream(api),
  feed: httpFeed(api),
  feedback,
  tasksUrl: window.TASKS_URL ?? null,
  mailUrl: window.MAIL_URL ?? null,
  driveUrlTemplate: window.DRIVE_URL ?? null
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
