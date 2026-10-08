import { describe, expect, it } from 'vitest'

import { parseAppNotification } from '@/application/appNotifications'

const show = {
  type: 'twake-embed:notification',
  tag: 't',
  title: 'T',
  body: 'B'
}

describe('parseAppNotification', () => {
  it('accepts a notification and its closing', () => {
    expect(parseAppNotification(show)).toEqual({
      kind: 'show',
      tag: 't',
      title: 'T',
      body: 'B'
    })
    expect(
      parseAppNotification({ type: 'twake-embed:notification-close', tag: 't' })
    ).toEqual({ kind: 'close', tag: 't' })
  })

  it('accepts an empty body and the bounds', () => {
    expect(parseAppNotification({ ...show, body: '' })).not.toBeNull()
    expect(
      parseAppNotification({
        ...show,
        tag: 'a'.repeat(256),
        title: 'a'.repeat(256),
        body: 'a'.repeat(1000)
      })
    ).not.toBeNull()
  })

  it.each([
    ['not an object', 'x'],
    ['null', null],
    ['another type', { ...show, type: 'twake-embed:badges' }],
    ['no tag', { ...show, tag: '' }],
    ['a long tag', { ...show, tag: 'a'.repeat(257) }],
    ['no title', { ...show, title: '' }],
    ['a long title', { ...show, title: 'a'.repeat(257) }],
    ['a long body', { ...show, body: 'a'.repeat(1001) }],
    ['a body that is not text', { ...show, body: 1 }],
    ['a close without tag', { type: 'twake-embed:notification-close' }]
  ])('refuses %s', (_name, data) => {
    expect(parseAppNotification(data)).toBeNull()
  })
})
