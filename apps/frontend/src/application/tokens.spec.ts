import { describe, expect, it } from 'vitest'

import { curlExample, scopesOf } from '@/application/tokens'

describe('scopesOf', () => {
  it('grants read with write', () => {
    expect(
      scopesOf({
        spaces: 'write',
        feed: 'read',
        members: 'none',
        tokens: 'write'
      })
    ).toEqual(['space:read', 'space:write', 'feed:read', 'tokens:write'])
  })

  it('grants nothing without access', () => {
    expect(
      scopesOf({
        spaces: 'none',
        feed: 'none',
        members: 'none',
        tokens: 'none'
      })
    ).toEqual([])
  })
})

describe('curlExample', () => {
  it.each(['https://space.test/api', 'https://space.test/api/'])(
    'keeps the API path of %s',
    apiUrl => {
      expect(curlExample(apiUrl, 'tws_x')).toBe(
        'curl -H "Authorization: Bearer tws_x" https://space.test/api/spaces'
      )
    }
  )
})
