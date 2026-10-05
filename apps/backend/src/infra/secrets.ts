import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes
} from 'node:crypto'

const IV_BYTES = 12
const TAG_BYTES = 16

// AES-256-GCM, stored as iv, tag, then ciphertext.
export function encrypt(key: Buffer, plaintext: string): Buffer {
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext])
}

export function decrypt(key: Buffer, sealed: Buffer): string {
  const decipher = createDecipheriv(
    'aes-256-gcm',
    key,
    sealed.subarray(0, IV_BYTES)
  )
  decipher.setAuthTag(sealed.subarray(IV_BYTES, IV_BYTES + TAG_BYTES))
  return Buffer.concat([
    decipher.update(sealed.subarray(IV_BYTES + TAG_BYTES)),
    decipher.final()
  ]).toString()
}

export function hashSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('base64url')
}
