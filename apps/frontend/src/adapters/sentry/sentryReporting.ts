import {
  attachFeedback,
  makeFeedbackIntegration
} from '@linagora/twake-feedback/sentry'
import * as Sentry from '@sentry/react'

import type { FeedbackService } from '@/application/feedback'
import type { SentryConfig } from './sentryConfig'

// The feedback integration is the sync one, bundled: the async one loads code
// from Sentry's CDN, which `script-src 'self'` refuses.
// Starts error reporting, and returns the service the UI talks to. Without a
// config nothing starts and there is no service. Tracing and replay stay off,
// and the user's email and name never go on an event.
export function startSentry(
  config: SentryConfig | null,
  release: string
): FeedbackService | null {
  if (!config) return null
  const feedback = config.feedback ? makeFeedbackIntegration() : null
  Sentry.init({
    dsn: config.dsn,
    environment: config.environment,
    release,
    initialScope: { tags: { app: 'twake-space' } },
    integrations: [
      Sentry.consoleLoggingIntegration({ levels: ['info', 'warn', 'error'] }),
      ...(feedback ? [feedback] : [])
    ],
    denyUrls: [/^(chrome|moz|safari(-web)?)-extension:\/\//]
  })
  return {
    enabled: feedback !== null,
    attach: (el, labels) =>
      feedback ? attachFeedback(feedback, el, labels) : () => undefined,
    setColorScheme: scheme => {
      feedback?.setTheme(scheme)
    },
    setSpaceTab: tab => {
      Sentry.setTag('space_tab', tab ?? undefined)
    }
  }
}
