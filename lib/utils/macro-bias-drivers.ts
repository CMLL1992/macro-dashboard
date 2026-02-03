/**
 * Calculate active drivers for Macro Bias
 * Returns 3 bullets explaining why a currency is Hawkish/Neutral/Dovish
 * Based on growth, inflation, and monetary policy trends
 */

import type { CurrencyScores, CurrencyScore } from '@/domain/diagnostic'

export interface MacroBiasDriver {
  category: 'Crecimiento' | 'Inflación' | 'Tipos' | 'Empleo'
  direction: 'mejora' | 'empeora' | 'estable'
  description: string
}

/**
 * Calculate active drivers for a currency based on scores
 */
export function calculateMacroBiasDrivers(
  currency: string,
  scores: CurrencyScore | undefined,
  previousScores?: CurrencyScore | undefined
): MacroBiasDriver[] {
  if (!scores) return []

  const drivers: MacroBiasDriver[] = []

  // Growth driver
  const growthScore = scores.growthScore || 0
  const prevGrowthScore = previousScores?.growthScore || 0
  const growthDelta = growthScore - prevGrowthScore

  if (Math.abs(growthScore) > 0.1 || Math.abs(growthDelta) > 0.05) {
    let direction: 'mejora' | 'empeora' | 'estable' = 'estable'
    if (growthDelta > 0.05) direction = 'mejora'
    else if (growthDelta < -0.05) direction = 'empeora'
    else if (growthScore > 0.1) direction = 'mejora'
    else if (growthScore < -0.1) direction = 'empeora'

    drivers.push({
      category: 'Crecimiento',
      direction,
      description:
        direction === 'mejora'
          ? 'Crecimiento acelerando'
          : direction === 'empeora'
          ? 'Crecimiento desacelerando'
          : 'Crecimiento estable',
    })
  }

  // Inflation driver
  const inflationScore = scores.inflationScore || 0
  const prevInflationScore = previousScores?.inflationScore || 0
  const inflationDelta = inflationScore - prevInflationScore

  if (Math.abs(inflationScore) > 0.1 || Math.abs(inflationDelta) > 0.05) {
    let direction: 'mejora' | 'empeora' | 'estable' = 'estable'
    // For inflation: "mejora" means decreasing (good), "empeora" means increasing (bad)
    if (inflationDelta < -0.05) direction = 'mejora' // Inflation decreasing
    else if (inflationDelta > 0.05) direction = 'empeora' // Inflation increasing
    else if (inflationScore < -0.1) direction = 'mejora' // Low inflation
    else if (inflationScore > 0.1) direction = 'empeora' // High inflation

    drivers.push({
      category: 'Inflación',
      direction,
      description:
        direction === 'mejora'
          ? 'Inflación bajando'
          : direction === 'empeora'
          ? 'Inflación subiendo'
          : 'Inflación estable',
    })
  }

  // Monetary policy / Interest rates driver
  const monetaryScore = scores.monetaryScore || 0
  const prevMonetaryScore = previousScores?.monetaryScore || 0
  const monetaryDelta = monetaryScore - prevMonetaryScore

  if (Math.abs(monetaryScore) > 0.1 || Math.abs(monetaryDelta) > 0.05) {
    let direction: 'mejora' | 'empeora' | 'estable' = 'estable'
    if (monetaryDelta > 0.05) direction = 'empeora' // Rates rising (restrictive)
    else if (monetaryDelta < -0.05) direction = 'mejora' // Rates falling (accommodative)
    else if (monetaryScore > 0.1) direction = 'empeora' // High rates
    else if (monetaryScore < -0.1) direction = 'mejora' // Low rates

    drivers.push({
      category: 'Tipos',
      direction,
      description:
        direction === 'mejora'
          ? 'Tipos bajando o estables'
          : direction === 'empeora'
          ? 'Tipos subiendo'
          : 'Tipos estables',
    })
  }

  // Employment driver (optional, only if significant)
  const laborScore = scores.laborScore || 0
  if (Math.abs(laborScore) > 0.15 && drivers.length < 3) {
    drivers.push({
      category: 'Empleo',
      direction: laborScore > 0 ? 'mejora' : 'empeora',
      description: laborScore > 0 ? 'Mercado laboral fuerte' : 'Mercado laboral débil',
    })
  }

  // Return top 3 drivers
  return drivers.slice(0, 3)
}

/**
 * Calculate confidence level based on coverage and consistency
 */
export function calculateBiasConfidence(
  coverage: number,
  drivers: MacroBiasDriver[],
  presentIndicators: number,
  totalIndicators: number
): 'Alta' | 'Media' | 'Baja' {
  // High confidence: high coverage + consistent drivers
  if (coverage >= 0.8 && presentIndicators >= 8) {
    // Check driver consistency
    const consistentDirections = drivers.filter(d => d.direction !== 'estable').length
    if (consistentDirections >= 2) {
      return 'Alta'
    }
  }

  // Medium confidence: decent coverage
  if (coverage >= 0.6 && presentIndicators >= 6) {
    return 'Media'
  }

  // Low confidence: low coverage or inconsistent
  return 'Baja'
}
