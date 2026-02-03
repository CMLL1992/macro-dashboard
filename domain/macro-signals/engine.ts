/**
 * Macro Signal Engine
 * 
 * Genera señales de trading basadas en MacroSnapshot:
 * - biasDirection (long/short/neutral)
 * - conviction (low/med/high)
 * - riskFlags (eventos cercanos, inconsistencias, baja confianza)
 * - playbookNotes (2-5 bullets)
 * 
 * Diseñado para price action + confirmaciones macro.
 */

import type { MacroSnapshot } from '../macro-snapshot/schema'
import type { InvariantResult } from '@/lib/quality/invariants'

export type BiasDirection = 'long' | 'short' | 'neutral'
export type Conviction = 'low' | 'med' | 'high'

export interface RiskFlag {
  id: string
  severity: 'low' | 'medium' | 'high'
  message: string
  reason: string
}

export type SignalAction = 'LONG' | 'SHORT' | 'NEUTRAL' | 'NO_TRADE'

export interface ExecutionChecklist {
  setup: {
    regime: string
    usdBias: string
    topDrivers: Array<{ name: string; direction: string; weight: number }>
    anchorCorrelation?: { symbol: string; corr: number }
  }
  blockers: Array<{
    id: string
    message: string
    conditionToResolve: string // "Esperar a que pase el evento" | "Re-evaluar cuando invariants vuelvan a OK"
  }>
  invalidationConditions: Array<{
    id: string
    condition: string // "Si score cruza 0" | "Si confidence cae < 0.5" | "Si driver #1 cambia dirección"
  }>
}

/**
 * Position Sizing Guidance
 * 
 * Recomendación de tamaño de posición basada en:
 * - Conviction (high/med/low)
 * - Risk flags (número y severidad)
 * - NO_TRADE state
 * 
 * Valores en "risk units" (R):
 * - NO_TRADE → 0R
 * - Low conviction → 0.25R (mínimo)
 * - Med conviction → 0.5R (normal)
 * - High conviction → 1R (máximo)
 * 
 * Reducciones por warnings:
 * - 2+ high/medium risk flags → reducir 50%
 * - 1 high risk flag → reducir 25%
 */
export interface PositionSizingGuidance {
  recommendedRiskUnits: number // 0, 0.25, 0.5, 0.75, 1.0
  baseSize: number // Tamaño base según conviction
  reductionFactor: number // Factor de reducción por warnings (0-1)
  reason: string // Explicación del sizing
  warnings: string[] // Lista de warnings que afectan el sizing
}

/**
 * Execution Plan
 * 
 * Plan de ejecución con templates de entry/invalidation/cancelación.
 * Lenguaje "de operador" para decisiones claras.
 */
export interface ExecutionPlan {
  entryGuidance: string // "Solo buscar LONG si X, invalidar si Y"
  invalidationTriggers: Array<{
    id: string
    trigger: string // "Score cruza 0" | "Driver #1 cambia dirección"
    action: string // "Cerrar posición inmediatamente"
  }>
  cancellationConditions: Array<{
    id: string
    condition: string // "Si régimen cambia a X"
    action: string // "Cancelar setup y re-evaluar"
  }>
}

/**
 * Cooldown State
 * 
 * Estado de cooldown después de hard_stop.
 * Previene "revenge trading" bloqueando re-entry hasta que se cumplan condiciones.
 */
export interface CooldownState {
  isActive: boolean
  reason: string // "Hard stop: cambio de régimen"
  expiresAt?: string // ISO timestamp cuando expira el cooldown
  revalidationConditions: string[] // Condiciones para revalidar (ej: "Esperar nuevo snapshot sin hard_stop")
}

export interface SnapshotDelta {
  id: string
  severity: 'info' | 'warning' | 'error' | 'hard_stop'
  message: string
  context?: Record<string, unknown>
}

