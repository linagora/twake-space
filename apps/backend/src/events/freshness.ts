import { sql } from 'drizzle-orm'
import type { Tx } from '../infra/db.ts'
import { lastChanges } from './schema.ts'

// An event without a time cannot be ordered, so it changes every object.
export async function fresh(
  tx: Tx,
  at: Date | undefined,
  objects: string[]
): Promise<Set<string>> {
  const unique = [...new Set(objects)]
  if (at === undefined || unique.length === 0) return new Set(unique)
  const accepted = await tx
    .insert(lastChanges)
    .values(unique.map(object => ({ object, at })))
    .onConflictDoUpdate({
      target: lastChanges.object,
      set: { at: sql`excluded.at` },
      setWhere: sql`${lastChanges.at} <= excluded.at`
    })
    .returning({ object: lastChanges.object })
  return new Set(accepted.map(row => row.object))
}
