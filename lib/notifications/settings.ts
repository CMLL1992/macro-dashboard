/**
 * Notification settings management
 * Adjustable parameters with validation and persistence
 */

import { getDB } from '@/lib/db/schema'

export interface NotificationSetting {
  key: string
  value: string
  min_value?: number
  max_value?: number
  description?: string
}

const DEFAULT_SETTINGS: Record<string, { default: string; min?: number; max?: number; description: string }> = {
  DELTA_INFL_PP: {
    default: '0.2',
    min: 0.1,
    max: 0.3,
    description: 'Umbral de sorpresa para inflación (en puntos porcentuales)',
  },
  NARRATIVE_COOLDOWN_MINUTES: {
    default: '60',
    min: 30,
    max: 120,
    description: 'Cooldown entre cambios de narrativa (en minutos)',
  },
  GLOBAL_RATE_LIMIT_PER_MIN: {
    default: '10',
    min: 5,
    max: 30,
    description: 'Límite global de mensajes por minuto',
  },
  NEWS_DEDUP_WINDOW_HOURS: {
    default: '2',
    min: 1,
    max: 4,
    description: 'Ventana de deduplicación de noticias (en horas)',
  },
}

/**
 * Get notification setting value (from DB or env or default)
 */
export function getNotificationSetting(key: string): string {
  const db = getDB()
  
  // Try DB first
  try {
    const row = db.prepare('SELECT value FROM notification_settings WHERE key = ?').get(key) as { value: string } | undefined
    if (row) {
      return row.value
    }
  } catch (err) {
    console.warn(`[notifications/settings] Could not read setting ${key} from DB:`, err)
  }

  // Try env
  const envValue = process.env[key]
  if (envValue) {
    return envValue
  }

  // Return default
  const defaultSetting = DEFAULT_SETTINGS[key]
  return defaultSetting?.default || ''
}

/**
 * Get notification setting as number
 */
export function getNotificationSettingNumber(key: string): number {
  const value = getNotificationSetting(key)
  const num = parseFloat(value)
  return isNaN(num) ? parseFloat(DEFAULT_SETTINGS[key]?.default || '0') : num
}

/**
 * Set notification setting
 */
export function setNotificationSetting(
  key: string,
  value: string,
  min_value?: number,
  max_value?: number,
  description?: string
): void {
  const db = getDB()
  const defaultSetting = DEFAULT_SETTINGS[key]
  
  // Validate range if provided
  const min = min_value ?? defaultSetting?.min
  const max = max_value ?? defaultSetting?.max
  const numValue = parseFloat(value)
  if (!isNaN(numValue)) {
    if (min != null && numValue < min) {
      throw new Error(`Value ${value} is below minimum ${min}`)
    }
    if (max != null && numValue > max) {
      throw new Error(`Value ${value} is above maximum ${max}`)
    }
  }

  db.prepare(`
    INSERT INTO notification_settings (key, value, min_value, max_value, description, updated_at)
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      min_value = excluded.min_value,
      max_value = excluded.max_value,
      description = excluded.description,
      updated_at = CURRENT_TIMESTAMP
  `).run(key, value, min ?? null, max ?? null, description ?? defaultSetting?.description ?? null)
}

/**
 * Get all notification settings
 */
export function getAllNotificationSettings(): NotificationSetting[] {
  const db = getDB()
  
  try {
    const rows = db.prepare(`
      SELECT key, value, min_value, max_value, description
      FROM notification_settings
      ORDER BY key
    `).all() as Array<{
      key: string
      value: string
      min_value: number | null
      max_value: number | null
      description: string | null
    }>

    return rows.map(row => ({
      key: row.key,
      value: row.value,
      min_value: row.min_value ?? undefined,
      max_value: row.max_value ?? undefined,
      description: row.description ?? undefined,
    }))
  } catch (err) {
    console.warn('[notifications/settings] Could not read settings from DB:', err)
    return []
  }
}

/**
 * Get default settings (for admin UI)
 */
export function getDefaultSettings(): Record<string, { default: string; min?: number; max?: number; description: string }> {
  return DEFAULT_SETTINGS
}


