import { describe, expect, it, vi } from 'vitest'
import { createAuthenticator } from './authenticator.ts'
import type { Identity, IdentityProvider } from './oidc.ts'
import type { AuthStore } from './store.ts'
import { anIdentity } from './testing.ts'

function setUp(identity: Identity | null = anIdentity()) {
  let clock = Date.now()
  const revoked = new Set<string>()
  const provider: IdentityProvider = {
    identify: vi.fn(() => Promise.resolve(identity)),
    verifyLogoutToken: vi.fn()
  }
  const store: AuthStore = {
    isRevoked: sessionId => Promise.resolve(revoked.has(sessionId)),
    revoke: vi.fn()
  }
  const authenticate = createAuthenticator({
    provider,
    store,
    now: () => clock
  })
  return {
    authenticate,
    identify: provider.identify,
    revoked,
    advance: (ms: number) => {
      clock += ms
    }
  }
}

describe('createAuthenticator', () => {
  it('asks the provider once per token within 60 seconds', async () => {
    const { authenticate, identify, advance } = setUp()

    await authenticate('token')
    advance(59_000)
    await authenticate('token')

    expect(identify).toHaveBeenCalledTimes(1)
  })

  it('asks the provider again after 60 seconds', async () => {
    const { authenticate, identify, advance } = setUp()

    await authenticate('token')
    advance(60_000)
    await authenticate('token')

    expect(identify).toHaveBeenCalledTimes(2)
  })

  it('does not keep a token past its expiry', async () => {
    const identity = anIdentity({ expiresAt: new Date(Date.now() + 10_000) })
    const { authenticate, identify, advance } = setUp(identity)

    await authenticate('token')
    advance(10_000)
    await authenticate('token')

    expect(identify).toHaveBeenCalledTimes(2)
  })

  it('remembers a refused token for 60 seconds', async () => {
    const { authenticate, identify, advance } = setUp(null)

    await expect(authenticate('token')).resolves.toBeNull()
    advance(59_000)
    await expect(authenticate('token')).resolves.toBeNull()
    const within = vi.mocked(identify).mock.calls.length
    advance(1_000)
    await authenticate('token')

    expect(within).toBe(1)
    expect(identify).toHaveBeenCalledTimes(2)
  })

  it('remembers at most 10,000 refused tokens, forgetting the oldest', async () => {
    const { authenticate, identify } = setUp(null)

    for (let i = 0; i <= 10_000; i++) await authenticate(`token-${String(i)}`)
    await authenticate('token-10000')
    await authenticate('token-0')

    expect(identify).toHaveBeenCalledTimes(10_002)
  })

  it('refuses a cached token once its session is revoked', async () => {
    const { authenticate, revoked } = setUp()

    await expect(authenticate('token')).resolves.not.toBeNull()
    revoked.add('session-1')

    await expect(authenticate('token')).resolves.toBeNull()
  })
})
