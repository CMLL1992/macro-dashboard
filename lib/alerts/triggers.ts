/**
 * Alert triggers
 * Detect changes and generate alerts
 */

import { sendTelegramMessage } from '@/lib/notifications/telegram'
import {
  loadAlertState,
  saveAlertState,
  getUSDState,
  getCorrelationLevel,
  getLastMacroDate,
  calculateCorrelationLevel,
  CRITICAL_MACRO_SERIES,
} from './state'
import {
  buildUSDChangeMessage,
  buildCorrelationChangeMessage,
  buildMacroReleaseMessage,
  getMacroEffectText,
} from './builders'
import type { USDState, CorrelationLevel } from './state'

/**
 * Check if feature flag is enabled
 */
function isFlagEnabled(flag: string): boolean {
  return process.env[flag] === 'true'
}

/**
 * Rate limiting: track last message time
 * Note: Actual rate limiting is handled in sendTelegramMessage
 */

/**
 * Trigger A: USD regime change
 */
export async function checkUSDChange(
  currentUSD: USDState,
  regime: string,
  score: number,
  latestDataDate: string | null,
  categoryChips: string
): Promise<void> {
  if (!isFlagEnabled('ENABLE_TELEGRAM_NOTIFICATIONS') || !isFlagEnabled('ENABLE_USD_REGIME_ALERTS')) {
    return
  }

  const state = await loadAlertState()
  const prevUSD = state.usdBias

  if (prevUSD !== null && prevUSD !== currentUSD) {
    const message = buildUSDChangeMessage(prevUSD, currentUSD, regime, score, latestDataDate, categoryChips)
    // If tests enabled, force test mode
    const useTestMode = process.env.ENABLE_TELEGRAM_TESTS === 'true'
    const result = await sendTelegramMessage(message, { test: useTestMode })
    
    if (!result.success && result.error?.includes('Rate limit')) {
      console.warn('[alerts] Rate limit: skipping USD change notification')
      return
    }

    // Update state
    await saveAlertState({
      usdBias: currentUSD,
      usdBiasUpdatedAt: new Date().toISOString(),
    })
  } else if (prevUSD === null) {
    // First run: just save state, don't send notification
    await saveAlertState({
      usdBias: currentUSD,
      usdBiasUpdatedAt: new Date().toISOString(),
    })
  }
}

/**
 * Trigger B: Correlation threshold cross
 */
export async function checkCorrelationChanges(
  correlations: Array<{
    symbol: string
    corr12m: number | null
    corr3m: number | null
  }>
): Promise<void> {
  if (!isFlagEnabled('ENABLE_TELEGRAM_NOTIFICATIONS') || !isFlagEnabled('ENABLE_CORR_ALERTS')) {
    return
  }

  const state = await loadAlertState()
  const alerts: string[] = []
  const newLevels: Record<string, { '3m'?: CorrelationLevel; '12m'?: CorrelationLevel }> = {}

  for (const corr of correlations) {
    const { symbol, corr12m, corr3m } = corr

    // Check 12m
    if (corr12m != null) {
      const newLevel12m = calculateCorrelationLevel(corr12m)
      const prevLevel12m = state.correlationLevels[symbol]?.['12m']

      if (newLevel12m && prevLevel12m !== undefined && newLevel12m !== prevLevel12m) {
        const signal = corr12m > 0.1 ? 'Directa' : corr12m < -0.1 ? 'Inversa' : 'Neutra'
        const message = buildCorrelationChangeMessage(symbol, '12m', newLevel12m, corr12m, signal, corr12m, corr3m)
        alerts.push(message)
      }

      if (!newLevels[symbol]) newLevels[symbol] = {}
      newLevels[symbol]['12m'] = newLevel12m || undefined
    }

    // Check 3m
    if (corr3m != null) {
      const newLevel3m = calculateCorrelationLevel(corr3m)
      const prevLevel3m = state.correlationLevels[symbol]?.['3m']

      if (newLevel3m && prevLevel3m !== undefined && newLevel3m !== prevLevel3m) {
        const signal = corr3m > 0.1 ? 'Directa' : corr3m < -0.1 ? 'Inversa' : 'Neutra'
        const message = buildCorrelationChangeMessage(symbol, '3m', newLevel3m, corr3m, signal, corr12m, corr3m)
        alerts.push(message)
      }

      if (!newLevels[symbol]) newLevels[symbol] = {}
      newLevels[symbol]['3m'] = newLevel3m || undefined
    }
  }

  // Send grouped alerts (if any)
  if (alerts.length > 0) {
    // If tests enabled, force test mode
    const useTestMode = process.env.ENABLE_TELEGRAM_TESTS === 'true'
    // Group multiple alerts into one message if > 3
    if (alerts.length > 3) {
      const groupedMessage = `🔗 *Cambios en correlaciones* (${alerts.length} activos)\n\n${alerts.join('\n\n---\n\n')}\n\n#correlaciones #usd`
      const result = await sendTelegramMessage(groupedMessage, { test: useTestMode })
      if (!result.success && result.error?.includes('Rate limit') && alerts.length <= 3) {
        console.warn('[alerts] Rate limit: skipping correlation change notifications')
        return
      }
    } else {
      // Send individually
      for (const alert of alerts) {
        const result = await sendTelegramMessage(alert, { test: useTestMode })
        if (!result.success && result.error?.includes('Rate limit')) {
          console.warn('[alerts] Rate limit: skipping remaining correlation notifications')
          break
        }
      }
    }

    // Update state
    await saveAlertState({ correlationLevels: { ...state.correlationLevels, ...newLevels } })
  } else {
    // No alerts, but update state anyway
    await saveAlertState({ correlationLevels: { ...state.correlationLevels, ...newLevels } })
  }
}

