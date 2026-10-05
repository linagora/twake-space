import type { HttpServer } from '../../infra/http.ts'
import type { TokenCaller } from '../tokens/authenticator.ts'
import type { Identity } from './oidc.ts'
import { registerAuth, type Authorize } from './routes.ts'

export function fakeAuth(
  app: HttpServer,
  identityOf: (token: string) => Identity | null,
  tokenOf: (token: string) => TokenCaller | null = () => null
): Authorize {
  const unused = () => Promise.reject(new Error('not used in this test'))
  return registerAuth(app, {
    authenticate: token => Promise.resolve(identityOf(token)),
    authenticateToken: token => Promise.resolve(tokenOf(token)),
    provider: { identify: unused, verifyLogoutToken: unused },
    store: { isRevoked: unused, revoke: unused }
  })
}

export function anIdentity(overrides: Partial<Identity> = {}): Identity {
  return {
    subject: 'alice@example.com',
    userId: '8f14e45f-ceea-467a-9575-1d1c2b0c4b2e',
    email: 'alice@example.com',
    sessionId: 'session-1',
    expiresAt: new Date(Date.now() + 300_000),
    organizationId: 'org-1',
    ...overrides
  }
}

export function aTokenCaller(
  overrides: Partial<TokenCaller> = {}
): TokenCaller {
  return {
    kind: 'token',
    tokenId: '5f2b1c3d-4e6f-4a8b-9c0d-1e2f3a4b5c6d',
    name: 'release bot',
    organizationId: 'org-1',
    userId: '8f14e45f-ceea-467a-9575-1d1c2b0c4b2e',
    technical: false,
    role: null,
    scopes: ['space:read'],
    spaceIds: null,
    expiresAt: null,
    ...overrides
  }
}
