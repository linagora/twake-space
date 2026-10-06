export interface SentryConfig {
  dsn: string
  environment: string | undefined
  feedback: boolean
}

type SentryWindow = Pick<
  Window,
  'SENTRY_DSN' | 'SENTRY_ENVIRONMENT' | 'SENTRY_FEEDBACK_ENABLED'
>

// No DSN, no Sentry. Feedback is off unless the switch is exactly "true".
export function readSentryConfig(
  source: SentryWindow = window
): SentryConfig | null {
  const dsn = source.SENTRY_DSN?.trim()
  if (!dsn) return null
  return {
    dsn,
    environment: source.SENTRY_ENVIRONMENT,
    feedback: source.SENTRY_FEEDBACK_ENABLED === 'true'
  }
}
