import { randomUUID } from 'node:crypto'
import postgres from 'postgres'
import { createDb, migrateDb, type Db } from './db.ts'

const SERVER_URL =
  process.env.TEST_DATABASE_URL ??
  'postgres://twake_space:twake_space@localhost:5432/twake_space'

export interface TestDb {
  db: Db
  drop(): Promise<void>
}

// One migrated database per test file, so files run in parallel.
export async function createTestDb(): Promise<TestDb> {
  const name = `test_${randomUUID().replaceAll('-', '')}`
  const server = postgres(SERVER_URL, { max: 1, onnotice: () => undefined })
  await server.unsafe(`create database ${name}`)
  const url = new URL(SERVER_URL)
  url.pathname = `/${name}`
  const { sql, db } = createDb(url.toString())
  await migrateDb(db)
  return {
    db,
    async drop() {
      await sql.end()
      await server.unsafe(`drop database ${name}`)
      await server.end()
    }
  }
}
