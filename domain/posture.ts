export type Posture = 'Dovish' | 'Neutral' | 'Hawkish'

export type WeightedIndicator = {
  key: string
  label: string
  value: number | null
  posture: Posture
  numeric: number // +1, 0, -1
  weight: number
}

// Pesos por serie FRED (IDs en mayúsculas)
import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'

const DEFAULT_WEIGHTS: Record<string, number> = {
  T10Y2Y: 0.08, T10Y3M: 0.07, T5YIE: 0.05, NFCI: 0.06,
  GDPC1: 0.08, RSAFS: 0.04, INDPRO: 0.03, DGEXFI: 0.03, TTLCONS: 0.03,
  PAYEMS: 0.08, UNRATE: 0.06, ICSA: 0.03, PCEPI: 0.06, PCEPILFE: 0.06,
  CPIAUCSL: 0.04, CPILFESL: 0.03, PPIACO: 0.03, UMCSENT: 0.04,
  NFIBSL: 0.02, HOUST: 0.03, NAHB: 0.03, TCU: 0.02,
  // Nuevos pesos: PMI manufacturero y JOLTS aperturas
  USPMI: 0.04,
  JTSJOL: 0.04,
}

const WeightsSchema = z.object({
  threshold: z.number().min(0).max(1),
  weights: z.record(z.string(), z.number().nonnegative()),
})

function loadWeightsConfig() {
  try {
    const p = path.join(process.cwd(), 'config', 'weights.json')
    const txt = fs.readFileSync(p, 'utf8')
    const json = JSON.parse(txt)
    const parsed = WeightsSchema.safeParse(json)
    if (!parsed.success) return { threshold: 0.3, weights: DEFAULT_WEIGHTS }
    return parsed.data
  } catch {
    return { threshold: 0.3, weights: DEFAULT_WEIGHTS }
  }
}

const CONFIG = loadWeightsConfig()
export const WEIGHTS: Record<string, number> = CONFIG.weights
export const DEFAULT_THRESHOLD = CONFIG.threshold

// Mapeo de keys internas (de lib/fred.ts) a IDs/ familias para reglas/pesos
const KEY_TO_SERIES: Record<string, string> = {
  t10y2y: 'T10Y2Y',
  t10y3m: 'T10Y3M',
  breakeven5y: 'T5YIE',
  nfci: 'NFCI',
  twex: 'DTWEXBGS',
  gdp_qoq: 'GDPC1',
  gdp_yoy: 'GDPC1',
  retail_yoy: 'RSAFS',
  indpro_yoy: 'INDPRO',
  caputil: 'TCU',
  durables_yoy: 'DGEXFI',
  construction_yoy: 'TTLCONS',
  payems_delta: 'PAYEMS',
  unrate: 'UNRATE',
  claims_4w: 'ICSA',
  pce_yoy: 'PCEPI',
  corepce_yoy: 'PCEPILFE',
  cpi_yoy: 'CPIAUCSL',
  corecpi_yoy: 'CPILFESL',
  ppi_yoy: 'PPIACO',
  fedfunds: 'FEDFUNDS',
  vix: 'VIXCLS',
  umich: 'UMCSENT',
  nfib: 'NFIBSL',
  pmi_mfg: 'USPMI',
  pmi_svcs: 'PMI_SVCS',
  housing_yoy: 'HOUST',
  nahb: 'NAHB',
  consumer_confidence: 'CONCCONF',
  jolts_openings: 'JTSJOL',
}

