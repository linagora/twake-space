import { createHash } from 'node:crypto'
import type { Identity, IdentityProvider } from './oidc.ts'
import type { AuthStore } from './store.ts'

export type Authenticate = (accessToken: string) => Promise<Identity | null>

const CACHE_TTL_MS = 60_000
const MAX_REFUSED = 10_000

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('base64url')
}

export function createAuthenticator(deps: {
  provider: IdentityProvider
  store: AuthStore
  now?: () => number
}): Authenticate {
  const now = deps.now ?? Date.now
  const cache = new Map<string, { identity: Identity; until: number }>()

  function evictExpired(at: number) {
    for (const [key, entry] of cache) {
      if (entry.until > at) break
      cache.delete(key)
    }
  }

  // Spares the provider a refused token sent again; bounded, since anyone can
  // send new ones.
  const refused = new Map<string, number>()
  function refuse(key: string, at: number) {
    const [oldest] = refused.keys()
    if (oldest !== undefined && refused.size >= MAX_REFUSED) {
      refused.delete(oldest)
    }
    refused.set(key, at + CACHE_TTL_MS)
  }

  return async accessToken => {
    const key = sha256(accessToken)
    const at = now()
    const refusedUntil = refused.get(key)
    if (refusedUntil !== undefined) {
      if (refusedUntil > at) return null
      refused.delete(key)
    }
    let entry = cache.get(key)
    if (!entry || entry.until <= at) {
      cache.delete(key)
      const identity = await deps.provider.identify(accessToken)
      if (!identity) {
        refuse(key, at)
        return null
      }
      evictExpired(at)
      entry = {
        identity,
        until: Math.min(identity.expiresAt.getTime(), at + CACHE_TTL_MS)
      }
      cache.set(key, entry)
    }
    if (await deps.store.isRevoked(entry.identity.sessionId)) return null
    return entry.identity
  }
}
