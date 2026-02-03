/**
 * Quality invariants and helpers
 * 
 * Nota: Las validaciones se aplican sobre los 16 indicadores curados de alto impacto.
 * Solo se evalúan indicadores reconocidos globalmente como determinantes del mercado.
 */

import type { MacroBias } from '@/lib/bias/types'

export type QualityLevel = 'PASS' | 'WARN' | 'FAIL'

export interface InvariantResult {
  name: string
  level: QualityLevel
  message: string
}

export interface QualitySummary {
  pass: number
  warn: number
  fail: number
  results: InvariantResult[]
}

export function bucketConfidence(value: number): 'Baja' | 'Media' | 'Alta' {
  if (value >= 0.7) return 'Alta'
  if (value >= 0.5) return 'Media'
  return 'Baja'
}

export function deriveAction(direction: 'long' | 'short' | 'neutral', confidence: number): 'Rango/táctico' | 'Buscar compras' | 'Buscar ventas' {
  if (confidence < 0.6 || direction === 'neutral') return 'Rango/táctico'
  return direction === 'long' ? 'Buscar compras' : 'Buscar ventas'
}

export function usdLogicInvariant(bias: MacroBias, isXxxUsdPair: boolean): InvariantResult {
  // Find usd_bias driver
  const usdDriver = bias.drivers.find((d: any) => d.key === 'usd_bias')
  if (!usdDriver) {
    return { name: 'usd_bias_present', level: 'WARN', message: 'Driver USD no disponible' }
  }

  const v = usdDriver.value // [-1,1] (positivo = USD fuerte favorece long USD)
  if (!isXxxUsdPair) {
    return { name: 'usd_bias_fx_pair', level: 'PASS', message: 'No FX XXXUSD, sin regla' }
  }

  const expected = v > 0.2 ? 'short' : v < -0.2 ? 'long' : 'neutral'
  const ok = expected === 'neutral' || expected === bias.direction || bias.confidence < 0.6
  return {
    name: 'usd_bias_fx_rule',
    level: ok ? 'PASS' : 'WARN',
    message: `USD driver=${v.toFixed(2)} → esperado ${expected}, actual ${bias.direction}`,
  }
}

export function coverageInvariant(bias: MacroBias): InvariantResult[] {
  const results: InvariantResult[] = []
  const used = bias.meta?.drivers_used ?? bias.drivers.filter((d) => d.weight > 0).length
  const total = bias.meta?.drivers_total ?? bias.drivers.length
  if (used < 3) {
    const okDir = bias.direction === 'neutral' && bias.confidence <= 0.5
    results.push({ name: 'min_coverage', level: okDir ? 'PASS' : 'FAIL', message: `Cobertura insuficiente ${used}/${total}` })
  } else {
    results.push({ name: 'min_coverage', level: 'PASS', message: `Cobertura suficiente ${used}/${total}` })
  }
  return results
}

export function summarize(results: InvariantResult[]): QualitySummary {
  const pass = results.filter((r) => r.level === 'PASS').length
  const warn = results.filter((r) => r.level === 'WARN').length
  const fail = results.filter((r) => r.level === 'FAIL').length
  return { pass, warn, fail, results }
}

/**
 * Compute overall quality for a symbol row (tendencia/acción/label) from bias
 */
export function rowLabelsFromBias(bias: MacroBias) {
  const tendencia = bias.direction === 'long' ? 'Alcista' : bias.direction === 'short' ? 'Bajista' : 'Neutral'
  const accion = deriveAction(bias.direction, bias.confidence)
  const confianza = bucketConfidence(bias.confidence)
  return { tendencia, accion, confianza }
}

// --- Extended invariants ---

export interface Snapshot {
  symbol?: string
  bias?: MacroBias
  mapRows?: Array<{ symbol: string; tendencia: string; accion: string; confianza: string }>
  correlations?: Record<string, number> // keys: 'EURUSD_DXY_12m', 'XAUUSD_DXY_12m', 'SPX_RISK_12m', etc.
  nowTs?: string
  driversMeta?: Array<{ key: string; lastUpdated?: string; freq?: 'D'|'M'|'A'; stale?: boolean }>
  outliers?: number
}

export function fxCorrelationSigns(snapshot: Snapshot): InvariantResult[] {
  const res: InvariantResult[] = []
  const c = snapshot.correlations || {}
  if (c['EURUSD_DXY_12m'] != null && c['EURUSD_DXY_12m'] > 0) {
    res.push({ name: 'corr_eurusd_dxy', level: 'WARN', message: `EURUSD–DXY corr 12m = ${c['EURUSD_DXY_12m'].toFixed(2)} (>0)` })
  } else {
    res.push({ name: 'corr_eurusd_dxy', level: 'PASS', message: 'Signo esperado (<=0)' })
  }
  if (c['XAUUSD_DXY_12m'] != null && c['XAUUSD_DXY_12m'] > 0) {
    res.push({ name: 'corr_xauusd_dxy', level: 'WARN', message: `XAUUSD–DXY corr 12m = ${c['XAUUSD_DXY_12m'].toFixed(2)} (>0)` })
  } else {
    res.push({ name: 'corr_xauusd_dxy', level: 'PASS', message: 'Signo esperado (<=0)' })
  }
  if (c['SPX_RISK_12m'] != null && c['SPX_RISK_12m'] < 0) {
    res.push({ name: 'corr_spx_risk', level: 'WARN', message: `SPX–RISK corr 12m = ${c['SPX_RISK_12m'].toFixed(2)} (<0)` })
  } else {
    res.push({ name: 'corr_spx_risk', level: 'PASS', message: 'Signo esperado (>=0)' })
  }
  return res
}

