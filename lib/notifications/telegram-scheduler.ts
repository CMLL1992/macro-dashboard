/**
 * Telegram scheduler integrated with user preferences
 * Reads user_notification_preferences and schedules daily/weekly summaries
 */

import { getUnifiedDB, isUsingTurso } from '@/lib/db/unified-db'
import { buildTelegramDailySummary, buildTelegramWeeklySummary } from './telegram-builders'
import { sendTelegramMessage } from './telegram'
import { validateTelegramConfig } from './validation'
import { format, getDay, setHours, setMinutes, addDays, startOfWeek, endOfWeek } from 'date-fns'
import { toZonedTime, fromZonedTime } from 'date-fns-tz'
import { env } from '@/lib/env'
import { logger } from '@/lib/obs/logger'

const TIMEZONE = env.TIMEZONE

type TelegramPreferences = {
  dailySummary: boolean
  dailySummaryTime: string
  weeklySummary: boolean
  weeklySummaryDay: string
  weeklySummaryTime: string
  autoAlerts: boolean
}

/**
 * Get all users with Telegram preferences
 */
async function getTelegramUsers(): Promise<Array<{ chatId: string; preferences: TelegramPreferences }>> {
  const db = getUnifiedDB()
  const usingTurso = isUsingTurso()

  try {
    let rows: Array<{ chat_id: string; preferences_json: string }>
    if (usingTurso) {
      rows = (await db.prepare('SELECT chat_id, preferences_json FROM user_notification_preferences').all()) as Array<{
        chat_id: string
        preferences_json: string
      }>
    } else {
      rows = db.prepare('SELECT chat_id, preferences_json FROM user_notification_preferences').all() as Array<{
        chat_id: string
        preferences_json: string
      }>
    }

    return rows.map((row) => ({
      chatId: row.chat_id,
      preferences: JSON.parse(row.preferences_json) as TelegramPreferences,
    }))
  } catch (err) {
    logger.warn('[telegram-scheduler] Could not read user preferences', { error: err })
    return []
  }
}

/**
 * Check if daily summary was already sent today for user
 */
async function wasDailySummarySentToday(chatId: string): Promise<boolean> {
  const db = getUnifiedDB()
  const usingTurso = isUsingTurso()
  const now = new Date()
  const madridNow = toZonedTime(now, TIMEZONE)
  const today = format(madridNow, 'yyyy-MM-dd')

  try {
    let row: { id: number } | undefined
    if (usingTurso) {
      row = (await db
        .prepare(
          "SELECT id FROM notification_history WHERE chat_id = ? AND tipo = 'daily' AND DATE(created_at) = ? LIMIT 1"
        )
        .get(chatId, today)) as { id: number } | undefined
    } else {
      row = db
        .prepare("SELECT id FROM notification_history WHERE chat_id = ? AND tipo = 'daily' AND DATE(created_at) = ? LIMIT 1")
        .get(chatId, today) as { id: number } | undefined
    }

    return !!row
  } catch (err) {
    logger.warn('[telegram-scheduler] Could not check daily summary history', { chatId, error: err })
    return false
  }
}

/**
 * Send daily summary to user
 */