export interface MacroSignal {
  action: SignalAction // Acción prioritaria (NO_TRADE tiene precedencia)
  actionReason?: string // Razón de la acción (especialmente para NO_TRADE)
  biasDirection: BiasDirection // Dirección del bias (si no hay NO_TRADE)
  conviction: Conviction
  riskFlags: RiskFlag[]
  playbookNotes: string[]
  executionChecklist: ExecutionChecklist // Checklist de ejecución
  positionSizing?: PositionSizingGuidance // Fase 3.3: Guía de position sizing
  executionPlan?: ExecutionPlan // Fase 3.3: Plan de ejecución con templates
  cooldownState?: CooldownState // Fase 3.3: Estado de cooldown después de hard_stop
  timeToNextEvent?: {
    minutes: number // Minutos hasta el próximo evento de alta importancia
    eventName: string
    status: 'blocked' | 'warning' | 'ok' // <4h: blocked, 4-12h: warning, >12h: ok
  }
  deltas?: SnapshotDelta[] // Deltas desde snapshot anterior (si includePrevious=true)
  noTradeWindow: boolean // Deprecated: usar action === 'NO_TRADE'
  noTradeReason?: string // Deprecated: usar actionReason
  score: number // -100 to 100
  confidence: number // 0 to 1
}

/**
 * Calculate bias direction from snapshot score
 */
function calculateBiasDirection(score: number): BiasDirection {
  if (score > 20) return 'long'
  if (score < -20) return 'short'
  return 'neutral'
}

/**
 * Calculate conviction from score magnitude, confidence, and invariants
 * 
 * Calibración:
 * - high: abs(score) >= 50 AND confidence >= 0.7 AND sin errores de invariants
 * - med: abs(score) >= 30 OR confidence >= 0.6 (y sin eventos cercanos)
 * - low: resto
 */
function calculateConviction(
  score: number,
  confidence: number | null | undefined,
  hasInvariantErrors: boolean,
  hasNearEvents: boolean
): Conviction {
  const absScore = Math.abs(score)
  const conf = confidence ?? 0.5

  // High conviction: strong score + high confidence + sin errores
  if (absScore >= 50 && conf >= 0.7 && !hasInvariantErrors) {
    return 'high'
  }
  
  // Medium conviction: moderate score o moderate confidence (sin eventos cercanos)
  if ((absScore >= 30 || conf >= 0.6) && !hasNearEvents) {
    return 'med'
  }
  
  // Low conviction: weak score o low confidence o eventos cercanos o errores
  return 'low'
}

/**
 * Extract risk flags from snapshot and invariants
 */
function extractRiskFlags(
  snapshot: MacroSnapshot,
  invariants: InvariantResult[]
): RiskFlag[] {
  const flags: RiskFlag[] = []

  // 1. Check for errors in invariants (HIGHEST PRIORITY)
  const errorInvariants = invariants.filter(i => i.level === 'FAIL')
  if (errorInvariants.length > 0) {
    flags.push({
      id: 'invariant_errors',
      severity: 'high',
      message: `${errorInvariants.length} inconsistencia(s) crítica(s) detectada(s)`,
      reason: 'El snapshot tiene inconsistencias que pueden invalidar las señales',
    })
  }

  // 2. Check for high-importance events in next 4 hours (HIGH PRIORITY)
  const now = new Date(snapshot.nowTs)
  const next4h = new Date(now.getTime() + 4 * 60 * 60 * 1000)

  const upcomingHighImportance4h = snapshot.upcomingDates
    .filter(d => {
      const eventDate = new Date(d.date)
      return eventDate <= next4h && d.importance === 'high'
    })

  if (upcomingHighImportance4h.length > 0) {
    flags.push({
      id: 'upcoming_high_importance_4h',
      severity: 'high',
      message: `${upcomingHighImportance4h.length} evento(s) de alta importancia en < 4h`,
      reason: 'Eventos macro de alta importancia pueden causar volatilidad extrema - NO TRADE',
    })
  }

  // 3. Check for missing narrative (MEDIUM)
  if (!snapshot.narrative || !snapshot.narrative.headline) {
    flags.push({
      id: 'missing_narrative',
      severity: 'medium',
      message: 'Narrativa macro no disponible',
      reason: 'Falta contexto narrativo para entender el régimen actual',
    })
  }

  // 4. Check for low confidence (MEDIUM)
  const score = snapshot.metrics?.score ?? snapshot.score ?? 0
  const absScore = Math.abs(score)
  const derivedConfidence = Math.min(absScore / 100, 1) // Normalize to 0-1
  if (derivedConfidence < 0.5) {
    flags.push({
      id: 'low_confidence',
      severity: 'medium',
      message: 'Confianza baja en el diagnóstico macro',
      reason: `Score: ${score.toFixed(0)} - Los datos pueden ser incompletos o el régimen es neutral`,
    })
  }

  // 5. Check for warnings in invariants (MEDIUM)
  const warnInvariants = invariants.filter(i => i.level === 'WARN')
  if (warnInvariants.length > 2) {
    flags.push({
      id: 'invariant_warnings',
      severity: 'medium',
      message: `${warnInvariants.length} advertencia(s) de calidad`,
      reason: 'Múltiples advertencias sugieren datos incompletos o desactualizados',
    })
  }

  return flags
}

