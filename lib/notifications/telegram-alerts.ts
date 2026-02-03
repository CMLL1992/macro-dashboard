/**
 * Telegram alerts evaluator
 * Evaluates macro updates and triggers alerts based on user preferences
 * Only triggers: regime_change, liquidity_change, core_publication, correlation_change
 */

import { getUnifiedDB, isUsingTurso } from '@/lib/db/unified-db'
import { validateTelegramConfig } from './validation'
import { sendTelegramMessage } from './telegram'
import { buildTelegramAlert } from './telegram-builders'
import { env } from '@/lib/env'
import { logger } from '@/lib/obs/logger'
import { createHash } from 'crypto'

type MacroUpdatePayload = {
  regime?: {
    previous?: string
    current?: string
  }
  liquidity?: {
    previous?: string
    current?: string
  }
  corePublications?: Array<{
    key: string
    label: string
    value: number | null
    unit?: string
    importance: 'Alta' | 'Media' | 'Baja'
  }>
  correlations?: Array<{
    symbol: string
    previous?: number | null
    current?: number | null
    change?: number
  }>
}

/**
 * Get user preferences for alerts
 */
async function getUserAlertPreferences(chatId: string): Promise<boolean> {
  const db = getUnifiedDB()
  const usingTurso = isUsingTurso()

  try {
    let row: { preferences_json: string } | undefined
    if (usingTurso) {
      row = (await db.prepare('SELECT preferences_json FROM user_notification_preferences WHERE chat_id = ?').get(chatId)) as
        | { preferences_json: string }
        | undefined
    } else {
      row = db.prepare('SELECT preferences_json FROM user_notification_preferences WHERE chat_id = ?').get(chatId) as
        | { preferences_json: string }
        | undefined
    }

    if (row) {
      const prefs = JSON.parse(row.preferences_json)
      return prefs.autoAlerts === true
    }
  } catch (err) {
    logger.warn('[telegram-alerts] Could not read user preferences', { chatId, error: err })
  }

  return true // Default: enabled
}

/**
 * Check if alert was already sent (deduplication)
 */
async function wasAlertSent(chatId: string, alertHash: string): Promise<boolean> {
  const db = getUnifiedDB()
  const usingTurso = isUsingTurso()

  try {
    let row: { id: number } | undefined
    if (usingTurso) {
      row = (await db.prepare(
        'SELECT id FROM notification_history WHERE chat_id = ? AND mensaje LIKE ? ORDER BY created_at DESC LIMIT 1'
      ).get(chatId, `%${alertHash}%`)) as { id: number } | undefined
    } else {
      row = db
        .prepare('SELECT id FROM notification_history WHERE chat_id = ? AND mensaje LIKE ? ORDER BY created_at DESC LIMIT 1')
        .get(chatId, `%${alertHash}%`) as { id: number } | undefined
    }

    return !!row
  } catch (err) {
    logger.warn('[telegram-alerts] Could not check alert history', { chatId, error: err })
    return false
  }
}

/**
 * Log alert to notification_history
 */
async function logAlert(chatId: string, message: string, alertHash: string, success: boolean): Promise<void> {
  const db = getUnifiedDB()
  const usingTurso = isUsingTurso()

  try {
    const now = new Date().toISOString()
    if (usingTurso) {
      await db
        .prepare(
          `
        INSERT INTO notification_history (tipo, mensaje, chat_id, status, sent_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `
        )
        .run('alert', message.substring(0, 500), chatId, success ? 'sent' : 'failed', success ? now : null, now)
    } else {
      db.prepare(
        `
        INSERT INTO notification_history (tipo, mensaje, chat_id, status, sent_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `
      ).run('alert', message.substring(0, 500), chatId, success ? 'sent' : 'failed', success ? now : null, now)
    }
  } catch (err) {
    logger.warn('[telegram-alerts] Could not log alert', { chatId, error: err })
  }
}

/**
 * Evaluate and send Telegram alerts based on macro updates
 */
