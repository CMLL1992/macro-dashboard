/**
 * Notificaciones de Telegram para cambios de escenarios
 * Detecta cuando aparecen nuevos escenarios activos o cambios en escenarios existentes
 */

import { sendTelegramMessage } from './telegram'

type Scenario = {
  id: string
  title: string
  pair?: string
  direction?: 'BUY' | 'SELL'
  confidence?: 'Alta' | 'Media' | 'Baja'
  macroReasons?: string[]
  setupRecommendation?: string
}

type ScenarioChange = {
  type: 'new' | 'removed' | 'changed'
  scenario: Scenario
  oldConfidence?: 'Alta' | 'Media' | 'Baja'
}

/**
 * Detectar cambios en escenarios comparando con estado anterior
 */
export function detectScenarioChanges(
  currentActive: Scenario[],
  currentWatchlist: Scenario[],
  previousActive: Scenario[],
  previousWatchlist: Scenario[]
): ScenarioChange[] {
  const changes: ScenarioChange[] = []

  // Crear mapas de escenarios anteriores
  const prevActiveMap = new Map(previousActive.map(s => [s.id, s]))
  const prevWatchlistMap = new Map(previousWatchlist.map(s => [s.id, s]))

  // Detectar nuevos escenarios activos
  for (const current of currentActive) {
    const previous = prevActiveMap.get(current.id) || prevWatchlistMap.get(current.id)
    
    if (!previous) {
      changes.push({ type: 'new', scenario: current })
    } else if (previous.confidence !== current.confidence) {
      changes.push({
        type: 'changed',
        scenario: current,
        oldConfidence: previous.confidence,
      })
    }
  }

  // Detectar escenarios que se movieron de activos a watchlist
  for (const current of currentWatchlist) {
    const wasActive = prevActiveMap.has(current.id)
    if (wasActive) {
      changes.push({ type: 'changed', scenario: current, oldConfidence: 'Alta' })
    }
  }

  // Detectar escenarios removidos (estaban antes pero ya no están)
  for (const previous of [...previousActive, ...previousWatchlist]) {
    const stillExists = 
      currentActive.some(s => s.id === previous.id) ||
      currentWatchlist.some(s => s.id === previous.id)
    
    if (!stillExists) {
      changes.push({ type: 'removed', scenario: previous })
    }
  }

  return changes
}

/**
 * Notificar cambios de escenarios
 */
export async function notifyScenarioChanges(changes: ScenarioChange[]): Promise<void> {
  if (changes.length === 0) return

  const newScenarios = changes.filter(c => c.type === 'new')
  const removedScenarios = changes.filter(c => c.type === 'removed')
  const changedScenarios = changes.filter(c => c.type === 'changed')

  let message = '🎯 *Cambios en Escenarios Institucionales*\n\n'

  if (newScenarios.length > 0) {
    message += '✨ *Nuevos Escenarios Activos*\n'
    for (const change of newScenarios) {
      const s = change.scenario
      const confEmoji = s.confidence === 'Alta' ? '🟢' : '🟡'
      message += `${confEmoji} *${s.title}*\n`
      if (s.pair) message += `   Par: ${s.pair}\n`
      if (s.direction) message += `   Dirección: ${s.direction}\n`
      if (s.confidence) message += `   Confianza: ${s.confidence}\n`
      if (s.macroReasons && s.macroReasons.length > 0) {
        message += `   Razones: ${s.macroReasons.slice(0, 2).join(', ')}\n`
      }
      message += '\n'
    }
  }

  if (changedScenarios.length > 0) {
    message += '🔄 *Escenarios Modificados*\n'
    for (const change of changedScenarios) {
      const s = change.scenario
      message += `*${s.title}*\n`
      if (change.oldConfidence && s.confidence) {
        message += `   Confianza: ${change.oldConfidence} → ${s.confidence}\n`
      }
      if (s.pair) message += `   Par: ${s.pair}\n`
      message += '\n'
    }
  }

  if (removedScenarios.length > 0) {
    message += '❌ *Escenarios Removidos*\n'
    for (const change of removedScenarios) {
      message += `  • ${change.scenario.title}\n`
    }
    message += '\n'
  }

  message += `_Total: ${changes.length} cambio${changes.length !== 1 ? 's' : ''}_`

  await sendTelegramMessage(message, { noParseMode: false })
}

