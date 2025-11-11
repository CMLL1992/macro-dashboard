/**
 * Secure settings store (encrypted DB)
 */

import { getDB } from '@/lib/db/schema'
import { encrypt, decrypt, isEncryptionConfigured } from './secure'

export function getSetting(key: string): string | null {
  if (!isEncryptionConfigured()) return null

  const db = getDB()
  const row = db.prepare('SELECT value_encrypted FROM settings WHERE key = ?').get(key) as any

  if (!row) return null

  try {
    return decrypt(row.value_encrypted)
  } catch (error) {
    console.error(`Failed to decrypt setting ${key}:`, error)
    return null
  }
}

export function setSetting(key: string, value: string): void {
  if (!isEncryptionConfigured()) {
    throw new Error('SETTINGS_ENC_KEY not configured')
  }

  const db = getDB()
  const encrypted = encrypt(value)

  db.prepare(`
    INSERT INTO settings (key, value_encrypted, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET
      value_encrypted = excluded.value_encrypted,
      updated_at = CURRENT_TIMESTAMP
  `).run(key, encrypted)
}

export function deleteSetting(key: string): void {
  const db = getDB()
  db.prepare('DELETE FROM settings WHERE key = ?').run(key)
}




