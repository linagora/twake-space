import { afterEach, describe, expect, it, vi } from 'vitest'

import { browserNotifications } from './browserNotifications'

// The Notification API, with the permission not asked yet
function stubNotifications(answer: NotificationPermission) {
  const shown: string[] = []
  const requestPermission = vi.fn(() => {
    FakeNotification.permission = answer
    return Promise.resolve(answer)
  })
  class FakeNotification {
    static permission: NotificationPermission = 'default'
    static requestPermission = requestPermission
    onclick: (() => void) | null = null
    onclose: (() => void) | null = null
    constructor(title: string) {
      shown.push(title)
    }
    close() {
      this.onclose?.()
    }
  }
  vi.stubGlobal('Notification', FakeNotification)
  return { shown, requestPermission }
}

describe('browserNotifications', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('asks the permission at the next click, then shows what waited', async () => {
    const { shown, requestPermission } = stubNotifications('granted')
    const notifications = browserNotifications()

    notifications.show('chat', { tag: 't', title: 'Alice', body: '' })
    expect(requestPermission).not.toHaveBeenCalled()

    window.dispatchEvent(new MouseEvent('click'))
    await Promise.resolve()

    expect(requestPermission).toHaveBeenCalledOnce()
    expect(shown).toEqual(['Alice'])
  })

  it('asks nothing once what waited was closed before the click', () => {
    const { requestPermission } = stubNotifications('granted')
    const notifications = browserNotifications()

    notifications.show('chat', { tag: 't', title: 'Alice', body: '' })
    notifications.close('chat', 't')
    window.dispatchEvent(new MouseEvent('click'))

    expect(requestPermission).not.toHaveBeenCalled()
  })
})