/**
 * QA invariants for correlations
 */
export function correlationFreshnessSLA(snapshot: Snapshot): InvariantResult[] {
  const res: InvariantResult[] = []
  const correlations = snapshot.correlations || {}
  const now = snapshot.nowTs ? new Date(snapshot.nowTs).getTime() : Date.now()
  
  // Load QA rules
  let maxAgeDays = 3
  try {
    const fs = require('node:fs')
    const path = require('node:path')
    const qaPath = path.join(process.cwd(), 'config', 'qa.rules.json')
    if (fs.existsSync(qaPath)) {
      const qaRules = JSON.parse(fs.readFileSync(qaPath, 'utf8'))
      maxAgeDays = qaRules.freshness_sla_days ?? 3
    }
  } catch {}
  
  const maxAgeMs = maxAgeDays * 24 * 3600 * 1000

  for (const [key, value] of Object.entries(correlations)) {
    if (typeof value !== 'object' || !value || !('asof' in value)) continue
    const asof = (value as any).asof
    if (!asof) continue
    const age = now - new Date(asof).getTime()
    if (age > maxAgeMs) {
      res.push({
        name: `corr_stale_${key}`,
        level: 'WARN',
        message: `Correlación ${key} desactualizada (${Math.floor(age / 86400000)} días)`,
      })
    }
  }

  if (res.length === 0) {
    res.push({ name: 'corr_fresh_ok', level: 'PASS', message: 'Todas las correlaciones están actualizadas' })
  }

  return res
}

/**
 * QA: Minimum observations for correlations
 */
export function correlationMinObservations(snapshot: Snapshot): InvariantResult[] {
  const res: InvariantResult[] = []
  const correlations = snapshot.correlations || {}

  // Load QA rules
  let minObs12m = 150
  let minObs3m = 40
  try {
    const fs = require('node:fs')
    const path = require('node:path')
    const qaPath = path.join(process.cwd(), 'config', 'qa.rules.json')
    if (fs.existsSync(qaPath)) {
      const qaRules = JSON.parse(fs.readFileSync(qaPath, 'utf8'))
      minObs12m = qaRules.min_obs?.correlation_12m ?? 150
      minObs3m = qaRules.min_obs?.correlation_3m ?? 40
    }
  } catch {}

  for (const [key, value] of Object.entries(correlations)) {
    if (typeof value !== 'object' || !value || !('n_obs' in value)) continue
    const n_obs = (value as any).n_obs
    const window = key.includes('12m') ? '12m' : key.includes('3m') ? '3m' : null
    if (!window) continue

    const minObs = window === '12m' ? minObs12m : minObs3m
    if (n_obs < minObs) {
      res.push({
        name: `corr_min_obs_${key}`,
        level: 'WARN',
        message: `Correlación ${key} tiene ${n_obs} observaciones (mínimo: ${minObs})`,
      })
    }
  }

  if (res.length === 0) {
    res.push({ name: 'corr_obs_ok', level: 'PASS', message: 'Todas las correlaciones tienen observaciones suficientes' })
  }

  return res
}

/**
 * QA: FX correlation sign consistency
 * Validates expected signs for FX pairs vs DXY
 */
export function correlationSignConsistency(snapshot: Snapshot): InvariantResult[] {
  const res: InvariantResult[] = []
  const correlations = snapshot.correlations || {}

  // Load QA rules
  let usdQuoteThreshold = 0.30
  let usdBaseThreshold = -0.30
  try {
    const fs = require('node:fs')
    const path = require('node:path')
    const qaPath = path.join(process.cwd(), 'config', 'qa.rules.json')
    if (fs.existsSync(qaPath)) {
      const qaRules = JSON.parse(fs.readFileSync(qaPath, 'utf8'))
      usdQuoteThreshold = qaRules.warnings?.fx_sign?.usd_quote_positive_threshold ?? 0.30
      usdBaseThreshold = qaRules.warnings?.fx_sign?.usd_base_negative_threshold ?? -0.30
    }
  } catch {}

  // Pairs with USD as quote (should be negative with DXY)
  const negativePairs = ['EURUSD', 'GBPUSD', 'AUDUSD', 'XAUUSD']
  for (const pair of negativePairs) {
    const key = `${pair}_DXY_12m`
    const corr = correlations[key]
    if (corr != null && typeof corr === 'object' && 'value' in corr) {
      const value = (corr as any).value
      if (value != null && value > usdQuoteThreshold) {
        res.push({
          name: `corr_sign_${pair.toLowerCase()}`,
          level: 'WARN',
          message: `${pair}–DXY corr 12m = ${value.toFixed(2)} (>0, esperado negativo). Posible cambio de régimen.`,
        })
      }
    }
  }

  // Pairs with USD as base (should be positive with DXY)
  const positivePairs = ['USDJPY', 'USDCAD']
  for (const pair of positivePairs) {
    const key = `${pair}_DXY_12m`
    const corr = correlations[key]
    if (corr != null && typeof corr === 'object' && 'value' in corr) {
      const value = (corr as any).value
      if (value != null && value < usdBaseThreshold) {
        res.push({
          name: `corr_sign_${pair.toLowerCase()}`,
          level: 'WARN',
          message: `${pair}–DXY corr 12m = ${value.toFixed(2)} (<0, esperado positivo). Posible cambio de régimen.`,
        })
      }
    }
  }

  if (res.length === 0) {
    res.push({ name: 'corr_sign_ok', level: 'PASS', message: 'Signos de correlación consistentes con régimen FX' })
  }

  return res
}

