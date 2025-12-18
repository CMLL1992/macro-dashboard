/**
 * Generador de drivers para pares tácticos
 * Deriva drivers directamente de señales internas (diferenciales, crecimiento relativo, etc.)
 */

export type TacticalDriver = {
  key: string
  text: string
  weight?: number
}

export type TacticalContext = {
  riskRegime: 'Risk ON' | 'Risk OFF' | 'Neutral' | string
  usdDirection?: 'Bullish' | 'Bearish' | 'Neutral' | string
  quad?: string
  liquidity?: string
  currencyRegimes?: Record<string, { regime?: string; probability?: number }>
  // Métricas agregadas (opcional, se pueden calcular desde currencyRegimes)
  rateDiff?: Record<string, number> // por par o currency
  growthDiff?: Record<string, number>
  inflationDiff?: Record<string, number>
}

/**
 * Construye drivers para un par táctico basado en el contexto macro
 */
export function buildDriversForPair(
  pair: string,
  ctx: TacticalContext
): TacticalDriver[] {
  const drivers: TacticalDriver[] = []
  const pairUpper = pair.toUpperCase().replace('/', '')

  // 1. Risk regime
  if (ctx.riskRegime === 'Risk ON' || ctx.riskRegime === 'Risk-on') {
    // Risk ON favorece divisas pro-cíclicas (EUR, GBP, AUD, NZD) y penaliza refugio (USD, JPY, CHF)
    if (pairUpper.includes('EUR') || pairUpper.includes('GBP') || pairUpper.includes('AUD') || pairUpper.includes('NZD')) {
      drivers.push({
        key: 'risk_on',
        text: 'Entorno Risk ON favorece divisas pro-cíclicas',
        weight: 0.3,
      })
    } else if (pairUpper.includes('JPY') || pairUpper.includes('CHF')) {
      drivers.push({
        key: 'risk_on_penalty',
        text: 'Entorno Risk ON penaliza divisas refugio',
        weight: -0.2,
      })
    }
  } else if (ctx.riskRegime === 'Risk OFF' || ctx.riskRegime === 'Risk-off') {
    // Risk OFF favorece refugio (USD, JPY, CHF) y penaliza pro-cíclicas
    if (pairUpper.includes('USD') || pairUpper.includes('JPY') || pairUpper.includes('CHF')) {
      drivers.push({
        key: 'risk_off',
        text: 'Entorno Risk OFF favorece divisas refugio',
        weight: 0.3,
      })
    } else if (pairUpper.includes('EUR') || pairUpper.includes('GBP') || pairUpper.includes('AUD')) {
      drivers.push({
        key: 'risk_off_penalty',
        text: 'Entorno Risk OFF penaliza divisas pro-cíclicas',
        weight: -0.2,
      })
    }
  }

  // 2. USD Direction
  if (ctx.usdDirection === 'Bullish' || ctx.usdDirection === 'Fuerte') {
    if (pairUpper.startsWith('USD')) {
      drivers.push({
        key: 'usd_bullish',
        text: 'USD fuerte apoya pares USD-long',
        weight: 0.4,
      })
    } else if (pairUpper.endsWith('USD')) {
      drivers.push({
        key: 'usd_bullish_penalty',
        text: 'USD fuerte penaliza pares USD-short',
        weight: -0.3,
      })
    }
  } else if (ctx.usdDirection === 'Bearish' || ctx.usdDirection === 'Débil') {
    if (pairUpper.endsWith('USD')) {
      drivers.push({
        key: 'usd_bearish',
        text: 'USD débil apoya pares USD-short',
        weight: 0.4,
      })
    } else if (pairUpper.startsWith('USD')) {
      drivers.push({
        key: 'usd_bearish_penalty',
        text: 'USD débil penaliza pares USD-long',
        weight: -0.3,
      })
    }
  }

  // 3. Currency regimes (comparar regímenes de base vs quote)
  if (ctx.currencyRegimes) {
    const baseCurrency = extractBaseCurrency(pairUpper)
    const quoteCurrency = extractQuoteCurrency(pairUpper)

    if (baseCurrency && quoteCurrency) {
      const baseRegime = ctx.currencyRegimes[baseCurrency]
      const quoteRegime = ctx.currencyRegimes[quoteCurrency]

      if (baseRegime && quoteRegime) {
        const baseRegimeType = baseRegime.regime || 'mixed'
        const quoteRegimeType = quoteRegime.regime || 'mixed'

        // Si el régimen de base es más favorable que el de quote
        if (baseRegimeType !== 'mixed' && quoteRegimeType === 'mixed') {
          drivers.push({
            key: 'regime_advantage',
            text: `Régimen macro de ${baseCurrency} más favorable que ${quoteCurrency}`,
            weight: 0.25,
          })
        } else if (baseRegimeType === 'goldilocks' && quoteRegimeType !== 'goldilocks') {
          drivers.push({
            key: 'goldilocks_advantage',
            text: `${baseCurrency} en régimen Goldilocks vs ${quoteCurrency}`,
            weight: 0.3,
          })
        } else if (baseRegimeType === 'stagflation' && quoteRegimeType !== 'stagflation') {
          drivers.push({
            key: 'stagflation_penalty',
            text: `${baseCurrency} en estanflación vs ${quoteCurrency}`,
            weight: -0.25,
          })
        }
      }
    }
  }

  // 4. Quad regime
  if (ctx.quad) {
    if (ctx.quad === 'Expansivo' || ctx.quad === 'Expansión') {
      if (pairUpper.includes('EUR') || pairUpper.includes('GBP') || pairUpper.includes('AUD')) {
        drivers.push({
          key: 'quad_expansive',
          text: 'Régimen expansivo favorece divisas de crecimiento',
          weight: 0.2,
        })
      }
    } else if (ctx.quad === 'Recesivo' || ctx.quad === 'Recesión') {
      if (pairUpper.includes('USD') || pairUpper.includes('JPY')) {
        drivers.push({
          key: 'quad_recessive',
          text: 'Régimen recesivo favorece divisas refugio',
          weight: 0.2,
        })
      }
    }
  }

  // 5. Liquidity
  if (ctx.liquidity) {
    if (ctx.liquidity === 'Tight' || ctx.liquidity === 'Ajustada') {
      drivers.push({
        key: 'liquidity_tight',
        text: 'Liquidez ajustada favorece USD',
        weight: pairUpper.includes('USD') ? 0.15 : -0.1,
      })
    }
  }

  // Ordenar por weight (mayor primero) y tomar top 3
  const sorted = drivers.sort((a, b) => (b.weight || 0) - (a.weight || 0))
  const top3 = sorted.slice(0, 3)

  // Si no hay drivers suficientes, añadir fallback
  if (top3.length === 0) {
    top3.push({
      key: 'insufficient_signals',
      text: 'Drivers insuficientes con el set actual de señales',
      weight: 0,
    })
  }

  return top3
}

/**
 * Extrae la moneda base de un par (ej: "EURUSD" -> "EUR")
 */
function extractBaseCurrency(pair: string): string | null {
  // Pares comunes
  const majors = ['EUR', 'GBP', 'AUD', 'NZD', 'USD', 'JPY', 'CHF', 'CAD']
  for (const major of majors) {
    if (pair.startsWith(major)) {
      return major
    }
  }
  return null
}

/**
 * Extrae la moneda quote de un par (ej: "EURUSD" -> "USD")
 */
function extractQuoteCurrency(pair: string): string | null {
  const majors = ['EUR', 'GBP', 'AUD', 'NZD', 'USD', 'JPY', 'CHF', 'CAD']
  for (const major of majors) {
    if (pair.endsWith(major) && !pair.startsWith(major)) {
      return major
    }
  }
  // Si no encuentra, intentar con el resto del string
  const base = extractBaseCurrency(pair)
  if (base) {
    const rest = pair.substring(base.length)
    if (rest.length >= 3) {
      return rest
    }
  }
  return null
}
