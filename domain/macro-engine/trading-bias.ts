import getBiasState, {
  type BiasState,
  type TacticalBiasRow,
} from '@/domain/macro-engine/bias'
import getCorrelationState, {
  type CorrelationState,
  type CorrelationShift,
  type CorrelationSummary,
} from '@/domain/macro-engine/correlations'
import { logger } from '@/lib/obs/logger'

export type TradingBiasSide = 'Long' | 'Short' | 'Neutral'
export type RiskSeverity = 'Low' | 'Medium' | 'High'

export type RiskFlag = {
  id: string
  label: string
  severity: RiskSeverity
}

export type AssetTradingBias = {
  symbol: string
  side: TradingBiasSide
  conviction: 'Alta' | 'Media' | 'Baja'
  macroNarrative: string
  usdDirection: string
  quad: string
  liquidity: string
  riskRegime: string
  corrRef: string
  corr12m: number | null
  corr3m: number | null
  corrShiftRegime?: string
  riskFlags: RiskFlag[]
}

export type TradingBiasState = {
  updatedAt: Date
  regime: BiasState['regime']
  biases: AssetTradingBias[]
  metadata: {
    benchmark: string
    windows: string[]
  }
}

const clamp = (value: number, min = -1, max = 1) =>
  Math.min(max, Math.max(min, value))

const normalizeSymbol = (symbol?: string | null) =>
  symbol ? symbol.replace('/', '').toUpperCase() : ''

export function inferSideFromTacticalRow(row: TacticalBiasRow): TradingBiasSide {
  const trend = (row.trend ?? '').toLowerCase()
  const action = (row.action ?? '').toLowerCase()
  const isBullish = trend.includes('alcista') || action.includes('compr')
  const isBearish = trend.includes('bajista') || action.includes('vent')

  if (isBullish && !isBearish) return 'Long'
  if (isBearish && !isBullish) return 'Short'
  return 'Neutral'
}

export function computeConviction(params: {
  row: TacticalBiasRow
  regime: BiasState['regime']
  shift?: CorrelationShift | null
}): 'Alta' | 'Media' | 'Baja' {
  const { row, regime, shift } = params
  const rawConf = (row.confidence ?? '').toLowerCase()
  let level: 'Alta' | 'Media' | 'Baja' =
    rawConf.includes('alta') ? 'Alta' :
    rawConf.includes('baja') ? 'Baja' :
    'Media'

  let score = level === 'Alta' ? 2 : level === 'Media' ? 1 : 0
  const corr12m = typeof row.corr12m === 'number' ? row.corr12m : shift?.corr12m ?? null
  const corrAbs = corr12m != null ? Math.abs(corr12m) : 0
  const shiftRegime = shift?.regime ?? 'Weak'
  const side = inferSideFromTacticalRow(row)

  if (corrAbs > 0.6 && shiftRegime !== 'Break') {
    score += 1
  }
  if (regime.risk === 'Risk ON' && side === 'Long') {
    score += 1
  }
  if (regime.risk === 'Risk OFF' && side === 'Short') {
    score += 1
  }

  if (shiftRegime === 'Break' || shiftRegime === 'Weak') {
    score -= 1
  }
  if (regime.risk === 'Risk OFF' && side === 'Long') {
    score -= 1
  }
  if (regime.risk === 'Risk ON' && side === 'Short') {
    score -= 1
  }

  score = Math.min(2, Math.max(0, score))
  if (score >= 2) return 'Alta'
  if (score <= 0) return 'Baja'
  return 'Media'
}

