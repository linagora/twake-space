import { and, eq, gt, isNull, or, sql } from 'drizzle-orm'
import type { Db } from '../../infra/db.ts'
import type { Directory } from '../../infra/ldap-rest.ts'
import { sha256 } from '../auth/authenticator.ts'
import type { spaceRole } from '../spaces/schema.ts'
import { apiTokens, apiTokenSpaces, type tokenScope } from './schema.ts'

export const API_TOKEN_PREFIX = 'tws_'

const TECHNICAL_ACCOUNT_TTL_MS = 5 * 60_000

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
  directory: Pick<Directory, 'isTechnicalAccount'>,
  now: () => number = Date.now
) {
  const checked = new Map<string, { exists: boolean; until: number }>()
  async function technicalAccountExists(
    organizationId: string,
    accountId: string
  ) {
    const key = `${organizationId}|${accountId}`
    const cached = checked.get(key)
    if (cached && cached.until > now()) return cached.exists
    const exists = await directory.isTechnicalAccount(organizationId, accountId)
    checked.set(key, { exists, until: now() + TECHNICAL_ACCOUNT_TTL_MS })
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
      caller.technical &&
      caller.userId &&
      !(await technicalAccountExists(caller.organizationId, caller.userId))
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
