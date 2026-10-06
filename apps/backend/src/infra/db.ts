import { fileURLToPath } from 'node:url'
import { timestamp } from 'drizzle-orm/pg-core'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

export const timestamptz = (name: string) =>
  timestamp(name, { withTimezone: true })

export function createDb(url: string) {
  const sql = postgres(url, { onnotice: () => undefined })
  return { sql, db: drizzle({ client: sql }) }
}

export type Db = ReturnType<typeof createDb>['db']
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]

// Postgres data exceptions (22) and integrity violations (23) fail the same way on
// every retry.
export function postgresRefusal(error: unknown): string | null {
  for (let e = error; e instanceof Error; e = e.cause) {
    if ('code' in e && typeof e.code === 'string' && /^2[23]/.test(e.code)) {
      return `${e.code}: ${e.message}`
    }
  }
  return null
}

// The drizzle migrator takes no lock: replicas starting together would apply
// the same migration. A reserved connection holds the session lock while the
// pool migrates, since drizzle cannot run on a reserved connection.
export async function migrateDb(sql: postgres.Sql): Promise<void> {
  const connection = await sql.reserve()
  try {
    await connection`select pg_advisory_lock(hashtext('migrations'))`
    try {
      await migrate(drizzle({ client: sql }), {
        migrationsFolder: fileURLToPath(
          new URL('../../drizzle', import.meta.url)
        )
      })
    } finally {
      await connection`select pg_advisory_unlock(hashtext('migrations'))`
    }
  } finally {
    connection.release()
  }
}
