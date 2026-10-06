import * as Sentry from '@sentry/react'

import type { FeedbackService } from '@/application/feedback'
import type { SentryConfig } from './sentryConfig'

// The sync integration is bundled: the async one loads code from Sentry's CDN,
// which `script-src 'self'` refuses.
function makeFeedbackIntegration(): ReturnType<
  typeof Sentry.feedbackIntegration
> {
  return Sentry.feedbackIntegration({
    autoInject: false,
    enableScreenshot: true,
    showBranding: false,
    showName: false,
    showEmail: true,
    isEmailRequired: false
  })
}

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
    mount: (labels, colorScheme) => {
      if (!feedback) return () => undefined
      const widget = feedback.createWidget({ ...labels, colorScheme })
      return () => {
        widget.removeFromDom()
      }
    },
    setSpaceTab: tab => {
      Sentry.setTag('space_tab', tab ?? undefined)
    }
  }
}
