/**
 * Fetch macro inputs for bias calculation
 */

import type { BiasInputs } from './types'
import { fetchWorldBankSeries } from '@/lib/datasources/worldbank'
import { fetchIMFSeries } from '@/lib/datasources/imf'
import { getCatalogParams } from '@/lib/catalog'

/**
 * Calculate momentum from series data (3-6 month change)
 */
function calculateMomentum(
  data: Array<{ date: string; value: number | null }>,
  months: number = 3
): number {
  if (data.length < months) return 0

  const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date))
  const recent = sorted[sorted.length - 1]?.value
  const past = sorted[Math.max(0, sorted.length - months)]?.value

  if (recent == null || past == null || past === 0) return 0

  const change = (recent - past) / Math.abs(past)
  // Normalize to [-1, 1]
  return Math.max(-1, Math.min(1, change))
}

/**
 * Calculate trend from series data
 */
function calculateTrend(
  data: Array<{ date: string; value: number | null }>
): number {
  if (data.length < 2) return 0

  const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date))
  const recent = sorted[sorted.length - 1]?.value
  const older = sorted[Math.max(0, sorted.length - 3)]?.value

  if (recent == null || older == null) return 0

  if (older === 0) return recent > 0 ? 1 : recent < 0 ? -1 : 0

  const change = (recent - older) / Math.abs(older)
  return Math.max(-1, Math.min(1, change))
}

/**
 * Fetch macro inputs for bias calculation
 */
export async function fetchBiasInputs(
  region: string = 'US'
): Promise<BiasInputs> {
  // Risk regime - simplified: use GDP growth momentum as proxy
  let riskRegime: BiasInputs['risk_regime'] = {
    regime: 'NEUTRAL',
    intensity: 0.5,
    value: 0,
  }

  // USD bias - fetch from existing dashboard logic or use trade-weighted USD
  let usdBias: BiasInputs['usd_bias'] = {
    direction: 'NEUTRAL',
    value: 0,
  }

  // Inflation momentum - usar solo CPI (indicador curado)
  let inflationMomentum = 0
  try {
    const cpiParams = getCatalogParams('CPI_YOY', 'WORLD_BANK', 'USA')
    if (cpiParams) {
      const cpiSeries = await fetchWorldBankSeries(cpiParams as any)
      inflationMomentum = calculateMomentum(cpiSeries.data, 3)
    }
  } catch (error) {
    console.warn('Could not fetch CPI for inflation momentum:', error)
  }

  // Growth momentum - usar solo GDP (indicador curado)
  let growthMomentum = 0
  try {
    const gdpParams = getCatalogParams('GDP_REAL', 'WORLD_BANK', 'USA')
    if (gdpParams) {
      const gdpSeries = await fetchWorldBankSeries(gdpParams as any)
      growthMomentum = calculateMomentum(gdpSeries.data, 3)
    }
  } catch (error) {
    console.warn('Could not fetch GDP for growth momentum:', error)
  }

  // External balance - usar solo Trade Balance y Current Account (indicadores curados)
  let tradeBalanceTrend = 0
  let currentAccountTrend = 0
  try {
    const tradeBalanceParams = getCatalogParams('TRADE_BALANCE_USD', 'WORLD_BANK', 'USA')
    if (tradeBalanceParams) {
      const tradeBalanceSeries = await fetchWorldBankSeries(tradeBalanceParams as any)
      tradeBalanceTrend = calculateTrend(tradeBalanceSeries.data)
    }

    const caParams = getCatalogParams('CURRENT_ACCOUNT_USD', 'WORLD_BANK', 'USA')
    if (caParams) {
      const caSeries = await fetchWorldBankSeries(caParams as any)
      currentAccountTrend = calculateTrend(caSeries.data)
    }
  } catch (error) {
    console.warn('Could not fetch external balance data:', error)
  }

  // Determine risk regime from growth momentum
  if (growthMomentum > 0.1) {
    const intensity = Math.min(1, growthMomentum + 0.5)
    riskRegime = { regime: 'RISK_ON', intensity, value: intensity }
  } else if (growthMomentum < -0.1) {
    const intensity = Math.min(1, Math.abs(growthMomentum) + 0.5)
    riskRegime = { regime: 'RISK_OFF', intensity, value: -intensity }
  }

  // Determine USD bias (simplificado: usamos el desempeño de balanza como proxy)
  const usdValue = Math.max(-1, Math.min(1, -tradeBalanceTrend))
  let usdDirection: BiasInputs['usd_bias']['direction'] = 'NEUTRAL'
  if (usdValue > 0.2) usdDirection = 'STRONG'
  else if (usdValue < -0.2) usdDirection = 'WEAK'
  usdBias = {
    direction: usdDirection,
    value: usdValue,
  }

  const externalValue = (tradeBalanceTrend + currentAccountTrend) / 2

  return {
    risk_regime: riskRegime,
    usd_bias: usdBias,
    inflation_momentum: inflationMomentum,
    growth_momentum: growthMomentum,
    external_balance: {
      trade_balance_trend: tradeBalanceTrend,
      current_account_trend: currentAccountTrend,
      value: externalValue,
    },
    rates_context: null, // Puede ampliarse con datos de tipos reales
  }
}

