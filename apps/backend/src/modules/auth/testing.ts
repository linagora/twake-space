import type { HttpServer } from '../../infra/http.ts'
import type { Identity } from './oidc.ts'
import { registerAuth, type RequireIdentity } from './routes.ts'

export function fakeAuth(
  app: HttpServer,
  identityOf: (token: string) => Identity | null
): RequireIdentity {
  const unused = () => Promise.reject(new Error('not used in this test'))
  return registerAuth(app, {
    authenticate: token => Promise.resolve(identityOf(token)),
    provider: { identify: unused, verifyLogoutToken: unused },
    store: { isRevoked: unused, revoke: unused, saveTicket: unused }
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