export async function evaluateTelegramAlerts(chatId: string, macroUpdates: MacroUpdatePayload): Promise<{
  sent: number
  skipped: number
  errors: number
}> {
  const result = { sent: 0, skipped: 0, errors: 0 }

  // Validate Telegram config first
  const validation = await validateTelegramConfig()
  if (!validation.valid || !validation.bot_ok || !validation.chat_ok) {
    logger.info('[telegram-alerts] Skipped - invalid config', { chatId, validation })
    return result
  }

  // Check user preferences
  const alertsEnabled = await getUserAlertPreferences(chatId)
  if (!alertsEnabled) {
    logger.info('[telegram-alerts] Skipped - user disabled', { chatId })
    return result
  }

  // Check for regime change
  if (macroUpdates.regime?.previous && macroUpdates.regime?.current && macroUpdates.regime.previous !== macroUpdates.regime.current) {
    const alertHash = createHash('md5')
      .update(`regime_${macroUpdates.regime.previous}_${macroUpdates.regime.current}_${chatId}`)
      .digest('hex')
      .substring(0, 8)

    if (!(await wasAlertSent(chatId, alertHash))) {
      try {
        const message = await buildTelegramAlert(
          {
            type: 'regime_change',
            data: {
              from: macroUpdates.regime.previous,
              to: macroUpdates.regime.current,
              reason: 'Cambio detectado en drivers macro principales',
              impact: 'Puede afectar apetito por riesgo y flujos de capital',
            },
          },
          chatId
        )

        const sendResult = await sendTelegramMessage(message, { noParseMode: true })
        if (sendResult.success) {
          await logAlert(chatId, message, alertHash, true)
          result.sent++
        } else {
          await logAlert(chatId, message, alertHash, false)
          result.errors++
        }
      } catch (error) {
        logger.error('[telegram-alerts] Failed to send regime alert', { chatId, error })
        result.errors++
      }
    } else {
      result.skipped++
    }
  }

  // Check for liquidity change
  if (
    macroUpdates.liquidity?.previous &&
    macroUpdates.liquidity?.current &&
    macroUpdates.liquidity.previous !== macroUpdates.liquidity.current
  ) {
    const alertHash = createHash('md5')
      .update(`liquidity_${macroUpdates.liquidity.previous}_${macroUpdates.liquidity.current}_${chatId}`)
      .digest('hex')
      .substring(0, 8)

    if (!(await wasAlertSent(chatId, alertHash))) {
      try {
        const message = await buildTelegramAlert(
          {
            type: 'liquidity_change',
            data: {
              from: macroUpdates.liquidity.previous,
              to: macroUpdates.liquidity.current,
              reason: 'Cambio en indicadores de liquidez (WALCL, RRP, TGA, M2)',
              impact: 'Puede afectar flujos de capital entre activos',
            },
          },
          chatId
        )

        const sendResult = await sendTelegramMessage(message, { noParseMode: true })
        if (sendResult.success) {
          await logAlert(chatId, message, alertHash, true)
          result.sent++
        } else {
          await logAlert(chatId, message, alertHash, false)
          result.errors++
        }
      } catch (error) {
        logger.error('[telegram-alerts] Failed to send liquidity alert', { chatId, error })
        result.errors++
      }
    } else {
      result.skipped++
    }
  }

  // Check for core publications (only Alta importance)
  if (macroUpdates.corePublications && macroUpdates.corePublications.length > 0) {
    const highImportance = macroUpdates.corePublications.filter((p) => p.importance === 'Alta')
    for (const pub of highImportance) {
      const alertHash = createHash('md5')
        .update(`core_${pub.key}_${pub.value}_${chatId}`)
        .digest('hex')
        .substring(0, 8)

      if (!(await wasAlertSent(chatId, alertHash))) {
        try {
          const message = await buildTelegramAlert(
            {
              type: 'core_publication',
              data: {
                label: pub.label,
                value: pub.value,
                unit: pub.unit,
                reason: 'Publicación relevante del set CORE',
                impact: 'Puede influir en régimen macro y drivers principales',
              },
            },
            chatId
          )

          const sendResult = await sendTelegramMessage(message, { noParseMode: true })
          if (sendResult.success) {
            await logAlert(chatId, message, alertHash, true)
            result.sent++
          } else {
            await logAlert(chatId, message, alertHash, false)
            result.errors++
          }
        } catch (error) {
          logger.error('[telegram-alerts] Failed to send core publication alert', { chatId, error })
          result.errors++
        }
      } else {
        result.skipped++
      }
    }
  }

  // Check for correlation changes (only significant changes > 0.1)
  if (macroUpdates.correlations && macroUpdates.correlations.length > 0) {
    for (const corr of macroUpdates.correlations) {
      if (corr.change && Math.abs(corr.change) > 0.1) {
        const alertHash = createHash('md5')
          .update(`corr_${corr.symbol}_${corr.change}_${chatId}`)
          .digest('hex')
          .substring(0, 8)

        if (!(await wasAlertSent(chatId, alertHash))) {
          try {
            const message = await buildTelegramAlert(
              {
                type: 'correlation_change',
                data: {
                  symbol: corr.symbol,
                  change: corr.change,
                  reason: 'Cambio significativo en correlación vs DXY',
                  impact: 'Puede indicar cambio en relación macro del activo',
                },
              },
              chatId
            )

            const sendResult = await sendTelegramMessage(message, { noParseMode: true })
            if (sendResult.success) {
              await logAlert(chatId, message, alertHash, true)
              result.sent++
            } else {
              await logAlert(chatId, message, alertHash, false)
              result.errors++
            }
          } catch (error) {
            logger.error('[telegram-alerts] Failed to send correlation alert', { chatId, error })
            result.errors++
          }
        } else {
          result.skipped++
        }
      }
    }
  }

  return result
}
