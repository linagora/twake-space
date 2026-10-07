import { and, eq, gt, isNull, or, sql } from 'drizzle-orm'
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
  directory: Pick<Directory, 'isTechnicalAccount' | 'organizationRole'>,
  now: () => number = Date.now
) {
  const checked = new Map<string, { exists: boolean; until: number }>()
  // No event covers every way out of an organization (a technical account
  // sends none at all), so an account token re-checks its account.
  async function stillInOrganization(
    organizationId: string,
    accountId: string,
    technical: boolean
  ) {
    const key = `${organizationId}|${accountId}`
    const cached = checked.get(key)
    if (cached && cached.until > now()) return cached.exists
    const exists = technical
      ? await directory.isTechnicalAccount(organizationId, accountId)
      : (await directory.organizationRole(organizationId, accountId)) !==
        undefined
    checked.set(key, { exists, until: now() + ACCOUNT_CHECK_TTL_MS })
    return exists
  }

  return async (token: string): Promise<TokenCaller | null> => {
    const [row] = await db
      .update(apiTokens)
      .set({ lastUsedAt: sql`now()` })
      .where(
        and(
          eq(apiTokens.tokenHash, sha256(token)),
          isNull(apiTokens.revokedAt),
          or(isNull(apiTokens.expiresAt), gt(apiTokens.expiresAt, sql`now()`))
        )
      )
      .returning({
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