export function postureOf(key: string, value: number | null): Posture {
  if (value == null || Number.isNaN(value)) return 'Neutral'
  const k = (KEY_TO_SERIES[key] ?? key).toUpperCase()

  // Curvas (inversión señal dovish)
  if (k === 'T10Y2Y' || k === 'T10Y3M') {
    if (value < 0) return 'Dovish'
    if (value <= 1) return 'Neutral'
    return 'Hawkish'
  }

  // Breakeven 5Y (inflación implícita)
  if (k === 'T5YIE') {
    if (value < 2) return 'Dovish'
    if (value <= 3) return 'Neutral'
    return 'Hawkish'
  }

  // Condiciones financieras NFCI
  if (k === 'NFCI') {
    if (value > 0.3) return 'Dovish'
    if (value >= -0.3) return 'Neutral'
    return 'Hawkish'
  }

  // Crecimiento (YoY): GDP, Retail, INDPRO, Durables, Construcción
  if (k === 'GDPC1' || k === 'RSAFS' || k === 'INDPRO' || k === 'DGEXFI' || k === 'TTLCONS' || key.endsWith('_YOY')) {
    const thrLow = k === 'GDPC1' ? 1 : 0
    const thrHigh = k === 'GDPC1' ? 2.5 : 3
    if (value < thrLow) return 'Dovish'
    if (value <= thrHigh) return 'Neutral'
    return 'Hawkish'
  }

  // Capacidad usada
  if (k === 'TCU') {
    if (value < 77) return 'Dovish'
    if (value <= 80) return 'Neutral'
    return 'Hawkish'
  }

  // Empleo
  if (k === 'PAYEMS') {
    // PAYEMS Δ en miles
    if (value < 100) return 'Dovish'
    if (value <= 250) return 'Neutral'
    return 'Hawkish'
  }
  if (k === 'UNRATE') {
    if (value > 4.5) return 'Dovish'
    if (value >= 4) return 'Neutral'
    return 'Hawkish'
  }
  if (k === 'ICSA') {
    if (value > 300_000) return 'Dovish'
    if (value >= 200_000) return 'Neutral'
    return 'Hawkish'
  }

  // LEI YoY (USSLIND)
  if (k === 'USSLIND') {
    if (value < 0) return 'Dovish'
    if (value <= 2) return 'Neutral'
    return 'Hawkish'
  }

  // PMI manufacturero ISM (USPMI): <50 contracción, >52 expansión fuerte
  if (k === 'USPMI') {
    if (value < 50) return 'Dovish'
    if (value <= 52) return 'Neutral'
    return 'Hawkish'
  }

  // U6 Underemployment rate
  if (k === 'U6RATE') {
    if (value > 8.5) return 'Dovish'
    if (value >= 7.0) return 'Neutral'
    return 'Hawkish'
  }

  // Precios
  if (k === 'PCEPI' || k === 'PCEPILFE' || k === 'CPIAUCSL' || k === 'CPILFESL') {
    if (value < 2.5) return 'Dovish'
    if (value <= 3) return 'Neutral'
    return 'Hawkish'
  }
  if (k === 'PPIACO') {
    if (value < 1) return 'Dovish'
    if (value <= 3) return 'Neutral'
    return 'Hawkish'
  }

  // Política Monetaria
  if (k === 'FEDFUNDS') {
    // Fed Funds Rate: < 4% dovish, 4-5% neutral, > 5% hawkish
    if (value < 4) return 'Dovish'
    if (value <= 5) return 'Neutral'
    return 'Hawkish'
  }

  // VIX (modulador de riesgo, no driver principal)
  if (k === 'VIXCLS' || k === 'VIX') {
    // VIX alto (>25) = riesgo, bajo (<15) = calma
    if (value > 25) return 'Dovish' // Alto riesgo = dovish para activos de riesgo
    if (value < 15) return 'Hawkish' // Bajo riesgo = hawkish (condiciones favorables)
    return 'Neutral'
  }

  // Resto
  return 'Neutral'
}

export const toNumeric = (p: Posture): number => (p === 'Dovish' ? 1 : p === 'Hawkish' ? -1 : 0)

export function weightedScore(items: WeightedIndicator[]) {
  const valid = items.filter(i => i.value !== null && WEIGHTS[i.key])
  const sumW = valid.reduce((a, b) => a + (WEIGHTS[b.key] || 0), 0)
  if (sumW === 0) return { score: 0, count: 0, usedWeights: 0 }
  const score = valid.reduce((a, b) => a + toNumeric(b.posture) * (WEIGHTS[b.key] || 0), 0) / sumW
  return { score, count: valid.length, usedWeights: sumW }
}

export function diagnose(score: number, threshold = DEFAULT_THRESHOLD) {
  if (score >= threshold) return 'RISK ON'
  if (score <= -threshold) return 'RISK OFF'
  return 'Neutral'
}

export const _internal = { KEY_TO_SERIES }


