import { describe, expect, it } from 'vitest'

import {
  agentBrief,
  curlExample,
  SCOPE_ROUTES,
  scopesOf,
  TOKEN_SCOPES,
  tokenResources,
  type TokenScope
} from '@/application/tokens'

describe('scopesOf', () => {
  it('grants read with write', () => {
    expect(
      scopesOf({
        spaces: 'write',
        feed: 'write',
        members: 'none',
        notifications: 'read',
        tokens: 'write'
      })
    ).toEqual([
      'space:read',
      'space:write',
      'feed:read',
      'feed:write',
      'notifications:read',
      'tokens:write'
    ])
  })

  it('grants nothing without access', () => {
    expect(
      scopesOf({
        spaces: 'none',
        feed: 'none',
        members: 'none',
        notifications: 'none',
        tokens: 'none'
      })
    ).toEqual([])
  })
})

describe('tokenResources', () => {
  it('leaves notifications out of an organization token', () => {
    expect(tokenResources('personal')).toContain('notifications')
    expect(tokenResources('organization')).not.toContain('notifications')
  })
})

describe('SCOPE_ROUTES', () => {
  // A hand copy of the backend's authorize(scope) routes, less those whose
  // handler refuses every token (the organization token administration).
  const opened: Record<TokenScope, string[]> = {
    'space:read': [
      'GET /spaces',
      'GET /spaces/apps',
      'GET /spaces/:id',
      'GET /spaces/:id/banner'
    ],
    'space:write': [
      'POST /spaces',
      'PATCH /spaces/:id',
      'PUT /spaces/:id/banner',
      'PUT /spaces/:id/state',
      'DELETE /spaces/:id',
      'DELETE /spaces/bin'
    ],
    'members:write': [
      'GET /organization/members',
      'GET /organization/groups',
      'POST /spaces/:id/members',
      'PATCH /spaces/:id/members/:userId',
      'DELETE /spaces/:id/members/:userId',
      'POST /spaces/:id/groups',
      'PATCH /spaces/:id/groups/:groupId',
      'DELETE /spaces/:id/groups/:groupId'
    ],
    'feed:read': [
      'GET /spaces/:spaceId/feed',
      'GET /spaces/:spaceId/feed/items/:itemId',
      'GET /spaces/:spaceId/feed/pinned'
    ],
    'feed:write': [
      'POST /spaces/:spaceId/feed/posts',
      'PATCH /spaces/:spaceId/feed/posts/:itemId',
      'DELETE /spaces/:spaceId/feed/posts/:itemId',
      'POST /spaces/:spaceId/feed/posts/:itemId/close',
      'PUT /spaces/:spaceId/feed/posts/:itemId/pin',
      'DELETE /spaces/:spaceId/feed/posts/:itemId/pin'
    ],
    'tokens:write': [
      'GET /tokens',
      'POST /tokens',
      'PATCH /tokens/:id',
      'DELETE /tokens/:id',
      'GET /organization/token-policy'
    ],
    'notifications:read': ['GET /notifications']
  }

  const expand = (lines: string[]) =>
    lines.flatMap(line => {
      const [methods = '', path = ''] = line.split(/ (?=\/)/)
      return methods.split(', ').map(method => `${method} ${path}`)
    })

  it.each(TOKEN_SCOPES)('lists every route %s opens, and only those', scope => {
    expect(expand(SCOPE_ROUTES[scope]).sort()).toEqual(opened[scope].sort())
  })
})

describe('agentBrief', () => {
  const created = {
    id: 't-1',
    name: 'Assistant',
    token: 'tws_x',
    scopes: ['feed:write' as const],
    spaces: 'all' as const,
    role: null,
    expiresAt: null
  }

  it('tells the agent how to read its own token and who signs its posts', () => {
    const brief = agentBrief('https://space.test/api', created)

    expect(brief).toContain('- GET /tokens/self')
    expect(brief).toContain('- POST /spaces/:spaceId/feed/posts')
    expect(brief).toContain('Posts are signed "Assistant"')
  })

  // The organization token routes pass the scope gate, then answer 403
  // forbidden to every token: the brief must not promise insufficient_scope.
  it('promises a 403 for unlisted routes, not its error code', () => {
    const brief = agentBrief('https://space.test/api', created)

    expect(brief).toContain('Any other route answers 403.')
    expect(brief).not.toContain('insufficient_scope')
  })
})

describe('curlExample', () => {
  it.each(['https://space.test/api', 'https://space.test/api/'])(
    'calls the route every token may call, under the API path of %s',
    apiUrl => {
      expect(curlExample(apiUrl, 'tws_x')).toBe(
        'curl -H "Authorization: Bearer tws_x" https://space.test/api/tokens/self'
      )
    }
  )
})
