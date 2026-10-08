import { afterEach, describe, expect, it, vi } from 'vitest'

import { browserNotifications } from './browserNotifications'

// The Notification API, with the permission not asked yet
function stubNotifications(answer: NotificationPermission) {
  const shown: string[] = []
  const instances: FakeNotification[] = []
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
      instances.push(this)
    }
    close() {
      this.onclose?.()
    }
  }
  vi.stubGlobal('Notification', FakeNotification)
  return { shown, instances, requestPermission }
}

describe('browserNotifications', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('asks the permission at the next click, then shows what waited', async () => {
    const { shown, requestPermission } = stubNotifications('granted')
    const notifications = browserNotifications()

    notifications.show('chat', { tag: 't', title: 'Alice', body: '' }, vi.fn())
    expect(requestPermission).not.toHaveBeenCalled()

    window.dispatchEvent(new MouseEvent('click'))
    await Promise.resolve()

    expect(requestPermission).toHaveBeenCalledOnce()
    expect(shown).toEqual(['Alice'])
  })

  it('asks nothing once what waited was closed before the click', () => {
    const { requestPermission } = stubNotifications('granted')
    const notifications = browserNotifications()

    notifications.show('chat', { tag: 't', title: 'Alice', body: '' }, vi.fn())
    notifications.close('chat', 't')
    window.dispatchEvent(new MouseEvent('click'))

    expect(requestPermission).not.toHaveBeenCalled()
  })

  it('brings the page forward and calls back on a click', async () => {
    const { instances } = stubNotifications('granted')
    const focus = vi.spyOn(window, 'focus').mockImplementation(() => undefined)
    const onClick = vi.fn()
    const notifications = browserNotifications()

    notifications.show('chat', { tag: 't', title: 'Alice', body: '' }, onClick)
    window.dispatchEvent(new MouseEvent('click'))
    await Promise.resolve()
    instances[0]?.onclick?.()

    expect(focus).toHaveBeenCalled()
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('says a notification waits, and asks from a click of the page', async () => {
    const { shown, requestPermission } = stubNotifications('granted')
    const notifications = browserNotifications()
    const listener = vi.fn()
    notifications.subscribe(listener)

    notifications.show('chat', { tag: 't', title: 'Alice', body: '' }, vi.fn())
    expect(notifications.isWaiting()).toBe(true)
    expect(listener).toHaveBeenCalled()

    notifications.allow()
    await Promise.resolve()

    expect(requestPermission).toHaveBeenCalledOnce()
    expect(shown).toEqual(['Alice'])
    expect(notifications.isWaiting()).toBe(false)
  })
})
