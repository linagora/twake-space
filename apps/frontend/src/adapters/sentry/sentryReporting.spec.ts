import * as Sentry from '@sentry/react'
import { describe, expect, it, vi } from 'vitest'

import { startSentry } from './sentryReporting'

vi.mock('@sentry/react', () => ({
  init: vi.fn(),
  setTag: vi.fn(),
  consoleLoggingIntegration: vi.fn(() => ({ name: 'Console' })),
  feedbackIntegration: vi.fn(() => ({
    name: 'Feedback',
    createWidget: vi.fn(() => ({ removeFromDom: vi.fn() }))
  }))
}))

const config = { dsn: 'https://k@errors.example.com/1', environment: 'test' }

describe('startSentry', () => {
  it('does nothing without a config', () => {
    expect(startSentry(null, '1.2.3')).toBeNull()
    expect(Sentry.init).not.toHaveBeenCalled()
  })

  it('tags events with the app and the release, without feedback', () => {
    const service = startSentry({ ...config, feedback: false }, '1.2.3')

    expect(Sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({
        release: '1.2.3',
        initialScope: { tags: { app: 'twake-space' } }
      })
    )
    expect(Sentry.feedbackIntegration).not.toHaveBeenCalled()
    expect(service?.mount({} as never, 'system')).toBeTypeOf('function')
  })

  it('adds the bundled feedback integration, without its own button', () => {
    startSentry({ ...config, feedback: true }, '1.2.3')

    expect(Sentry.feedbackIntegration).toHaveBeenCalledWith(
      expect.objectContaining({
        autoInject: false,
        enableScreenshot: true,
        showBranding: false,
        showName: false,
        showEmail: true,
        isEmailRequired: false
      })
    )
    const init = vi.mocked(Sentry.init).mock.calls[0]?.[0]
    expect(init?.integrations).toHaveLength(2)
  })

  it('tags the open space tab and clears it', () => {
    const service = startSentry({ ...config, feedback: false }, '1.2.3')

    service?.setSpaceTab('mail')
    service?.setSpaceTab(null)

    expect(Sentry.setTag).toHaveBeenNthCalledWith(1, 'space_tab', 'mail')
    expect(Sentry.setTag).toHaveBeenNthCalledWith(2, 'space_tab', undefined)
  })
})
