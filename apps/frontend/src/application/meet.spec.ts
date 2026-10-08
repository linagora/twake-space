import { describe, expect, it } from 'vitest'

import { meetRoomUrl } from '@/application/meet'

const MEET = 'https://meet.test/'

describe('meetRoomUrl', () => {
  it.each([
    ['a room link', 'https://meet.test/abc-defg-hij'],
    ['a room link with a query', ' https://meet.test/abc-defg-hij/?lang=fr '],
    ['a room link in capitals', 'HTTPS://MEET.TEST/ABC-DEFG-HIJ'],
    ['a code', 'abc-defg-hij'],
    ['a code without dashes', 'ABCDEFGHIJ']
  ])('reads %s', (_name, text) => {
    expect(meetRoomUrl(text, MEET)).toBe('https://meet.test/abc-defg-hij')
  })

  it.each([
    ['a link to another site', 'https://evil.test/abc-defg-hij'],
    ['a link to another page of Meet', 'https://meet.test/abc-defg-hij/x'],
    ['a short code', 'abc-defg'],
    ['digits', '123-4567-890'],
    ['nothing', '  ']
  ])('refuses %s', (_name, text) => {
    expect(meetRoomUrl(text, MEET)).toBeNull()
  })
})
