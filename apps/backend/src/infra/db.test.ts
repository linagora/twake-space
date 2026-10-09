import { randomBytes } from 'node:crypto'
import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDb, migrateDb, postgresRefusal } from './db.ts'
import { createTestDb, type TestDb } from './testing.ts'

let testDb: TestDb
beforeAll(async () => {
  testDb = await createTestDb({ migrated: false })
})
afterAll(() => testDb.drop())

describe('migrateDb', () => {
  it('lets replicas starting together apply each migration once', async () => {
    const replicas = [1, 2, 3].map(() => createDb(testDb.url))
    try {
      await Promise.all(replicas.map(({ sql }) => migrateDb(sql)))

      const applied = await testDb.sql<{ n: number }[]>`
        select count(*)::int as n from drizzle.__drizzle_migrations`
      const folders = readdirSync(
        fileURLToPath(new URL('../../drizzle', import.meta.url)),
        { withFileTypes: true }
      ).filter(entry => entry.isDirectory())
      expect(applied[0]?.n).toBe(folders.length)
    } finally {
      await Promise.all(replicas.map(({ sql }) => sql.end()))
    }
  })
})

describe('postgresRefusal', () => {
  it('refuses a key too long for its index, as it fails on every retry', async () => {
    await testDb.sql`create table keys (key text primary key)`
    const key = randomBytes(8000).toString('base64')

    const error: unknown = await testDb.sql`insert into keys values (${key})`
      .then(() => null)
      .catch((e: unknown) => e)

    expect(postgresRefusal(error)).toMatch(/^54000/)
  })
})
