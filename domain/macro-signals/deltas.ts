/**
 * Delta Engine
 * 
 * Calcula deltas "trading-grade" entre snapshot actual y anterior.
 * Identifica cambios que invalidan o refuerzan el plan de trading.
 */

import type { MacroSnapshot } from '../macro-snapshot/schema'
import type { MacroSignal } from './engine'

export type DeltaSeverity = 'info' | 'warning' | 'error' | 'hard_stop'

export interface SnapshotDelta {
  id: string
  severity: DeltaSeverity
  message: string
  context?: Record<string, unknown>
}

/**
 * Calculate deltas between current and previous snapshot
 * 
 * Returns array of deltas ordered by severity (hard_stop > error > warning > info)
 */
export function calculateSnapshotDeltas(
  current: MacroSnapshot,
  previous: MacroSnapshot | null,
  currentSignal: MacroSignal,
  previousSignal?: MacroSignal
): SnapshotDelta[] {
  const deltas: SnapshotDelta[] = []

  if (!previous) {
    return deltas // No previous snapshot, no deltas
  }

  const currentScore = current.metrics?.score ?? current.score ?? 0
  const previousScore = previous.metrics?.score ?? previous.score ?? 0
  const deltaScore = currentScore - previousScore

  // 1. Hard Stop: Cambio de régimen
  const currentRegime = current.regime?.overall ?? 'Neutral'
  const previousRegime = previous.regime?.overall ?? 'Neutral'
  if (currentRegime !== previousRegime) {
    deltas.push({
      id: 'regime_change',
      severity: 'hard_stop',
      message: `Cambio de régimen: ${previousRegime} → ${currentRegime}`,
      context: {
        previous: previousRegime,
        current: currentRegime,
        action: 're-evaluar todo',
      },
    })
  }

  // 2. Hard Stop: Cambio de dirección del driver #1
  const currentTopDriver = current.drivers
    .filter(d => Math.abs(d.weight ?? 0) > 0.1)
    .sort((a, b) => Math.abs(b.weight ?? 0) - Math.abs(a.weight ?? 0))[0]

  const previousTopDriver = previous.drivers
    .filter(d => Math.abs(d.weight ?? 0) > 0.1)
    .sort((a, b) => Math.abs(b.weight ?? 0) - Math.abs(a.weight ?? 0))[0]

  if (currentTopDriver && previousTopDriver) {
    if (currentTopDriver.key === previousTopDriver.key && currentTopDriver.direction !== previousTopDriver.direction) {
      deltas.push({
        id: 'top_driver_direction_change',
        severity: 'hard_stop',
        message: `Driver #1 (${currentTopDriver.name || currentTopDriver.key}) cambió dirección: ${previousTopDriver.direction} → ${currentTopDriver.direction}`,
        context: {
          driver: currentTopDriver.name || currentTopDriver.key,
          previousDirection: previousTopDriver.direction,
          currentDirection: currentTopDriver.direction,
          action: 're-evaluar señal',
        },
      })
    }
  }

  // 3. Error: Cambio de ancla de correlación (desaparece o cae |corr|<0.7)
  const currentAnchor = (() => {
    const correlations = current.correlations
    if (!correlations || correlations.length === 0) return null
    return correlations
      .map(c => ({
        symbol: c.symbol,
        corr: c.corr12m ?? c.corr6m ?? c.corr3m ?? 0,
      }))
      .filter(c => Math.abs(c.corr) > 0.7)
      .sort((a, b) => Math.abs(b.corr) - Math.abs(a.corr))[0]
  })()

  const previousAnchor = (() => {
    const correlations = previous.correlations
    if (!correlations || correlations.length === 0) return null
    return correlations
      .map(c => ({
        symbol: c.symbol,
        corr: c.corr12m ?? c.corr6m ?? c.corr3m ?? 0,
      }))
      .filter(c => Math.abs(c.corr) > 0.7)
      .sort((a, b) => Math.abs(b.corr) - Math.abs(a.corr))[0]
  })()

  if (previousAnchor && (!currentAnchor || currentAnchor.symbol !== previousAnchor.symbol || Math.abs(currentAnchor.corr) < 0.7)) {
    deltas.push({
      id: 'anchor_correlation_lost',
      severity: 'error',
      message: `Correlación ancla perdida: ${previousAnchor.symbol} (${(previousAnchor.corr * 100).toFixed(0)}%)`,
      context: {
        previousSymbol: previousAnchor.symbol,
        previousCorr: previousAnchor.corr,
        currentAnchor: currentAnchor ? `${currentAnchor.symbol} (${(currentAnchor.corr * 100).toFixed(0)}%)` : 'ninguna',
      },
    })
  }

  // 4. Error: Score cruza 0 (cambio de dirección)
  if ((previousScore > 0 && currentScore < 0) || (previousScore < 0 && currentScore > 0)) {
    deltas.push({
      id: 'score_crosses_zero',
      severity: 'error',
      message: `Score cruza 0: ${previousScore > 0 ? '+' : ''}${previousScore.toFixed(0)} → ${currentScore > 0 ? '+' : ''}${currentScore.toFixed(0)}`,
      context: {
        previousScore,
        currentScore,
        action: 'invalidar señal',
      },
    })
  }

  // 5. Warning: Δscore significativo (pérdida de edge o impulso a favor)
  if (Math.abs(deltaScore) >= 15) {
    const label = deltaScore > 0 
      ? (currentSignal.biasDirection === 'long' ? 'impulso a favor' : 'pérdida de edge')
      : (currentSignal.biasDirection === 'short' ? 'impulso a favor' : 'pérdida de edge')
    
    deltas.push({
      id: 'score_delta_significant',
      severity: 'warning',
      message: `Δscore: ${deltaScore > 0 ? '+' : ''}${deltaScore.toFixed(0)} (${label})`,
      context: {
        deltaScore,
        previousScore,
        currentScore,
        label,
      },
    })
  }

  // 6. Warning: Δtime-to-next-event (si entra en <4h)
  if (currentSignal.timeToNextEvent && previousSignal?.timeToNextEvent) {
    const currentMinutes = currentSignal.timeToNextEvent.minutes
    const previousMinutes = previousSignal.timeToNextEvent.minutes
    const deltaMinutes = currentMinutes - previousMinutes

    // Si antes estaba >4h y ahora está <4h, es un warning crítico
    if (previousMinutes >= 240 && currentMinutes < 240) {
      deltas.push({
        id: 'event_enters_blocked_window',
        severity: 'error',
        message: `Evento entra en ventana bloqueada: T-${Math.floor(previousMinutes / 60)}h → T-${Math.floor(currentMinutes / 60)}h`,
        context: {
          eventName: currentSignal.timeToNextEvent.eventName,
          previousMinutes,
          currentMinutes,
          action: 'bloquear trades',
        },
      })
    } else if (Math.abs(deltaMinutes) >= 60) {
      // Cambio significativo de tiempo (>1h)
      deltas.push({
        id: 'time_to_event_delta',
        severity: 'warning',
        message: `Δtime-to-event: ${deltaMinutes > 0 ? '+' : ''}${Math.floor(deltaMinutes / 60)}h`,
        context: {
          eventName: currentSignal.timeToNextEvent.eventName,
          previousMinutes,
          currentMinutes,
        },
      })
    }
  }

  // 7. Info: Cambio de driver #1 (peso, no dirección)
  if (currentTopDriver && previousTopDriver && currentTopDriver.key === previousTopDriver.key) {
    const deltaWeight = (currentTopDriver.weight ?? 0) - (previousTopDriver.weight ?? 0)
    if (Math.abs(deltaWeight) >= 0.1) {
      deltas.push({
        id: 'top_driver_weight_change',
        severity: 'info',
        message: `Driver #1 peso: ${((previousTopDriver.weight ?? 0) * 100).toFixed(0)}% → ${((currentTopDriver.weight ?? 0) * 100).toFixed(0)}%`,
        context: {
          driver: currentTopDriver.name || currentTopDriver.key,
          previousWeight: previousTopDriver.weight ?? 0,
          currentWeight: currentTopDriver.weight ?? 0,
        },
      })
    }
  }

  // Sort by severity (hard_stop > error > warning > info)
  const severityOrder: Record<DeltaSeverity, number> = {
    hard_stop: 0,
    error: 1,
    warning: 2,
    info: 3,
  }

  return deltas.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]).slice(0, 6) // Max 6 deltas
}