export async function sendDailySummaryToUser(chatId: string): Promise<{ success: boolean; error?: string }> {
  // Validate config first
  const validation = await validateTelegramConfig()
  if (!validation.valid || !validation.bot_ok || !validation.chat_ok) {
    return { success: false, error: 'Invalid Telegram configuration' }
  }

  // Check idempotency
  if (await wasDailySummarySentToday(chatId)) {
    logger.debug('[telegram-scheduler] Daily summary already sent today', { chatId })
    return { success: false, error: 'Already sent today' }
  }

  try {
    const message = await buildTelegramDailySummary(chatId)
    const result = await sendTelegramMessage(message, { noParseMode: true })

    if (result.success) {
      // Log to notification_history
      const db = getUnifiedDB()
      const usingTurso = isUsingTurso()
      const now = new Date().toISOString()
      try {
        if (usingTurso) {
          await db
            .prepare(
              `
            INSERT INTO notification_history (tipo, mensaje, chat_id, status, sent_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
          `
            )
            .run('daily', message.substring(0, 500), chatId, 'sent', now, now)
        } else {
          db.prepare(
            `
            INSERT INTO notification_history (tipo, mensaje, chat_id, status, sent_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
          `
          ).run('daily', message.substring(0, 500), chatId, 'sent', now, now)
        }
      } catch (err) {
        logger.warn('[telegram-scheduler] Could not log daily summary', { chatId, error: err })
      }

      logger.info('[telegram-scheduler] Daily summary sent', { chatId })
      return { success: true }
    } else {
      logger.error('[telegram-scheduler] Failed to send daily summary', { chatId, error: result.error })
      return { success: false, error: result.error }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error('[telegram-scheduler] Error building/sending daily summary', { chatId, error: errorMessage })
    return { success: false, error: errorMessage }
  }
}

/**
 * Send weekly summary to user
 */
export async function sendWeeklySummaryToUser(chatId: string): Promise<{ success: boolean; error?: string }> {
  // Validate config first
  const validation = await validateTelegramConfig()
  if (!validation.valid || !validation.bot_ok || !validation.chat_ok) {
    return { success: false, error: 'Invalid Telegram configuration' }
  }

  try {
    const now = new Date()
    const madridNow = toZonedTime(now, TIMEZONE)
    const weekStart = startOfWeek(madridNow, { weekStartsOn: 1 })
    const weekEnd = endOfWeek(madridNow, { weekStartsOn: 1 })

    const message = await buildTelegramWeeklySummary(chatId, {
      start: weekStart,
      end: weekEnd,
    })
    const result = await sendTelegramMessage(message, { noParseMode: true })

    if (result.success) {
      // Log to notification_history
      const db = getUnifiedDB()
      const usingTurso = isUsingTurso()
      const now = new Date().toISOString()
      try {
        if (usingTurso) {
          await db
            .prepare(
              `
            INSERT INTO notification_history (tipo, mensaje, chat_id, status, sent_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
          `
            )
            .run('weekly', message.substring(0, 500), chatId, 'sent', now, now)
        } else {
          db.prepare(
            `
            INSERT INTO notification_history (tipo, mensaje, chat_id, status, sent_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
          `
          ).run('weekly', message.substring(0, 500), chatId, 'sent', now, now)
        }
      } catch (err) {
        logger.warn('[telegram-scheduler] Could not log weekly summary', { chatId, error: err })
      }

      logger.info('[telegram-scheduler] Weekly summary sent', { chatId })
      return { success: true }
    } else {
      logger.error('[telegram-scheduler] Failed to send weekly summary', { chatId, error: result.error })
      return { success: false, error: result.error }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error('[telegram-scheduler] Error building/sending weekly summary', { chatId, error: errorMessage })
    return { success: false, error: errorMessage }
  }
}

/**
 * Process daily summaries for all users
 */
export async function processDailySummaries(): Promise<void> {
  const users = await getTelegramUsers()
  const now = new Date()
  const madridNow = toZonedTime(now, TIMEZONE)
  const currentHour = madridNow.getHours()
  const currentMinute = madridNow.getMinutes()

  for (const user of users) {
    if (!user.preferences.dailySummary) continue

    // Parse user's preferred time
    const [hour, minute] = user.preferences.dailySummaryTime.split(':').map(Number)
    if (hour === currentHour && Math.abs(minute - currentMinute) <= 5) {
      // Within 5 minute window
      await sendDailySummaryToUser(user.chatId)
    }
  }
}

/**
 * Process weekly summaries for all users
 */
export async function processWeeklySummaries(): Promise<void> {
  const users = await getTelegramUsers()
  const now = new Date()
  const madridNow = toZonedTime(now, TIMEZONE)
  const currentDay = getDay(madridNow) // 0 = Sunday, 1 = Monday, etc.
  const currentHour = madridNow.getHours()
  const currentMinute = madridNow.getMinutes()

  // Map day names to day numbers
  const dayMap: Record<string, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  }

  for (const user of users) {
    if (!user.preferences.weeklySummary) continue

    const preferredDay = dayMap[user.preferences.weeklySummaryDay.toLowerCase()] ?? 1 // Default Monday
    const [hour, minute] = user.preferences.weeklySummaryTime.split(':').map(Number)

    if (currentDay === preferredDay && hour === currentHour && Math.abs(minute - currentMinute) <= 5) {
      // Within 5 minute window
      await sendWeeklySummaryToUser(user.chatId)
    }
  }
}
