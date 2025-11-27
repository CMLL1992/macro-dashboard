import getBiasState, { type BiasState } from './bias'
import getCorrelationState, { type CorrelationState } from './correlations'
import { logger } from '@/lib/obs/logger'

export type AssetBias = 'LONG' | 'SHORT' | 'NEUTRAL'

export interface TradingAssetPlan {
  asset: string // "EURUSD", "XAUUSD", etc.
  bias: AssetBias
  confidence: 'low' | 'medium' | 'high'
  environment: 'trend' | 'range'
  reasons: string[] // human-readable bullet points
}

export interface TradingPlaybook {
  regime: string // overall regime
  usdDirection: string // from getBiasState().regime.usd_direction
  quad: string
  liquidity: string
  credit: string
  risk: string
  assets: TradingAssetPlan[]
  updatedAt: Date
}

type AssetCorrelationConfig = {
  correlationSign?: number // -1 for inverse, +1 for direct (optional when base is true)
  base?: boolean // true for DXY itself
}

const ASSET_CORRELATION_CONFIG: Record<string, AssetCorrelationConfig> = {
  EURUSD: { correlationSign: -1 },
  GBPUSD: { correlationSign: -1 },
  XAUUSD: { correlationSign: -1 },
  USDJPY: { correlationSign: +1 },
  DXY: { base: true },
}

const SUPPORTED_ASSETS = ['EURUSD', 'GBPUSD', 'XAUUSD', 'USDJPY', 'DXY'] as const

function normalizeAssetSymbol(symbol: string): string {
  return symbol.replace('/', '').toUpperCase()
}

function getCorrelationForAsset(
  asset: string,
  correlationState: CorrelationState
): { corr12m: number | null; corr3m: number | null } {
  const normalized = normalizeAssetSymbol(asset)
  
  // For DXY, return null (it's the base)
  if (normalized === 'DXY') {
    return { corr12m: null, corr3m: null }
  }

  // Find correlation shift for this asset
  const shift = correlationState.shifts.find(
    (s) => normalizeAssetSymbol(s.symbol) === normalized && s.benchmark === 'DXY'
  )

  if (shift) {
    return { corr12m: shift.corr12m, corr3m: shift.corr3m }
  }

  return { corr12m: null, corr3m: null }
}

function getCorrelationFromTacticalRows(
  asset: string,
  biasState: BiasState
): { corr12m: number | null; corr3m: number | null } {
  const normalized = normalizeAssetSymbol(asset)
  
  const tacticalRow = biasState.tableTactical.find((row) => {
    const rowSymbol = normalizeAssetSymbol(row.pair ?? row.symbol ?? '')
    return rowSymbol === normalized
  })

  if (tacticalRow) {
    return {
      corr12m: tacticalRow.corr12m ?? null,
      corr3m: tacticalRow.corr3m ?? null,
    }
  }

  return { corr12m: null, corr3m: null }
}

function determineBias(
  asset: string,
  usdDirection: string,
  regime: string,
  correlation: { corr12m: number | null; corr3m: number | null },
  config: AssetCorrelationConfig,
  biasState: BiasState
): AssetBias {
  const normalized = normalizeAssetSymbol(asset)

  // Special case: DXY
  if (normalized === 'DXY') {
    if (usdDirection === 'Bullish' || usdDirection === 'Fuerte') return 'LONG'
    if (usdDirection === 'Bearish' || usdDirection === 'Débil') return 'SHORT'
    return 'NEUTRAL'
  }

  // Use 12m correlation if available, otherwise 3m
  const corr = correlation.corr12m ?? correlation.corr3m ?? null
  const corrAbs = corr != null ? Math.abs(corr) : 0

  // Map usdDirection to consistent format
  const usdWeak = usdDirection === 'Bearish' || usdDirection === 'Débil'
  const usdStrong = usdDirection === 'Bullish' || usdDirection === 'Fuerte'

  // Special case: XAUUSD (Gold)
  if (normalized === 'XAUUSD') {
    // Gold typically benefits from USD weakness and risk-off
    if (usdWeak && regime === 'Risk OFF') {
      return 'LONG'
    }
    if (usdStrong && regime === 'Risk ON') {
      return 'SHORT'
    }
    // Mixed signals → neutral
    return 'NEUTRAL'
  }

  // Special case: USDJPY
  if (normalized === 'USDJPY') {
    // USDJPY moves with USD strength (positive correlation)
    // If USD is weak, JPY might strengthen → SHORT USDJPY
    // If USD is strong, JPY might weaken → LONG USDJPY
    if (usdStrong) return 'LONG'
    if (usdWeak) return 'SHORT'
    return 'NEUTRAL'
  }

  // For EURUSD, GBPUSD (negative correlation with DXY)
  if (config.correlationSign === -1) {
    // Negative correlation: when USD weak, asset strong → LONG
    // When USD strong, asset weak → SHORT
    if (usdWeak && corrAbs >= 0.3) return 'LONG'
    if (usdStrong && corrAbs >= 0.3) return 'SHORT'
    // Weak correlation or neutral USD → neutral
    if (corrAbs < 0.3) return 'NEUTRAL'
    return 'NEUTRAL'
  }

  // Default: neutral if we can't determine
  return 'NEUTRAL'
}

