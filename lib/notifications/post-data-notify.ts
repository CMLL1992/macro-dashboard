/**
 * Notificación post-dato: se dispara al crear registro en economic_releases
 * (actual_value != null, importance high|medium). Envía a usuarios con autoAlerts activo.
 */

import { getUnifiedDB, isUsingTurso } from '@/lib/db/unified-db'
import { buildTelegramPostDataMessage } from './telegram-builders'
import { sendTelegramMessage } from './telegram'
import { validateTelegramConfig } from './validation'
import { logger } from '@/lib/obs/logger'

type TelegramPreferences = {
  dailySummary: boolean
  dailySummaryTime: string
  weeklySummary: boolean
  weeklySummaryDay: string
  weeklySummaryTime: string
  autoAlerts: boolean
}

export type PostDataParams = {
  indicator: string
  country: string
  actual: number
  forecast: number | null
  previous: number | null
}

/**
 * Envía mensaje post-dato a todos los usuarios con autoAlerts = true.
 * No lanza si la config de Telegram no es válida.
 */
export async function sendPostDataNotification(params: PostDataParams): Promise<{ sent: number; errors: number }> {
  const validation = await validateTelegramConfig()
  if (!validation.bot_ok || !validation.chat_ok) {
    logger.warn('post-data-notify.skip', { reason: 'invalid_telegram_config' })
    return { sent: 0, errors: 0 }
  }

  const db = getUnifiedDB()
  const usingTurso = isUsingTurso()

  let rows: Array<{ chat_id: string; preferences_json: string }>
  try {
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
  } catch (err) {
    logger.warn('post-data-notify.read_preferences_failed', { error: err })
    return { sent: 0, errors: 0 }
  }

  const usersWithAlerts = rows
    .map((row) => ({ chatId: row.chat_id, preferences: JSON.parse(row.preferences_json) as TelegramPreferences }))
    .filter((u) => u.preferences.autoAlerts === true)

  let sentCount = 0
  let errorCount = 0

  for (const user of usersWithAlerts) {
    try {
      const message = await buildTelegramPostDataMessage({
        ...params,
        chatId: user.chatId,
      })
      const result = await sendTelegramMessage(message, { noParseMode: true })
      if (result.success) sentCount++
      else errorCount++
    } catch (err) {
      errorCount++
      logger.warn('post-data-notify.send_failed', { chatId: user.chatId, error: err })
    }
  }

  if (sentCount > 0 || errorCount > 0) {
    logger.info('post-data-notify.done', { indicator: params.indicator, country: params.country, sent: sentCount, errors: errorCount })
  }

  return { sent: sentCount, errors: errorCount }
}
