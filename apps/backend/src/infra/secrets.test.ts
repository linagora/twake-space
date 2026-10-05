import { randomBytes } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { decrypt, encrypt } from './secrets.ts'

const key = randomBytes(32)

describe('secrets', () => {
  it('decrypts what it encrypted', () => {
    expect(decrypt(key, encrypt(key, 'as-token'))).toBe('as-token')
  })

  it('never encrypts a value the same way twice', () => {
    expect(encrypt(key, 'as-token')).not.toEqual(encrypt(key, 'as-token'))
  })

  it('refuses a tampered ciphertext', () => {
    const sealed = encrypt(key, 'as-token')
    sealed[sealed.length - 1] = (sealed.at(-1) ?? 0) ^ 1

    expect(() => decrypt(key, sealed)).toThrow()
  })

  it('refuses another key', () => {
    expect(() => decrypt(randomBytes(32), encrypt(key, 'as-token'))).toThrow()
  })
})