/**
 * Generate playbook notes from snapshot
 * 
 * Estructura:
 * 1. Régimen + USD bias
 * 2. 2 drivers principales (con dirección y peso)
 * 3. Próximo evento de alta importancia y ventana
 * 4. 1 correlación "ancla" (si existe, |corr| > 0.7)
 */
function generatePlaybookNotes(snapshot: MacroSnapshot): string[] {
  const notes: string[] = []

  // 1. Régimen + USD bias
  const regime = snapshot.regime?.overall ?? 'Neutral'
  const usdBias = snapshot.usdBias
  if (regime !== 'Neutral' || (usdBias && usdBias !== 'NEUTRAL')) {
    const regimeLabel = regime !== 'Neutral' ? `Régimen: ${regime}` : ''
    const usdLabel = usdBias && usdBias !== 'NEUTRAL' 
      ? `USD: ${usdBias === 'STRONG' || usdBias === 'Fuerte' ? 'Fuerte' : 'Débil'}`
      : ''
    const combined = [regimeLabel, usdLabel].filter(Boolean).join(' | ')
    if (combined) notes.push(combined)
  }

  // 2. Top 2 drivers principales (con dirección y peso)
  const topDrivers = snapshot.drivers
    .filter(d => Math.abs(d.weight ?? 0) > 0.1)
    .sort((a, b) => Math.abs(b.weight ?? 0) - Math.abs(a.weight ?? 0))
    .slice(0, 2)

  if (topDrivers.length > 0) {
    const driverNotes = topDrivers.map(d => {
      const name = d.name || d.key
      const direction = d.direction === 'long' ? '↑' : d.direction === 'short' ? '↓' : '→'
      const weight = ((d.weight ?? 0) * 100).toFixed(0)
      return `${name} ${direction} (${weight}%)`
    })
    notes.push(`Drivers: ${driverNotes.join(', ')}`)
  }

  // 3. Próximo evento de alta importancia y ventana
  const now = new Date(snapshot.nowTs)
  const upcomingHighImportance = snapshot.upcomingDates
    .filter(d => d.importance === 'high')
    .map(d => ({
      ...d,
      date: new Date(d.date),
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime())

  if (upcomingHighImportance.length > 0) {
    const nextEvent = upcomingHighImportance[0]
    const hoursUntil = Math.round((nextEvent.date.getTime() - now.getTime()) / (1000 * 60 * 60))
    if (hoursUntil < 24) {
      notes.push(`Próximo evento alta: ${nextEvent.name} en ${hoursUntil}h`)
    } else {
      const daysUntil = Math.round(hoursUntil / 24)
      notes.push(`Próximo evento alta: ${nextEvent.name} en ${daysUntil}d`)
    }
  }

  // 4. 1 correlación "ancla" (si existe, |corr| > 0.7)
  const correlations = snapshot.correlations
  if (correlations && correlations.length > 0) {
    const strongCorr = correlations
      .map(c => ({
        symbol: c.symbol,
        corr: c.corr12m ?? c.corr6m ?? c.corr3m ?? 0,
      }))
      .filter(c => Math.abs(c.corr) > 0.7)
      .sort((a, b) => Math.abs(b.corr) - Math.abs(a.corr))[0]

    if (strongCorr) {
      const corrLabel = strongCorr.corr > 0 ? '+' : ''
      notes.push(`Correlación ancla: ${strongCorr.symbol} ${corrLabel}${(strongCorr.corr * 100).toFixed(0)}%`)
    }
  }

  return notes.slice(0, 5) // Max 5 notes
}

/**
 * Check if we're in a "no trade window" (high-importance event within X hours)
 * and calculate time to next event
 */
function checkNoTradeWindow(
  snapshot: MacroSnapshot,
  hoursThreshold: number = 4
): { noTradeWindow: boolean; reason?: string; timeToNextEvent?: { minutes: number; eventName: string; status: 'blocked' | 'warning' | 'ok' } } {
  const now = new Date(snapshot.nowTs)
  const threshold4h = new Date(now.getTime() + 4 * 60 * 60 * 1000)
  const threshold12h = new Date(now.getTime() + 12 * 60 * 60 * 1000)

  // Find next high-importance event
  const upcomingHighImportance = snapshot.upcomingDates
    .filter(d => d.importance === 'high')
    .map(d => ({
      ...d,
      date: new Date(d.date),
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime())

  if (upcomingHighImportance.length > 0) {
    const nextEvent = upcomingHighImportance[0]
    const minutesUntil = Math.round((nextEvent.date.getTime() - now.getTime()) / (1000 * 60))
    
    // Determine status
    let status: 'blocked' | 'warning' | 'ok'
    if (nextEvent.date <= threshold4h) {
      status = 'blocked'
    } else if (nextEvent.date <= threshold12h) {
      status = 'warning'
    } else {
      status = 'ok'
    }

    const eventNames = upcomingHighImportance
      .filter(e => e.date <= threshold4h)
      .map(e => e.name)
      .join(', ')

    return {
      noTradeWindow: eventNames.length > 0,
      reason: eventNames.length > 0 ? `Evento(s) de alta importancia en <${hoursThreshold}h: ${eventNames}` : undefined,
      timeToNextEvent: {
        minutes: minutesUntil,
        eventName: nextEvent.name,
        status,
      },
    }
  }

  return { noTradeWindow: false }
}

/**
 * Calculate position sizing guidance
 * 
 * Reglas:
 * - NO_TRADE → 0R
 * - Low conviction → 0.25R base
 * - Med conviction → 0.5R base
 * - High conviction → 1R base
 * - Reducciones: 2+ high/medium flags → -50%, 1 high flag → -25%
 */
function calculatePositionSizing(
  action: SignalAction,
  conviction: Conviction,
  riskFlags: RiskFlag[]
): PositionSizingGuidance {
  // Base size según conviction
  let baseSize = 0
  if (action === 'NO_TRADE') {
    return {
      recommendedRiskUnits: 0,
      baseSize: 0,
      reductionFactor: 1,
      reason: 'NO_TRADE activo - no operar',
      warnings: [],
    }
  }

  switch (conviction) {
    case 'high':
      baseSize = 1.0
      break
    case 'med':
      baseSize = 0.5
      break
    case 'low':
      baseSize = 0.25
      break
  }

  // Calcular reducciones por warnings
  const highFlags = riskFlags.filter(f => f.severity === 'high')
  const mediumFlags = riskFlags.filter(f => f.severity === 'medium')
  const totalHighMedium = highFlags.length + mediumFlags.length

  let reductionFactor = 1.0
  const warnings: string[] = []

  if (totalHighMedium >= 2) {
    reductionFactor = 0.5 // Reducir 50%
    warnings.push(`${totalHighMedium} flags de riesgo alto/medio detectados`)
  } else if (highFlags.length >= 1) {
    reductionFactor = 0.75 // Reducir 25%
    warnings.push(`${highFlags.length} flag(s) de riesgo alto detectado(s)`)
  }

  const recommendedRiskUnits = Math.max(0, baseSize * reductionFactor)

  // Round to nearest 0.25
  const rounded = Math.round(recommendedRiskUnits * 4) / 4

  let reason = `Convicción ${conviction} → ${baseSize}R base`
  if (reductionFactor < 1) {
    reason += `, reducido ${((1 - reductionFactor) * 100).toFixed(0)}% por warnings`
  }

  return {
    recommendedRiskUnits: rounded,
    baseSize,
    reductionFactor,
    reason,
    warnings,
  }
}

/**
 * Generate execution plan with entry/invalidation templates
 * 
 * Lenguaje "de operador": instrucciones claras y accionables.
 */
function generateExecutionPlan(
  snapshot: MacroSnapshot,
  signal: Omit<MacroSignal, 'executionChecklist' | 'timeToNextEvent' | 'positionSizing' | 'executionPlan' | 'cooldownState'>,
  executionChecklist: ExecutionChecklist
): ExecutionPlan {
  const { action, biasDirection, conviction, riskFlags, deltas } = signal

  // Entry guidance
  let entryGuidance = ''
  if (action === 'NO_TRADE') {
    entryGuidance = 'NO OPERAR - Bloqueado por condiciones de riesgo'
  } else if (action === 'NEUTRAL') {
    entryGuidance = 'Solo operaciones tácticas / rango - sin sesgo macro claro'
  } else {
    const direction = action === 'LONG' ? 'LONG' : 'SHORT'
    const conditions: string[] = []

    // Condiciones de setup
    if (executionChecklist.setup.regime !== 'Neutral') {
      conditions.push(`régimen ${executionChecklist.setup.regime}`)
    }
    if (executionChecklist.setup.usdBias !== 'NEUTRAL') {
      conditions.push(`USD ${executionChecklist.setup.usdBias}`)
    }
    if (executionChecklist.setup.topDrivers.length > 0) {
      const topDriver = executionChecklist.setup.topDrivers[0]
      conditions.push(`driver ${topDriver.name} ${topDriver.direction}`)
    }

    entryGuidance = `Solo buscar ${direction} si: ${conditions.join(', ')}`
    
    // Añadir advertencias de convicción
    if (conviction === 'low') {
      entryGuidance += ' | ⚠️ Convicción baja: solo observación / tamaño mínimo'
    }
  }

  // Invalidation triggers (desde executionChecklist.invalidationConditions)
  const invalidationTriggers = executionChecklist.invalidationConditions.map((ic: { id: string; condition: string }) => ({
    id: ic.id,
    trigger: ic.condition,
    action: 'Cerrar posición inmediatamente y re-evaluar',
  }))

  // Añadir triggers específicos de deltas si existen
  if (deltas) {
    const hardStopDeltas = deltas.filter(d => d.severity === 'hard_stop')
    for (const delta of hardStopDeltas) {
      invalidationTriggers.push({
        id: `delta_${delta.id}`,
        trigger: delta.message,
        action: 'Cerrar posición inmediatamente - cambio crítico detectado',
      })
    }
  }

  // Cancellation conditions
  const cancellationConditions: ExecutionPlan['cancellationConditions'] = []

  // Si hay cambios de régimen en deltas
  if (signal.deltas) {
    const regimeChange = signal.deltas.find(d => d.id === 'regime_change')
    if (regimeChange) {
      cancellationConditions.push({
        id: 'regime_change',
        condition: 'Régimen cambia significativamente',
        action: 'Cancelar setup y re-evaluar con nuevo régimen',
      })
    }
  }

  // Si hay múltiples warnings
  if (riskFlags.filter(f => f.severity === 'high' || f.severity === 'medium').length > 2) {
    cancellationConditions.push({
      id: 'multiple_warnings',
      condition: 'Múltiples flags de riesgo activos',
      action: 'Cancelar setup hasta que se resuelvan los warnings',
    })
  }

  return {
    entryGuidance,
    invalidationTriggers,
    cancellationConditions,
  }
}

/**
 * Check cooldown state from previous snapshots
 * 
 * Si hubo hard_stop reciente, activar cooldown para prevenir revenge trading.
 * Cooldown dura hasta que:
 * - Pase X tiempo (ej: 1 hora)
 * - O se cumplan condiciones de revalidación (nuevo snapshot sin hard_stop)
 */
function checkCooldownState(
  deltas?: SnapshotDelta[]
): CooldownState | undefined {
  if (!deltas || deltas.length === 0) {
    return undefined
  }

  // Buscar hard_stop en deltas
  const hardStop = deltas.find(d => d.severity === 'hard_stop')
  if (!hardStop) {
    return undefined
  }

  // Cooldown activo por 1 hora después de hard_stop
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()

  let reason = 'Hard stop detectado'
  if (hardStop.context?.action) {
    reason += `: ${hardStop.context.action}`
  }

  const revalidationConditions: string[] = [
    'Esperar nuevo snapshot sin hard_stop',
    'Verificar que condiciones de bloqueo se hayan resuelto',
  ]

  // Condiciones específicas según el tipo de hard_stop
  if (hardStop.id === 'regime_change') {
    revalidationConditions.push('Confirmar nuevo régimen estable')
  } else if (hardStop.id === 'top_driver_direction_change') {
    revalidationConditions.push('Verificar que nuevo driver #1 esté alineado')
  } else if (hardStop.id === 'anchor_correlation_lost') {
    revalidationConditions.push('Esperar nueva correlación ancla estable')
  }

  return {
    isActive: true,
    reason,
    expiresAt,
    revalidationConditions,
  }
}

/**
 * Generate execution checklist from snapshot and signal
 */
function generateExecutionChecklist(
  snapshot: MacroSnapshot,
  signal: Omit<MacroSignal, 'executionChecklist' | 'timeToNextEvent' | 'positionSizing' | 'executionPlan' | 'cooldownState'>
): ExecutionChecklist {
  const setup = {
    regime: snapshot.regime?.overall ?? 'Neutral',
    usdBias: snapshot.usdBias ?? 'NEUTRAL',
    topDrivers: snapshot.drivers
      .filter(d => Math.abs(d.weight ?? 0) > 0.1)
      .sort((a, b) => Math.abs(b.weight ?? 0) - Math.abs(a.weight ?? 0))
      .slice(0, 2)
      .map(d => ({
        name: d.name || d.key,
        direction: d.direction,
        weight: d.weight ?? 0,
      })),
    anchorCorrelation: (() => {
      const correlations = snapshot.correlations
      if (!correlations || correlations.length === 0) return undefined
      
      const strongCorr = correlations
        .map(c => ({
          symbol: c.symbol,
          corr: c.corr12m ?? c.corr6m ?? c.corr3m ?? 0,
        }))
        .filter(c => Math.abs(c.corr) > 0.7)
        .sort((a, b) => Math.abs(b.corr) - Math.abs(a.corr))[0]

      return strongCorr ? { symbol: strongCorr.symbol, corr: strongCorr.corr } : undefined
    })(),
  }

  const blockers: ExecutionChecklist['blockers'] = []
  
  if (signal.action === 'NO_TRADE') {
    if (signal.actionReason?.includes('Evento')) {
      blockers.push({
        id: 'event_blocker',
        message: signal.actionReason,
        conditionToResolve: 'Esperar a que pase el evento de alta importancia',
      })
    }
    if (signal.actionReason?.includes('Inconsistencias')) {
      blockers.push({
        id: 'invariant_blocker',
        message: signal.actionReason,
        conditionToResolve: 'Re-evaluar cuando invariants vuelvan a OK',
      })
    }
  }

  const invalidationConditions: ExecutionChecklist['invalidationConditions'] = [
    {
      id: 'score_cross_zero',
      condition: 'Si score cruza 0 (cambio de dirección)',
    },
    {
      id: 'confidence_drop',
      condition: `Si confidence cae < 0.5 (actual: ${(signal.confidence * 100).toFixed(0)}%)`,
    },
  ]

  // Add driver invalidation if we have top drivers
  if (setup.topDrivers.length > 0) {
    invalidationConditions.push({
      id: 'driver_direction_change',
      condition: `Si driver #1 (${setup.topDrivers[0].name}) cambia dirección`,
    })
  }

  return {
    setup,
    blockers,
    invalidationConditions,
  }
}

/**
 * Generate macro signal from snapshot
 * 
 * Lógica de acción prioritaria:
 * 1. Si hay evento alta importancia < 4h → NO_TRADE (prioritario)
 * 2. Si hay errores de invariants → NO_TRADE (prioritario)
 * 3. Si no hay bloqueos → LONG/SHORT/NEUTRAL según biasDirection
 */
export function macroSignalEngine(
  snapshot: MacroSnapshot,
  invariants: InvariantResult[] = []
): MacroSignal {
  const score = snapshot.metrics?.score ?? snapshot.score ?? 0
  // Derive confidence from score magnitude (since confidence is not in metrics)
  const absScore = Math.abs(score)
  const derivedConfidence = Math.min(absScore / 100, 1) // Normalize to 0-1

  const biasDirection = calculateBiasDirection(score)
  const riskFlags = extractRiskFlags(snapshot, invariants)
  
  // Check for NO_TRADE conditions (prioritarios)
  const { noTradeWindow, reason: noTradeReason } = checkNoTradeWindow(snapshot, 4)
  const hasInvariantErrors = invariants.some(i => i.level === 'FAIL')
  const hasNearEvents = noTradeWindow
  
  // Determine action (NO_TRADE tiene precedencia)
  let action: SignalAction
  let actionReason: string | undefined
  
  if (noTradeWindow) {
    action = 'NO_TRADE'
    actionReason = noTradeReason || 'Evento de alta importancia en < 4h'
  } else if (hasInvariantErrors) {
    action = 'NO_TRADE'
    actionReason = 'Inconsistencias críticas en el snapshot'
  } else {
    // Normal action based on bias
    action = biasDirection === 'long' ? 'LONG' : biasDirection === 'short' ? 'SHORT' : 'NEUTRAL'
  }

  const conviction = calculateConviction(score, derivedConfidence, hasInvariantErrors, hasNearEvents)
  const playbookNotes = generatePlaybookNotes(snapshot)
  const { timeToNextEvent } = checkNoTradeWindow(snapshot, 4)

  // Generate base signal (without checklist, sizing, plan, cooldown)
  const baseSignal: Omit<MacroSignal, 'executionChecklist' | 'timeToNextEvent' | 'positionSizing' | 'executionPlan' | 'cooldownState' | 'deltas'> = {
    action,
    actionReason,
    biasDirection,
    conviction,
    riskFlags,
    playbookNotes,
    noTradeWindow, // Deprecated: usar action === 'NO_TRADE'
    noTradeReason, // Deprecated: usar actionReason
    score,
    confidence: derivedConfidence,
  }

  // Generate execution checklist
  const executionChecklist = generateExecutionChecklist(snapshot, baseSignal)

  // Generate position sizing (Fase 3.3)
  const positionSizing = calculatePositionSizing(action, conviction, riskFlags)

  // Generate execution plan (Fase 3.3) - necesita executionChecklist
  const executionPlan = generateExecutionPlan(snapshot, baseSignal, executionChecklist)

  // Note: cooldownState se calcula después cuando se añaden deltas
  // (se hace en el caller que tiene acceso a previousSnapshot)

  return {
    ...baseSignal,
    executionChecklist,
    positionSizing,
    executionPlan,
    timeToNextEvent,
  }
}

