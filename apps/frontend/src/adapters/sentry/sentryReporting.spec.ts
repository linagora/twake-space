import {
  attachFeedback,
  makeFeedbackIntegration
} from '@linagora/twake-feedback/sentry'
import * as Sentry from '@sentry/react'
import { describe, expect, it, vi } from 'vitest'

import { startSentry } from './sentryReporting'

vi.mock('@sentry/react', () => ({
  init: vi.fn(),
  setTag: vi.fn(),
  consoleLoggingIntegration: vi.fn(() => ({ name: 'Console' }))
}))

const integration = { name: 'Feedback', setTheme: vi.fn() }
const detach = vi.fn()

vi.mock('@linagora/twake-feedback/sentry', () => ({
  makeFeedbackIntegration: vi.fn(() => integration),
  attachFeedback: vi.fn(() => detach)
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
    expect(makeFeedbackIntegration).not.toHaveBeenCalled()
    expect(service?.enabled).toBe(false)
    expect(service?.attach(document.body, {})).toBeTypeOf('function')
    expect(attachFeedback).not.toHaveBeenCalled()
  })

  it('adds the shared feedback integration, and attaches it to the button', () => {
    const service = startSentry({ ...config, feedback: true }, '1.2.3')

    expect(makeFeedbackIntegration).toHaveBeenCalledOnce()
    const init = vi.mocked(Sentry.init).mock.calls[0]?.[0]
    expect(init?.integrations).toHaveLength(2)
    expect(init?.integrations).toContain(integration)

    const labels = { formTitle: 'Send feedback' }
    const detached = service?.attach(document.body, labels)
    expect(service?.enabled).toBe(true)
    expect(attachFeedback).toHaveBeenCalledWith(
      integration,
      document.body,
      labels
    )
    expect(detached).toBe(detach)
  })

  it('passes the color scheme of the app to the form', () => {
    const service = startSentry({ ...config, feedback: true }, '1.2.3')

    service?.setColorScheme('dark')

    expect(integration.setTheme).toHaveBeenCalledWith('dark')
  })

  it('tags the open space tab and clears it', () => {
    const service = startSentry({ ...config, feedback: false }, '1.2.3')

    service?.setSpaceTab('mail')
    service?.setSpaceTab(null)

    expect(Sentry.setTag).toHaveBeenNthCalledWith(1, 'space_tab', 'mail')
    expect(Sentry.setTag).toHaveBeenNthCalledWith(2, 'space_tab', undefined)
  })
})