export function determineConfidence(
  asset: string,
  correlation: { corr12m: number | null; corr3m: number | null },
  bias: AssetBias,
  usdDirection: string,
  regime: string
): 'low' | 'medium' | 'high' {
  if (bias === 'NEUTRAL') return 'low'

  const corr12m = correlation.corr12m ?? null
  const corr3m = correlation.corr3m ?? null
  const corrAbs = Math.abs(corr12m ?? corr3m ?? 0)

  // High confidence: strong correlation + clear regime
  if (corrAbs >= 0.6 && (usdDirection !== 'Neutral' || regime !== 'Neutral')) {
    return 'high'
  }

  // Medium confidence: moderate correlation or clear regime
  if (corrAbs >= 0.4 || (usdDirection !== 'Neutral' && regime !== 'Neutral')) {
    return 'medium'
  }

  // Low confidence: weak signals
  return 'low'
}

export function determineEnvironment(
  asset: string,
  bias: AssetBias,
  correlation: { corr12m: number | null; corr3m: number | null },
  confidence: 'low' | 'medium' | 'high',
  regime: string,
  usdDirection: string
): 'trend' | 'range' {
  // If bias is NEUTRAL, it's range trading
  if (bias === 'NEUTRAL') return 'range'

  // If confidence is low, likely range
  if (confidence === 'low') return 'range'

  // Check correlation alignment (12m vs 3m)
  const corr12m = correlation.corr12m ?? null
  const corr3m = correlation.corr3m ?? null

  // If correlations diverge significantly, range
  if (corr12m != null && corr3m != null) {
    const divergence = Math.abs(corr12m - corr3m)
    if (divergence > 0.3) return 'range' // Significant divergence
  }

  // If regime is neutral and USD is neutral, range
  if (regime === 'Neutral' && usdDirection === 'Neutral') return 'range'

  // Otherwise, trend
  return 'trend'
}

