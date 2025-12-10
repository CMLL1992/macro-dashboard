/**
 * Notificaciones de Telegram para cambios de datos macro
 * Detecta cuando se actualizan indicadores económicos y muestra valor anterior vs actual
 */

import { sendTelegramMessage } from './telegram'
import { getUnifiedDB, isUsingTurso } from '@/lib/db/unified-db'

type DataChange = {
  key: string
  label: string
  currency: string
  oldValue: number | null
  newValue: number | null
  date: string
  change: number | null
  changePercent: number | null
}

/**
 * Detectar cambios en datos macro comparando con valores anteriores
 */
export async function detectDataChanges(
  updatedIndicators: Array<{
    key: string
    label: string
    currency: string
    value: number | null
    date: string
  }>
): Promise<DataChange[]> {
  const db = getUnifiedDB()

  const changes: DataChange[] = []

  for (const indicator of updatedIndicators) {
    // Obtener valor anterior
    const query = `
      SELECT value, date
      FROM macro_indicators
      WHERE key = ?
        AND date < ?
      ORDER BY date DESC
      LIMIT 1
    `

    // All methods are async now, so always use await
    const previous = await db.prepare(query).get(indicator.key, indicator.date) as any

    if (!previous || previous.value === null || indicator.value === null) continue

    const oldValue = previous.value
    const newValue = indicator.value

    // Solo notificar si hay cambio significativo (más del 1% o cambio de signo)
    const change = newValue - oldValue
    const changePercent = oldValue !== 0 ? (change / Math.abs(oldValue)) * 100 : null

    const isSignificant = 
      changePercent != null && Math.abs(changePercent) > 1 ||
      (oldValue > 0 && newValue < 0) ||
      (oldValue < 0 && newValue > 0)

    if (isSignificant) {
      changes.push({
        key: indicator.key,
        label: indicator.label,
        currency: indicator.currency,
        oldValue,
        newValue,
        date: indicator.date,
        change,
        changePercent,
      })
    }
  }

  return changes
}

/**
 * Notificar cambios de datos macro
 */
export async function notifyDataChanges(changes: DataChange[]): Promise<void> {
  if (changes.length === 0) return

  // Limitar a los 10 cambios más significativos
  const significantChanges = changes
    .sort((a, b) => {
      const aImpact = Math.abs(a.changePercent ?? 0)
      const bImpact = Math.abs(b.changePercent ?? 0)
      return bImpact - aImpact
    })
    .slice(0, 10)

  let message = '📈 *Actualización de Datos Macro*\n\n'

  // Agrupar por moneda
  const byCurrency: Record<string, DataChange[]> = {}
  for (const change of significantChanges) {
    if (!byCurrency[change.currency]) {
      byCurrency[change.currency] = []
    }
    byCurrency[change.currency].push(change)
  }

  for (const [currency, currencyChanges] of Object.entries(byCurrency)) {
    message += `*${currency}*\n`
    
    for (const change of currencyChanges) {
      const emoji = change.changePercent != null && change.changePercent > 0 ? '📈' : '📉'
      message += `${emoji} *${change.label}*\n`
      message += `   Anterior: ${change.oldValue?.toFixed(2) ?? 'N/A'}\n`
      message += `   Actual: ${change.newValue?.toFixed(2) ?? 'N/A'}\n`
      
      if (change.change != null && change.changePercent != null) {
        const sign = change.change > 0 ? '+' : ''
        message += `   Cambio: ${sign}${change.change.toFixed(2)} (${sign}${change.changePercent.toFixed(2)}%)\n`
      }
      
      message += '\n'
    }
  }

  message += `_Total: ${significantChanges.length} actualización${significantChanges.length !== 1 ? 'es' : ''} significativa${significantChanges.length !== 1 ? 's' : ''}_`

  await sendTelegramMessage(message, { noParseMode: false })
}

