/**
 * Secure settings encryption/decryption
 * Uses AES-256-GCM (native crypto)
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12 // 96 bits for GCM
const TAG_LENGTH = 16 // 128 bits
const KEY_LENGTH = 32 // 256 bits

function getEncryptionKey(): Buffer {
  const keyEnv = process.env.SETTINGS_ENC_KEY
  if (!keyEnv) {
    throw new Error('SETTINGS_ENC_KEY not configured')
  }

  // Support both hex and base64
  let key: Buffer
  if (keyEnv.length === 64) {
    // Hex (32 bytes = 64 hex chars)
    key = Buffer.from(keyEnv, 'hex')
  } else {
    // Base64
    key = Buffer.from(keyEnv, 'base64')
  }

  if (key.length !== KEY_LENGTH) {
    throw new Error(`SETTINGS_ENC_KEY must be ${KEY_LENGTH} bytes (got ${key.length})`)
  }

  return key
}

/**
 * Encrypt a value
 */
export function encrypt(value: string): string {
  if (!value) return ''

  try {
    const key = getEncryptionKey()
    const iv = randomBytes(IV_LENGTH)
    const cipher = createCipheriv(ALGORITHM, key, iv)

    let encrypted = cipher.update(value, 'utf8', 'hex')
    encrypted += cipher.final('hex')

    const tag = cipher.getAuthTag()

    // Format: iv:tag:encrypted (all hex)
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`
  } catch (error) {
    if (error instanceof Error && error.message.includes('SETTINGS_ENC_KEY')) {
      throw error
    }
    throw new Error(`Encryption failed: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * Decrypt a value
 */
export function decrypt(encryptedValue: string): string {
  if (!encryptedValue) return ''

  try {
    const key = getEncryptionKey()
    const parts = encryptedValue.split(':')
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted format')
    }

    const [ivHex, tagHex, encrypted] = parts
    const iv = Buffer.from(ivHex, 'hex')
    const tag = Buffer.from(tagHex, 'hex')

    const decipher = createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(tag)

    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')

    return decrypted
  } catch (error) {
    throw new Error(`Decryption failed: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * Check if encryption key is configured
 */
export function isEncryptionConfigured(): boolean {
  return !!process.env.SETTINGS_ENC_KEY
}