function generateReasons(
  asset: string,
  bias: AssetBias,
  usdDirection: string,
  regime: string,
  quad: string,
  correlation: { corr12m: number | null; corr3m: number | null },
  biasState: BiasState
): string[] {
  const reasons: string[] = []
  const normalized = normalizeAssetSymbol(asset)

  // USD direction reason
  if (usdDirection === 'Bullish' || usdDirection === 'Fuerte') {
    reasons.push('USD fuerte según régimen macro')
  } else if (usdDirection === 'Bearish' || usdDirection === 'Débil') {
    reasons.push('USD débil según régimen macro')
  } else {
    reasons.push('USD neutral según régimen macro')
  }

  // Correlation reason
  const corr12m = correlation.corr12m
  const corr3m = correlation.corr3m

  if (corr12m != null) {
    const corrAbs = Math.abs(corr12m)
    const corrType = corr12m < 0 ? 'negativa' : 'positiva'
    if (corrAbs >= 0.6) {
      reasons.push(`Correlación 12m con DXY fuertemente ${corrType} (${corr12m.toFixed(2)})`)
    } else if (corrAbs >= 0.3) {
      reasons.push(`Correlación 12m con DXY ${corrType} moderada (${corr12m.toFixed(2)})`)
    }
  }

  if (corr3m != null && corr12m != null) {
    const divergence = Math.abs(corr12m - corr3m)
    if (divergence > 0.3) {
      reasons.push(`Divergencia entre correlaciones 12m y 3m (${divergence.toFixed(2)})`)
    } else if (divergence < 0.1) {
      reasons.push('Correlaciones 12m y 3m alineadas')
    }
  }

  // Regime reason
  if (regime === 'Risk ON') {
    reasons.push('Régimen Risk ON favorece activos de riesgo')
  } else if (regime === 'Risk OFF') {
    reasons.push('Régimen Risk OFF favorece activos defensivos')
  }

  // Quad reason
  if (quad === 'Goldilocks') {
    reasons.push('Cuadrante Goldilocks (inflación baja, crecimiento positivo)')
  } else if (quad === 'Stagflation') {
    reasons.push('Cuadrante Stagflation (inflación alta, crecimiento negativo)')
  } else if (quad === 'Recesivo') {
    reasons.push('Cuadrante Recesivo (inflación baja, crecimiento negativo)')
  } else if (quad === 'Expansivo' || quad === 'expansion') {
    reasons.push('Cuadrante Expansivo (inflación alta, crecimiento positivo)')
  }

  // Special asset-specific reasons
  if (normalized === 'XAUUSD') {
    // Get inflation indicators
    const cpi = biasState.table.find((row) => row.key === 'CPIAUCSL' || row.originalKey === 'cpi_yoy')
    if (cpi?.value != null && cpi.value > 2.5) {
      reasons.push(`Inflación elevada (CPI: ${cpi.value.toFixed(2)}%) favorece oro`)
    }
  }

  // Growth reason
  const gdp = biasState.table.find((row) => row.key === 'GDPC1' || row.originalKey === 'gdp_yoy')
  if (gdp?.trend === 'Empeora') {
    reasons.push('Crecimiento desacelerando')
  } else if (gdp?.trend === 'Mejora') {
    reasons.push('Crecimiento acelerando')
  }

  return reasons
}

export async function getTradingPlaybook(): Promise<TradingPlaybook> {
  try {
    const [biasState, correlationState] = await Promise.all([
      getBiasState(),
      getCorrelationState(),
    ])

    const assets: TradingAssetPlan[] = []

    for (const asset of SUPPORTED_ASSETS) {
      const config = ASSET_CORRELATION_CONFIG[asset]
      if (!config) continue

      // Get correlations from both sources
      const corrFromState = getCorrelationForAsset(asset, correlationState)
      const corrFromTactical = getCorrelationFromTacticalRows(asset, biasState)
      
      // Prefer correlationState, fallback to tactical
      const correlation = {
        corr12m: corrFromState.corr12m ?? corrFromTactical.corr12m,
        corr3m: corrFromState.corr3m ?? corrFromTactical.corr3m,
      }

      const bias = determineBias(
        asset,
        biasState.regime.usd_direction,
        biasState.regime.overall,
        correlation,
        config,
        biasState
      )

      const confidence = determineConfidence(
        asset,
        correlation,
        bias,
        biasState.regime.usd_direction,
        biasState.regime.overall
      )

      const environment = determineEnvironment(
        asset,
        bias,
        correlation,
        confidence,
        biasState.regime.overall,
        biasState.regime.usd_direction
      )

      const reasons = generateReasons(
        asset,
        bias,
        biasState.regime.usd_direction,
        biasState.regime.overall,
        biasState.regime.quad,
        correlation,
        biasState
      )

      assets.push({
        asset,
        bias,
        confidence,
        environment,
        reasons,
      })
    }

    return {
      regime: biasState.regime.overall,
      usdDirection: biasState.regime.usd_direction,
      quad: biasState.regime.quad,
      liquidity: biasState.regime.liquidity,
      credit: biasState.regime.credit,
      risk: biasState.regime.risk,
      assets,
      updatedAt: biasState.updatedAt,
    }
  } catch (error) {
    logger.error('[macro-engine/trading-playbook] Failed to build TradingPlaybook', {
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

export default getTradingPlaybook

