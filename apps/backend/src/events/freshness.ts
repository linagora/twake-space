import { sql } from 'drizzle-orm'
import type { Tx } from '../infra/db.ts'
import { lastChanges } from './schema.ts'

// An email can be given to a new user later, so its marker only holds back older events.
export const deletedUserKey = (uuid: string) => `user:${uuid}:deleted`
export const deletedEmailKey = (email: string) => `email:${email}:deleted`

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