export function freshnessSLA(snapshot: Snapshot): { results: InvariantResult[]; staleDrivers: string[] } {
  const res: InvariantResult[] = []
  const staleDrivers: string[] = []
  const drivers = snapshot.driversMeta || []
  const now = snapshot.nowTs ? new Date(snapshot.nowTs).getTime() : Date.now()
  const maxAgeMs: Record<'D'|'M'|'A', number> = {
    D: 72 * 3600 * 1000,
    M: 40 * 24 * 3600 * 1000,
    A: 18 * 30 * 24 * 3600 * 1000,
  }
  drivers.forEach((d) => {
    if (!d.lastUpdated || !d.freq) return
    const age = now - new Date(d.lastUpdated).getTime()
    const limit = maxAgeMs[d.freq]
    if (age > limit) {
      staleDrivers.push(d.key)
      res.push({ name: `stale_${d.key}`, level: 'WARN', message: `${d.key} desactualizado (${Math.floor(age/86400000)}d)` })
    }
  })
  if (snapshot.bias) {
    const total = snapshot.bias.meta?.drivers_total ?? snapshot.bias.drivers.length
    if (total > 0 && staleDrivers.length / total > 0.25) {
      res.push({ name: 'stale_coverage', level: 'FAIL', message: `>25% drivers desactualizados (${staleDrivers.length}/${total})` })
    }
  }
  if (res.length === 0) res.push({ name: 'fresh_ok', level: 'PASS', message: 'Frescura ok' })
  return { results: res, staleDrivers }
}

export function plausibilityGuards(snapshot: Snapshot): { results: InvariantResult[]; outliers: number } {
  // Placeholder: rely on snapshot.outliers count
  const out = snapshot.outliers || 0
  if (out > 0) {
    return { results: [{ name: 'plausibility', level: 'WARN', message: `${out} valores fuera de rango (excluidos)` }], outliers: out }
  }
  return { results: [{ name: 'plausibility', level: 'PASS', message: 'Sin outliers' }], outliers: 0 }
}


export function tableVsBias(snapshot: Snapshot): InvariantResult[] {
  const res: InvariantResult[] = []
  const rows = snapshot.mapRows || []
  const bias = snapshot.bias
  if (!bias || rows.length === 0) return [{ name: 'table_bias_skip', level: 'PASS', message: 'Sin filas/ bias' }]
  const expected = rowLabelsFromBias(bias)
  const mismatch = rows.filter((r) => r.tendencia !== expected.tendencia || r.accion !== expected.accion || r.confianza !== expected.confianza).map((r) => r.symbol)
  if (mismatch.length > 0) {
    res.push({ name: 'table_bias_mismatch', level: 'FAIL', message: `Filas no coinciden: ${mismatch.join(',')}` })
  } else {
    res.push({ name: 'table_bias_match', level: 'PASS', message: 'Mapa de sesgos consistente' })
  }
  return res
}

export function evaluateAllInvariants(snapshot: Snapshot) {
  const results: InvariantResult[] = []
  results.push(...fxCorrelationSigns(snapshot))
  results.push(...correlationFreshnessSLA(snapshot))
  results.push(...correlationMinObservations(snapshot))
  results.push(...correlationSignConsistency(snapshot))
  results.push(...tableVsBias(snapshot))
  const fresh = freshnessSLA(snapshot)
  results.push(...fresh.results)
  const pl = plausibilityGuards(snapshot)
  results.push(...pl.results)
  const sum = summarize(results)
  return { counts: { pass: sum.pass, warn: sum.warn, fail: sum.fail }, issues: results.map((r) => ({ severity: r.level, code: r.name, message: r.message })), staleDrivers: fresh.staleDrivers, outliers: pl.outliers }
}

/** Alias for evaluateAllInvariants (used by snapshot API and build-snapshot-direct) */
export function runInvariants(snapshot: Snapshot) {
  return evaluateAllInvariants(snapshot)
}

