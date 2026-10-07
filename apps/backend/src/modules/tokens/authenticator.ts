import { and, eq, gt, isNull, lt, or, sql } from 'drizzle-orm'
import type { Db } from '../../infra/db.ts'
import type { Directory } from '../../infra/ldap-rest.ts'
import { sha256 } from '../auth/authenticator.ts'
import type { spaceRole } from '../spaces/schema.ts'
import { apiTokens, apiTokenSpaces, type tokenScope } from './schema.ts'

export const API_TOKEN_PREFIX = 'tws_'

const ACCOUNT_CHECK_TTL_MS = 5 * 60_000

export type Scope = (typeof tokenScope.enumValues)[number]

export interface TokenCaller {
  kind: 'token'
  tokenId: string
  name: string
  organizationId: string
  // The account the token acts for, or null for an organization token.
  userId: string | null
  technical: boolean
  role: (typeof spaceRole.enumValues)[number] | null
  scopes: Scope[]
  // Null when the token covers every space.
  spaceIds: string[] | null
  expiresAt: Date | null
}

export function apiTokenAuthenticator(
  db: Db,
  directory: Pick<Directory, 'isTechnicalAccount' | 'isMember'>,
  now: () => number = Date.now
) {
  // Promises, so concurrent requests of one account share one ldap-rest call.
  const checked = new Map<string, { exists: Promise<boolean>; until: number }>()
  // No event covers every way out of an organization (a technical account
  // sends none at all), so an account token re-checks its account.
  function stillInOrganization(
    organizationId: string,
    accountId: string,
    technical: boolean
  ) {
    const key = `${organizationId}|${accountId}`
    const cached = checked.get(key)
    if (cached && cached.until > now()) return cached.exists
    const exists = technical
      ? directory.isTechnicalAccount(organizationId, accountId)
      : directory.isMember(organizationId, accountId)
    const entry = { exists, until: now() + ACCOUNT_CHECK_TTL_MS }
    checked.set(key, entry)
    exists.catch(() => {
      if (checked.get(key) === entry) checked.delete(key)
    })
    return exists
  }

  return async (token: string): Promise<TokenCaller | null> => {
    const [row] = await db
      .select({
        tokenId: apiTokens.id,
        name: apiTokens.name,
        organizationId: apiTokens.organizationId,
        userId: apiTokens.accountId,
        technical: apiTokens.technical,
        role: apiTokens.role,
        scopes: apiTokens.scopes,
        allSpaces: apiTokens.allSpaces,
        expiresAt: apiTokens.expiresAt
      })
      .from(apiTokens)
      .where(
        and(
          eq(apiTokens.tokenHash, sha256(token)),
          isNull(apiTokens.revokedAt),
          or(isNull(apiTokens.expiresAt), gt(apiTokens.expiresAt, sql`now()`))
        )
      )
    if (!row) return null
    const { allSpaces, ...caller } = row
    if (
      caller.userId &&
      !(await stillInOrganization(
        caller.organizationId,
        caller.userId,
        caller.technical
      ))
    ) {
      return null
    }
    // A busy token would otherwise rewrite its row on every request.
    await db
      .update(apiTokens)
      .set({ lastUsedAt: sql`now()` })
      .where(
        and(
          eq(apiTokens.id, row.tokenId),
          or(
            isNull(apiTokens.lastUsedAt),
            lt(apiTokens.lastUsedAt, sql`now() - interval '1 minute'`)
          )
        )
      )
    const spaceIds = allSpaces
      ? null
      : (
          await db
            .select({ spaceId: apiTokenSpaces.spaceId })
            .from(apiTokenSpaces)
            .where(eq(apiTokenSpaces.tokenId, row.tokenId))
        ).map(s => s.spaceId)
    return { kind: 'token', ...caller, spaceIds }
  }
}
