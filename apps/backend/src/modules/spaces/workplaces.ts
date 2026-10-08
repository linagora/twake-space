import type { Directory } from '../../infra/ldap-rest.ts'

export type Workplaces = (
  orgId: string,
  accountIds: string[]
) => Promise<Map<string, string | null>>

// An instance address barely changes, but an account gets one some time after
// it joins: the cache keeps it a while, not for good.
const TTL_MS = 10 * 60 * 1000

/**
 * Each account's Twake Workplace address, or null while it has none. A failing
 * directory gives null: an avatar is not worth failing a page for.
 */
export function cachedWorkplaces(
  directory: Pick<Directory, 'workplaceFqdn'>,
  now: () => number = Date.now
): Workplaces {
  const cache = new Map<string, { at: number; fqdn: Promise<string | null> }>()
  const lookup = (orgId: string, accountId: string) => {
    const key = `${orgId}:${accountId}`
    const hit = cache.get(key)
    if (hit && now() - hit.at < TTL_MS) return hit.fqdn
    const fqdn = directory.workplaceFqdn(orgId, accountId).catch(() => {
      cache.delete(key)
      return null
    })
    cache.set(key, { at: now(), fqdn })
    return fqdn
  }
  return async (orgId, accountIds) => {
    const unique = [...new Set(accountIds)]
    const fqdns = await Promise.all(unique.map(id => lookup(orgId, id)))
    return new Map(unique.map((id, i) => [id, fqdns[i] ?? null]))
  }
}
