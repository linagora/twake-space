import { describe, expect, it } from 'vitest'

import { readSentryConfig } from './sentryConfig'

const DSN = 'https://public-key@errors.example.com/42'

describe('readSentryConfig', () => {
  it('is off without a DSN, even when feedback is enabled', () => {
    expect(readSentryConfig({})).toBeNull()
    expect(
      readSentryConfig({ SENTRY_DSN: '', SENTRY_FEEDBACK_ENABLED: 'true' })
    ).toBeNull()
  })

  it('keeps feedback off unless the switch is exactly "true"', () => {
    expect(readSentryConfig({ SENTRY_DSN: DSN })?.feedback).toBe(false)
    for (const value of ['false', '1', 'TRUE', '']) {
      expect(
        readSentryConfig({ SENTRY_DSN: DSN, SENTRY_FEEDBACK_ENABLED: value })
          ?.feedback
      ).toBe(false)
    }
  })

  it('turns feedback on with a DSN and "true"', () => {
    expect(
      readSentryConfig({
        SENTRY_DSN: DSN,
        SENTRY_ENVIRONMENT: 'prod',
        SENTRY_FEEDBACK_ENABLED: 'true'
      })
    ).toEqual({ dsn: DSN, environment: 'prod', feedback: true })
  })
})