export function deriveRiskFlags(params: {
  regime: BiasState['regime']
  shift?: CorrelationShift | null
  row: TacticalBiasRow
}): RiskFlag[] {
  const { regime, shift, row } = params
  const flags: RiskFlag[] = []
  const side = inferSideFromTacticalRow(row)
  const corr12m = typeof row.corr12m === 'number' ? row.corr12m : shift?.corr12m ?? null
  const corrAbs = corr12m != null ? Math.abs(corr12m) : 0
  const shiftRegime = shift?.regime ?? 'Weak'
  const conf = (row.confidence ?? '').toLowerCase()

  if (regime.risk === 'Risk OFF' && side === 'Long') {
    flags.push({
      id: 'risk_off_environment',
      label: 'Entorno de aversión al riesgo (Risk OFF)',
      severity: 'High',
    })
  }

  if (shiftRegime === 'Break') {
    flags.push({
      id: 'correlation_break',
      label: 'Ruptura reciente de correlación con el benchmark',
      severity: 'Medium',
    })
  }

  if (conf.includes('baja')) {
    flags.push({
      id: 'low_confidence',
      label: 'Confianza baja en la señal táctica',
      severity: 'Low',
    })
  }

  if (!corr12m || corrAbs < 0.3) {
    flags.push({
      id: 'weak_macro_alignment',
      label: 'Alineación macro débil o poco concluyente',
      severity: 'Medium',
    })
  }

  if (regime.liquidity === 'Low' || regime.liquidity === 'Contracting') {
    if (side === 'Long') {
      flags.push({
        id: 'liquidity_tightening',
        label: 'Liquidez ajustada, cuidado con posiciones largas',
        severity: 'Medium',
      })
    }
  }

  const usdDir = regime.usd_direction
  if (usdDir === 'Bullish' && side === 'Long' && corr12m != null && corr12m > 0.5) {
    flags.push({
      id: 'usd_counter_trend',
      label: 'USD fuerte y activo correlacionado positivamente (riesgo de ir contra el USD)',
      severity: 'Medium',
    })
  }

  return flags
}

export function buildAssetTradingBias(
  biasState: BiasState,
  correlationState: CorrelationState
): AssetTradingBias[] {
  const tacticalRows = Array.isArray(biasState.tableTactical)
    ? biasState.tableTactical
    : []

  const summaryBySymbol = new Map<string, CorrelationSummary>()
  const shiftBySymbol = new Map<string, CorrelationShift>()

  for (const s of correlationState.summary) {
    const key = normalizeSymbol(s.symbol)
    if (!key) continue
    summaryBySymbol.set(key, s)
  }

  for (const sh of correlationState.shifts) {
    const key = normalizeSymbol(sh.symbol)
    if (!key) continue
    shiftBySymbol.set(key, sh)
  }

  const biases: AssetTradingBias[] = []

  for (const row of tacticalRows) {
    const symbolNorm = normalizeSymbol((row as any).pair ?? (row as any).symbol)
    if (!symbolNorm) continue

    const summary = summaryBySymbol.get(symbolNorm) ?? null
    const shift = shiftBySymbol.get(symbolNorm) ?? null
    const side = inferSideFromTacticalRow(row)
    const conviction = computeConviction({
      row,
      regime: biasState.regime,
      shift,
    })
    const riskFlags = deriveRiskFlags({
      regime: biasState.regime,
      shift,
      row,
    })

    const corrRef = summary?.benchmark ?? shift?.benchmark ?? 'DXY'
    const corr12m =
      typeof (row as any).corr12m === 'number'
        ? (row as any).corr12m
        : shift?.corr12m ?? null
    const corr3m =
      typeof (row as any).corr3m === 'number'
        ? (row as any).corr3m
        : shift?.corr3m ?? null

    const usdDirection = biasState.regime.usd_direction
    const quad = biasState.regime.quad
    const liquidity = biasState.regime.liquidity
    const riskRegime = biasState.regime.risk
    const motive = (row as any).motive ?? (row as any).motivo ?? ''

    let macroNarrative = motive
    if (!macroNarrative || macroNarrative.trim().length === 0) {
      macroNarrative = `Sesgo ${side} (${conviction}) en ${symbolNorm}: USD ${usdDirection}, quad ${quad}, riesgo ${riskRegime}, corr. ${corrRef} ${corr12m != null ? corr12m.toFixed(2) : '—'}.`
    }

    biases.push({
      symbol: symbolNorm,
      side,
      conviction,
      macroNarrative,
      usdDirection,
      quad,
      liquidity,
      riskRegime,
      corrRef,
      corr12m,
      corr3m,
      corrShiftRegime: shift?.regime,
      riskFlags,
    })
  }

  return biases
}

export async function getTradingBiasState(): Promise<TradingBiasState> {
  try {
    const [biasState, correlationState] = await Promise.all([
      getBiasState(),
      getCorrelationState(),
    ])

    const biases = buildAssetTradingBias(biasState, correlationState)
    const updatedAt = biasState.updatedAt instanceof Date
      ? biasState.updatedAt
      : new Date()

    return {
      updatedAt,
      regime: biasState.regime,
      biases,
      metadata: {
        benchmark: correlationState.benchmark,
        windows: correlationState.windows,
      },
    }
  } catch (error) {
    logger.error('[macro-engine/trading-bias] Failed to build TradingBiasState', { error })
    throw error
  }
}

export default getTradingBiasState

