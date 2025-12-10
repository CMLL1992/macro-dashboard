import getCorrelationState, { type CorrelationState } from '@/domain/macro-engine/correlations'
import { logger } from '@/lib/obs/logger'

export type TradePosition = {
  pair: string
  size: number // +1 para Long, -1 para Short
}

export type ExposureSide = {
  label: string
  percentage: number
  trades: string[]
}

export type ExposureOverlap = {
  usdStrong: ExposureSide
  usdWeak: ExposureSide
  neutral: ExposureSide
  alert?: string
}

/**
 * Calcula el Solapamiento de Exposición
 * Responde: "¿Estoy apostando 3 veces lo mismo sin darme cuenta?"
 * 
 * @param positions Lista de trades activos o planificados
 */
export async function calculateExposureOverlap(
  positions: TradePosition[]
): Promise<ExposureOverlap> {
  try {
    if (!positions || positions.length === 0) {
      return {
        usdStrong: { label: 'USD fuerte', percentage: 0, trades: [] },
        usdWeak: { label: 'USD débil', percentage: 0, trades: [] },
        neutral: { label: 'Neutral', percentage: 0, trades: [] },
      }
    }

    const correlationState = await getCorrelationState()
    const summary = correlationState.summary || []

    // Convertir cada par en exposición USD
    const exposures: Array<{
      pair: string
      exposure: number // Positivo = USD fuerte, Negativo = USD débil
      weight: number
    }> = []

    for (const position of positions) {
      const pair = position.pair.toUpperCase().replace('/', '')
      const size = position.size

      // Buscar correlación del par
      const corrSummary = summary.find((s) => s.symbol === pair)
      const correlationNow = corrSummary?.correlationNow ?? 0
      const macroRelevanceScore = corrSummary?.macroRelevanceScore ?? 0

      // Convertir posición a exposición USD:
      // Long EURUSD = corto USD (exposición negativa)
      // Short EURUSD = largo USD (exposición positiva)
      // Long USDJPY = largo USD (exposición positiva)
      // Short USDJPY = corto USD (exposición negativa)

      let exposure = 0
      if (pair.includes('USD')) {
        // Si USD es la base (USDJPY, USDCAD)
        if (pair.startsWith('USD')) {
          exposure = size // Long USDJPY = largo USD
        } else {
          // Si USD es la quote (EURUSD, GBPUSD)
          exposure = -size // Long EURUSD = corto USD
        }
      } else {
        // Para pares sin USD, usar correlación como proxy
        // Si correlación positiva con DXY, Long = USD fuerte
        // Si correlación negativa con DXY, Long = USD débil
        exposure = size * (correlationNow > 0 ? 1 : -1)
      }

      // Ponderar por relevancia macro y correlación
      const weight = Math.abs(size) * Math.abs(correlationNow) * (macroRelevanceScore / 100)

      exposures.push({
        pair,
        exposure,
        weight: weight || 1, // Fallback a 1 si weight es 0
      })
    }

    // Sumar por lado macro
    let usdStrongTotal = 0
    let usdWeakTotal = 0
    let neutralTotal = 0

    const usdStrongTrades: string[] = []
    const usdWeakTrades: string[] = []
    const neutralTrades: string[] = []

    for (const exp of exposures) {
      if (exp.exposure > 0.1) {
        usdStrongTotal += exp.weight
        usdStrongTrades.push(exp.pair)
      } else if (exp.exposure < -0.1) {
        usdWeakTotal += exp.weight
        usdWeakTrades.push(exp.pair)
      } else {
        neutralTotal += exp.weight
        neutralTrades.push(exp.pair)
      }
    }

    const totalWeight = usdStrongTotal + usdWeakTotal + neutralTotal

    const usdStrongPct = totalWeight > 0 ? (usdStrongTotal / totalWeight) * 100 : 0
    const usdWeakPct = totalWeight > 0 ? (usdWeakTotal / totalWeight) * 100 : 0
    const neutralPct = totalWeight > 0 ? (neutralTotal / totalWeight) * 100 : 0

    // Generar alerta si hay concentración
    let alert: string | undefined
    if (usdStrongPct > 60) {
      alert = `Tienes ${usdStrongTrades.length} trades apuntando a USD fuerte — riesgo de concentración macro`
    } else if (usdWeakPct > 60) {
      alert = `Tienes ${usdWeakTrades.length} trades apuntando a USD débil — riesgo de concentración macro`
    }

    return {
      usdStrong: {
        label: 'USD fuerte',
        percentage: Math.round(usdStrongPct),
        trades: usdStrongTrades,
      },
      usdWeak: {
        label: 'USD débil',
        percentage: Math.round(usdWeakPct),
        trades: usdWeakTrades,
      },
      neutral: {
        label: 'Neutral',
        percentage: Math.round(neutralPct),
        trades: neutralTrades,
      },
      alert,
    }
  } catch (error) {
    logger.error('[calculateExposureOverlap] Error:', { 
      error: error instanceof Error ? error.message : String(error) 
    })
    return {
      usdStrong: { label: 'USD fuerte', percentage: 0, trades: [] },
      usdWeak: { label: 'USD débil', percentage: 0, trades: [] },
      neutral: { label: 'Neutral', percentage: 0, trades: [] },
      alert: 'Error al calcular exposición',
    }
  }
}
