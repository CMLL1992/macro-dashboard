/**
 * Notificaciones de Telegram para cambios de confianza en pares
 * Detecta cuando cambia el nivel de confianza (Alta/Media/Baja) de un par
 */

import { sendTelegramMessage } from './telegram'
import { getUnifiedDB, isUsingTurso } from '@/lib/db/unified-db'

type ConfidenceChange = {
  pair: string
  oldConfidence: 'Alta' | 'Media' | 'Baja'
  newConfidence: 'Alta' | 'Media' | 'Baja'
  action: string
  trend: string
}

/**
 * Detectar cambios de confianza comparando con el último snapshot
 */
export async function detectConfidenceChanges(
  currentPairs: Array<{
    pair: string
    confidence: string
    action: string
    trend: string
  }>
): Promise<ConfidenceChange[]> {
  const db = getUnifiedDB()
  const usingTurso = isUsingTurso()
  const today = new Date().toISOString().split('T')[0]

  // Obtener confianza anterior (último snapshot)
  const previousQuery = `
    SELECT symbol, confidence, action
    FROM pair_signals
    WHERE date < ?
    ORDER BY date DESC
    LIMIT 100
  `

  let previousSignals: any[] = []
  if (usingTurso) {
    previousSignals = await db.prepare(previousQuery).all(today) as any[]
  } else {
    previousSignals = db.prepare(previousQuery).all(today) as any[]
  }

  // Crear mapa de confianza anterior por par
  const previousMap = new Map<string, { confidence: string; action: string }>()
  for (const signal of previousSignals) {
    if (!previousMap.has(signal.symbol)) {
      previousMap.set(signal.symbol, {
        confidence: signal.confidence,
        action: signal.action,
      })
    }
  }

  // Detectar cambios
  const changes: ConfidenceChange[] = []

  for (const current of currentPairs) {
    const symbol = current.pair.replace('/', '').toUpperCase()
    const previous = previousMap.get(symbol)

    if (!previous) continue // Par nuevo, no es un cambio

    const oldConf = previous.confidence.charAt(0).toUpperCase() + previous.confidence.slice(1).toLowerCase() as 'Alta' | 'Media' | 'Baja'
    const newConf = (current.confidence.charAt(0).toUpperCase() + current.confidence.slice(1).toLowerCase()) as 'Alta' | 'Media' | 'Baja'

    if (oldConf !== newConf) {
      changes.push({
        pair: current.pair,
        oldConfidence: oldConf,
        newConfidence: newConf,
        action: current.action,
        trend: current.trend,
      })
    }
  }

  return changes
}

/**
 * Notificar cambios de confianza
 */
export async function notifyConfidenceChanges(changes: ConfidenceChange[]): Promise<void> {
  if (changes.length === 0) return

  let message = '📊 *Cambios de Confianza en Pares*\n\n'

  // Agrupar por tipo de cambio
  const upgrades = changes.filter(c => {
    const levels = { 'Baja': 1, 'Media': 2, 'Alta': 3 }
    return levels[c.newConfidence] > levels[c.oldConfidence]
  })

  const downgrades = changes.filter(c => {
    const levels = { 'Baja': 1, 'Media': 2, 'Alta': 3 }
    return levels[c.newConfidence] < levels[c.oldConfidence]
  })

  if (upgrades.length > 0) {
    message += '✅ *Mejoras de Confianza*\n'
    for (const change of upgrades) {
      message += `  • *${change.pair}*: ${change.oldConfidence} → ${change.newConfidence}\n`
      message += `    ${change.action} (${change.trend})\n`
    }
    message += '\n'
  }

  if (downgrades.length > 0) {
    message += '⚠️ *Reducciones de Confianza*\n'
    for (const change of downgrades) {
      message += `  • *${change.pair}*: ${change.oldConfidence} → ${change.newConfidence}\n`
      message += `    ${change.action} (${change.trend})\n`
    }
    message += '\n'
  }

  message += `_Total: ${changes.length} cambio${changes.length !== 1 ? 's' : ''}_`

  await sendTelegramMessage(message, { noParseMode: false })
}

