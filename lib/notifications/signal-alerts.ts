/**
 * Signal Alerts
 * 
 * Sistema de alertas basado en cambios de estado del MacroSignal.
 * Notifica solo cambios significativos (NO_TRADE, invalidación, conviction tranche).
 * Deduplicación por snapshot_hash + ventana (60 min).
 */

import 'server-only'
import type { MacroSignal } from '@/domain/macro-signals/engine'
import type { MacroSnapshot } from '@/domain/macro-snapshot/schema'
import { getUnifiedDB, isUsingTurso } from '@/lib/db/unified-db'
import { logger } from '@/lib/obs/logger'
import { createHash } from 'crypto'
import { areNotificationsEnabled } from '@/lib/env'
import { sendTelegramMessage } from './telegram'

/**
 * Generate alert hash for deduplication
 */
function generateAlertHash(signal: MacroSignal, snapshot: MacroSnapshot): string {
  const stableSignal = {
    action: signal.action,
    conviction: signal.conviction,
    score: signal.score,
    biasDirection: signal.biasDirection,
    timeToNextEvent: signal.timeToNextEvent?.status,
  }
  const json = JSON.stringify(stableSignal)
  return createHash('sha256').update(json).digest('hex').substring(0, 16)
}

/**
 * Check if alert was sent recently (within 60 minutes)
 */
async function wasAlertSentRecently(alertHash: string): Promise<boolean> {
  const requestId = 'signal-alerts'
  const sixtyMinutesAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

  try {
    const db = getUnifiedDB()

    if (isUsingTurso()) {
      const row = await db
        .prepare('SELECT id FROM signal_alert_history WHERE alert_hash = ? AND sent_at > ? LIMIT 1')
        .get(alertHash, sixtyMinutesAgo) as { id: number } | undefined

      return !!row
    } else {
      const row = db
        .prepare('SELECT id FROM signal_alert_history WHERE alert_hash = ? AND sent_at > ? LIMIT 1')
        .get(alertHash, sixtyMinutesAgo) as { id: number } | undefined

      return !!row
    }
  } catch (error) {
    logger.warn('signal.alerts.check_failed', {
      requestId,
      alertHash,
      error: error instanceof Error ? error.message : String(error),
    })
    return false // If check fails, allow alert (fail open)
  }
}

/**
 * Record alert in history
 */
async function recordAlert(alertHash: string, alertType: string, message: string): Promise<void> {
  const requestId = 'signal-alerts'

  try {
    const db = getUnifiedDB()

    if (isUsingTurso()) {
      await db.prepare(`
        INSERT INTO signal_alert_history (alert_hash, alert_type, message, sent_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      `).run(alertHash, alertType, message)
    } else {
      db.prepare(`
        INSERT INTO signal_alert_history (alert_hash, alert_type, message, sent_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      `).run(alertHash, alertType, message)
    }

    logger.debug('signal.alerts.recorded', { requestId, alertHash, alertType })
  } catch (error) {
    logger.warn('signal.alerts.record_failed', {
      requestId,
      alertHash,
      error: error instanceof Error ? error.message : String(error),
    })
    // Non-blocking: continue even if recording fails
  }
}

/**
 * Check for signal state changes that warrant alerts
 */
