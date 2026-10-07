import { and, eq, inArray, isNull, lte, ne, sql, type SQL } from 'drizzle-orm'
import type { Tx } from '../../infra/db.ts'
import { apiTokens, apiTokenSpaces, tokenAudit } from './schema.ts'

interface Why {
  actor: string
  reason: string
  // Spares tokens created after the event, so a replayed event cannot revoke them.
  before?: Date | undefined
}

async function revokeOnce(tx: Tx, which: SQL | undefined, why: Why) {
  const revoked = await tx
    .update(apiTokens)
    .set({ revokedAt: sql`now()`, revokedReason: why.reason })
    .where(and(which, isNull(apiTokens.revokedAt)))
    .returning({ id: apiTokens.id })
  if (revoked.length > 0) {
    await tx.insert(tokenAudit).values(
      revoked.map(({ id }) => ({
        tokenId: id,
        action: 'revoked' as const,
        actor: why.actor,
        reason: why.reason
      }))
    )
  }
  return revoked.map(({ id }) => id)
}

// Also revokes every token they created, down the line: a leaked token must
// not live on through the tokens it made. Returns the ids `which` matched.
export async function revokeTokens(
  tx: Tx,
  which: SQL | undefined,
  why: Why
): Promise<string[]> {
  const revoked = await revokeOnce(
    tx,
    and(which, why.before && lte(apiTokens.createdAt, why.before)),
    why
  )
  const child = {
    actor: why.actor,
    reason: 'the token that created it was revoked'
  }
  for (let parents = revoked; parents.length > 0;) {
    parents = await revokeOnce(
      tx,
      inArray(apiTokens.parentTokenId, parents),
      child
    )
  }
  return revoked
}

export async function revokeAccountTokens(
  tx: Tx,
  account: { accountId: string; organizationId?: string },
  why: Why
): Promise<void> {
  await revokeTokens(
    tx,
    and(
      eq(apiTokens.accountId, account.accountId),
      account.organizationId === undefined
        ? undefined
        : eq(apiTokens.organizationId, account.organizationId)
    ),
    why
  )
}

export async function revokeOrganizationTokens(
  tx: Tx,
  organizationId: string,
  why: Why
): Promise<void> {
  await revokeTokens(tx, eq(apiTokens.organizationId, organizationId), why)
}

// A token that covered only this space is revoked; the others lose it.
export async function dropSpaceFromTokens(
  tx: Tx,
  spaceId: string,
  why: Why
): Promise<void> {
  const covering = (
    await tx
      .select({ tokenId: apiTokenSpaces.tokenId })
      .from(apiTokenSpaces)
      .where(eq(apiTokenSpaces.spaceId, spaceId))
  ).map(c => c.tokenId)
  if (covering.length === 0) return
  const elsewhere = new Set(
    (
      await tx
        .selectDistinct({ tokenId: apiTokenSpaces.tokenId })
        .from(apiTokenSpaces)
        .where(
          and(
            inArray(apiTokenSpaces.tokenId, covering),
            ne(apiTokenSpaces.spaceId, spaceId)
          )
        )
    ).map(c => c.tokenId)
  )
  const only = covering.filter(id => !elsewhere.has(id))
  if (only.length > 0) await revokeTokens(tx, inArray(apiTokens.id, only), why)
  await tx.delete(apiTokenSpaces).where(eq(apiTokenSpaces.spaceId, spaceId))
}
