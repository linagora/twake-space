import type { Directory } from '../../infra/ldap-rest.ts'

const ACCOUNT_CHECK_TTL_MS = 5 * 60_000

export type StillInOrganization = (
  organizationId: string,
  accountId: string,
  technical: boolean
) => Promise<boolean>

// No event covers every way out of an organization (a technical account sends
// none at all), so sessions and account tokens re-check their account.
export function organizationMembership(
  directory: Pick<Directory, 'isTechnicalAccount' | 'isMember'>,
  now: () => number = Date.now
): StillInOrganization {
  // Promises, so concurrent requests of one account share one ldap-rest call.
  const checked = new Map<string, { exists: Promise<boolean>; until: number }>()
  let nextSweep = 0
  return (organizationId, accountId, technical) => {
    const at = now()
    if (at >= nextSweep) {
      nextSweep = at + ACCOUNT_CHECK_TTL_MS
      for (const [key, entry] of checked) {
        if (entry.until <= at) checked.delete(key)
      }
    }
    // A session and a technical token of one account ask different questions.
    const key = `${organizationId}|${accountId}|${technical ? 'technical' : 'member'}`
    const cached = checked.get(key)
    if (cached && cached.until > at) return cached.exists
    const exists = technical
      ? directory.isTechnicalAccount(organizationId, accountId)
      : directory.isMember(organizationId, accountId)
    const entry = { exists, until: at + ACCOUNT_CHECK_TTL_MS }
    checked.set(key, entry)
    exists.catch(() => {
      if (checked.get(key) === entry) checked.delete(key)
    })
    return exists
  }
}