export async function checkSignalAlerts(
  currentSignal: MacroSignal,
  previousSignal: MacroSignal | null,
  snapshot: MacroSnapshot
): Promise<void> {
  if (!areNotificationsEnabled()) {
    return // Notifications disabled
  }

  const requestId = 'signal-alerts'

  // 1. Pasa a NO_TRADE (evento <4h o invariant error)
  if (currentSignal.action === 'NO_TRADE' && (!previousSignal || previousSignal.action !== 'NO_TRADE')) {
    const alertHash = generateAlertHash(currentSignal, snapshot)
    if (!(await wasAlertSentRecently(alertHash))) {
      const message = `🚫 NO TRADE activado\n\n${currentSignal.actionReason || 'Bloqueo por riesgo'}\n\nScore: ${currentSignal.score > 0 ? '+' : ''}${currentSignal.score.toFixed(0)}\nConvicción: ${currentSignal.conviction}`
      
      await sendTelegramMessage(message).catch((err) => {
        logger.warn('signal.alerts.send_failed', {
          requestId,
          alertHash,
          error: err instanceof Error ? err.message : String(err),
        })
      })

      await recordAlert(alertHash, 'no_trade_activated', message)
    }
  }

  // 2. Sale de NO_TRADE (T>4h y sin bloqueos)
  if (previousSignal?.action === 'NO_TRADE' && currentSignal.action !== 'NO_TRADE') {
    const alertHash = generateAlertHash(currentSignal, snapshot)
    if (!(await wasAlertSentRecently(alertHash))) {
      const message = `✅ NO TRADE desactivado\n\nAcción: ${currentSignal.action}\nScore: ${currentSignal.score > 0 ? '+' : ''}${currentSignal.score.toFixed(0)}\nConvicción: ${currentSignal.conviction}`
      
      await sendTelegramMessage(message).catch((err) => {
        logger.warn('signal.alerts.send_failed', {
          requestId,
          alertHash,
          error: err instanceof Error ? err.message : String(err),
        })
      })

      await recordAlert(alertHash, 'no_trade_deactivated', message)
    }
  }

  // 3. Invalida señal (score cruza 0, driver #1 cambia dirección, confidence cae bajo umbral)
  if (previousSignal) {
    // Score cruza 0
    if (
      (previousSignal.score > 0 && currentSignal.score < 0) ||
      (previousSignal.score < 0 && currentSignal.score > 0)
    ) {
      const alertHash = generateAlertHash(currentSignal, snapshot)
      if (!(await wasAlertSentRecently(alertHash))) {
        const message = `⚠️ Señal invalidada: Score cruza 0\n\nAnterior: ${previousSignal.score > 0 ? '+' : ''}${previousSignal.score.toFixed(0)}\nActual: ${currentSignal.score > 0 ? '+' : ''}${currentSignal.score.toFixed(0)}\n\nRe-evaluar posición`
        
        await sendTelegramMessage(message).catch((err) => {
          logger.warn('signal.alerts.send_failed', {
            requestId,
            alertHash,
            error: err instanceof Error ? err.message : String(err),
          })
        })

        await recordAlert(alertHash, 'signal_invalidated_score', message)
      }
    }

    // Confidence cae bajo umbral (< 0.5)
    if (previousSignal.confidence >= 0.5 && currentSignal.confidence < 0.5) {
      const alertHash = generateAlertHash(currentSignal, snapshot)
      if (!(await wasAlertSentRecently(alertHash))) {
        const message = `⚠️ Confianza baja detectada\n\nAnterior: ${(previousSignal.confidence * 100).toFixed(0)}%\nActual: ${(currentSignal.confidence * 100).toFixed(0)}%\n\nReducir tamaño o esperar confirmación`
        
        await sendTelegramMessage(message).catch((err) => {
          logger.warn('signal.alerts.send_failed', {
            requestId,
            alertHash,
            error: err instanceof Error ? err.message : String(err),
          })
        })

        await recordAlert(alertHash, 'signal_invalidated_confidence', message)
      }
    }
  }

  // 4. Conviction sube/baja de tramo (low→med→high)
  if (previousSignal) {
    const convictionTranches: Array<MacroSignal['conviction']> = ['low', 'med', 'high']
    const previousIndex = convictionTranches.indexOf(previousSignal.conviction)
    const currentIndex = convictionTranches.indexOf(currentSignal.conviction)

    if (Math.abs(currentIndex - previousIndex) >= 1) {
      const alertHash = generateAlertHash(currentSignal, snapshot)
      if (!(await wasAlertSentRecently(alertHash))) {
        const direction = currentIndex > previousIndex ? '↑' : '↓'
        const message = `📊 Convicción cambia de tramo\n\n${previousSignal.conviction.toUpperCase()} ${direction} ${currentSignal.conviction.toUpperCase()}\n\nScore: ${currentSignal.score > 0 ? '+' : ''}${currentSignal.score.toFixed(0)}\nConfianza: ${(currentSignal.confidence * 100).toFixed(0)}%`
        
        await sendTelegramMessage(message).catch((err) => {
          logger.warn('signal.alerts.send_failed', {
            requestId,
            alertHash,
            error: err instanceof Error ? err.message : String(err),
          })
        })

        await recordAlert(alertHash, 'conviction_tranche_change', message)
      }
    }
  }
}

