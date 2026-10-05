import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest'
import { createTestDb, type TestDb } from '../infra/testing.ts'
import { fresh } from './freshness.ts'
import { lastChanges } from './schema.ts'

let testDb: TestDb
beforeAll(async () => {
  testDb = await createTestDb()
})
afterAll(() => testDb.drop())
beforeEach(() => testDb.db.delete(lastChanges))

const at = (time: string) => new Date(`2026-10-05T${time}Z`)
const check = (time: string | undefined, objects: string[]) =>
  testDb.db.transaction(tx =>
    fresh(tx, time === undefined ? undefined : at(time), objects)
  )

it('accepts a change to an object seen for the first time', async () => {
  expect(await check('09:00:00', ['a'])).toEqual(new Set(['a']))
})

it('accepts a newer change and refuses an older one', async () => {
  await check('09:00:00', ['a', 'b'])

  expect(await check('10:00:00', ['a'])).toEqual(new Set(['a']))
  expect(await check('09:30:00', ['a', 'b'])).toEqual(new Set(['b']))
})

it('accepts a change made at the same time', async () => {
  await check('09:00:00', ['a'])

  expect(await check('09:00:00', ['a'])).toEqual(new Set(['a']))
})

it('accepts a change without a time and records nothing', async () => {
  expect(await check(undefined, ['a', 'a'])).toEqual(new Set(['a']))
  expect(await check('08:00:00', ['a'])).toEqual(new Set(['a']))
})

it('accepts an object listed twice', async () => {
  expect(await check('09:00:00', ['a', 'a'])).toEqual(new Set(['a']))
})
