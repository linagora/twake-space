import { eq, sql } from 'drizzle-orm'
import type { Db } from '../../infra/db.ts'
import { encrypt, hashSecret } from '../../infra/secrets.ts'
import { homeservers, organizations } from './schema.ts'

export interface HomeserverConfig {
  url: string
  serverName: string
  asToken: string
  hsToken: string
}

// Updates the one homeserver in place, whatever changed, and points every
// organization to it, so organizations met before the setting post too.
export function configureHomeserver(
  db: Db,
  key: Buffer,
  homeserver: HomeserverConfig
): Promise<string> {
  const values = {
    url: homeserver.url,
    serverName: homeserver.serverName,
    asToken: encrypt(key, homeserver.asToken),
    hsToken: encrypt(key, homeserver.hsToken),
    hsTokenHash: hashSecret(homeserver.hsToken),
    updatedAt: sql`now()`
  }
  return db.transaction(async tx => {
    // Replicas start together.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('homeserver'))`)
    const [existing] = await tx
      .select({ id: homeservers.id })
      .from(homeservers)
      .limit(1)
    const [row] = existing
      ? await tx
          .update(homeservers)
          .set(values)
          .where(eq(homeservers.id, existing.id))
          .returning({ id: homeservers.id })
      : await tx
          .insert(homeservers)
          .values(values)
          .returning({ id: homeservers.id })
    if (!row) throw new Error('homeserver write returned no row')
    await tx.update(organizations).set({ homeserverId: row.id })
    return row.id
  })
}