/**
 * Trigger C: Macro release
 */
export async function checkMacroReleases(
  observations: Array<{
    seriesId: string
    label: string
    value: number
    valuePrevious: number | null
    date: string
    datePrevious: string | null
    trend: 'Mejora' | 'Empeora' | 'Estable'
    posture: 'Hawkish' | 'Dovish' | 'Neutral'
  }>
): Promise<void> {
  if (!isFlagEnabled('ENABLE_TELEGRAM_NOTIFICATIONS') || !isFlagEnabled('ENABLE_MACRO_RELEASE_ALERTS')) {
    return
  }

  const state = await loadAlertState()
  const alerts: string[] = []
  const newDates: Record<string, string> = {}

  for (const obs of observations) {
    const { seriesId, date, value, valuePrevious, label, trend, posture } = obs

    // Only check critical series
    if (!CRITICAL_MACRO_SERIES.includes(seriesId as any)) {
      continue
    }

    const lastDate = state.lastMacroDates[seriesId]

    // Check if this is a new date
    if (lastDate && date > lastDate) {
      const effectText = getMacroEffectText(seriesId, trend, posture)
      const message = buildMacroReleaseMessage(
        label,
        value,
        valuePrevious,
        date,
        trend,
        posture,
        effectText,
        seriesId
      )
      alerts.push(message)
    } else if (!lastDate) {
      // First time seeing this series: just record, don't alert
    }

    newDates[seriesId] = date
  }

  // Send alerts
  if (alerts.length > 0) {
    // If tests enabled, force test mode
    const useTestMode = process.env.ENABLE_TELEGRAM_TESTS === 'true'
    // Group multiple alerts into one message if > 3
    if (alerts.length > 3) {
      const groupedMessage = `🗓️ *Nuevos datos macro* (${alerts.length} indicadores)\n\n${alerts.join('\n\n---\n\n')}\n\n#macro #datos`
      const result = await sendTelegramMessage(groupedMessage, { test: useTestMode })
      if (!result.success && result.error?.includes('Rate limit') && alerts.length <= 3) {
        console.warn('[alerts] Rate limit: skipping macro release notifications')
        return
      }
    } else {
      // Send individually
      for (const alert of alerts) {
        const result = await sendTelegramMessage(alert, { test: useTestMode })
        if (!result.success && result.error?.includes('Rate limit')) {
          console.warn('[alerts] Rate limit: skipping remaining macro notifications')
          break
        }
      }
    }

    // Update state
    await saveAlertState({ lastMacroDates: { ...state.lastMacroDates, ...newDates } })
  } else {
    // No alerts, but update state anyway
    await saveAlertState({ lastMacroDates: { ...state.lastMacroDates, ...newDates } })
  }
}

