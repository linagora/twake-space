import { and, eq, gt, isNull, lt, or, sql } from 'drizzle-orm'
import type { Db } from '../../infra/db.ts'
import { sha256 } from '../auth/authenticator.ts'
import type { StillInOrganization } from '../auth/membership.ts'
import type { spaceRole } from '../spaces/schema.ts'
import { apiTokens, apiTokenSpaces, type tokenScope } from './schema.ts'

export const API_TOKEN_PREFIX = 'tws_'

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
  stillInOrganization: StillInOrganization
) {
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
