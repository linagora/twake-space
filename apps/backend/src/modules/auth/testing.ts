import type { Identity } from './oidc.ts'

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
