import getBiasState, { type BiasState } from '@/domain/macro-engine/bias'
import getCorrelationState, { type CorrelationState } from '@/domain/macro-engine/correlations'
import { getUpcomingEventsForWeek } from '@/domain/calendar'
import { inferSideFromTacticalRow } from '@/domain/macro-engine/trading-bias'
import type { TacticalBiasRow } from '@/domain/macro-engine/bias'
import { logger } from '@/lib/obs/logger'

export type OpportunityPair = {
  symbol: string
  action: 'Long' | 'Short'
  confidence: 'Alta' | 'Media' | 'Baja'
  reasoning: string
  score: number
}

/**
 * Calcula el Radar de Oportunidades (top 5 pares para operar hoy)
 * Responde: "¿Cuáles son los 3–5 mejores pares para mirar hoy?"
 */
export async function calculateOpportunitiesRadar(): Promise<OpportunityPair[]> {
  try {
    const [biasState, correlationState, upcomingEvents] = await Promise.all([
      getBiasState(),
      getCorrelationState(),
      getUpcomingEventsForWeek(),
    ])

    const tacticalRows = biasState.tableTactical || []
    const summary = correlationState.summary || []
    const shifts = correlationState.shifts || []

    // Verificar eventos de alto impacto en próximas 24h
    const now = new Date()
    const highImpactEventsNext24h = upcomingEvents.filter((event) => {
      if (event.impact !== 'high') return false
      const eventDate = new Date(`${event.date}T${event.time || '12:00:00'}`)
      const hoursUntilEvent = (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60)
      return hoursUntilEvent >= 0 && hoursUntilEvent <= 24
    })
    const hasUpcomingHighImpactNews = highImpactEventsNext24h.length > 0

    // Calcular score para cada par
    const candidates: OpportunityPair[] = []

    for (const row of tacticalRows) {
      const symbol = row.symbol || row.pair || ''
      if (!symbol) continue

      const side = inferSideFromTacticalRow(row)
      if (side === 'Neutral') continue // Solo pares con sesgo claro

      // Obtener datos de correlación
      const corrSummary = summary.find((s) => s.symbol === symbol)
      const shift = shifts.find((s) => s.symbol === symbol)

      const trend = corrSummary?.trend || 'Stable'
      const macroRelevanceScore = corrSummary?.macroRelevanceScore || 0

      // Calcular score
      let score = 0

      // Confianza del sesgo
      const confidence = (row.confidence || '').toLowerCase()
      if (confidence.includes('alta')) score += 3
      else if (confidence.includes('media')) score += 1

      // Tendencia de correlación
      if (trend === 'Strengthening') score += 2
      else if (trend === 'Stable') score += 1

      // Relevancia macro (0-4 puntos)
      score += Math.round(macroRelevanceScore / 25)

      // Penalizar si hay noticias próximas
      if (hasUpcomingHighImpactNews) {
        // Verificar si el evento afecta a este par
        const affectsPair = highImpactEventsNext24h.some((event) => {
          const symbolUpper = symbol.toUpperCase()
          return (
            symbolUpper.includes(event.country) ||
            (event.country === 'US' && symbolUpper.includes('USD'))
          )
        })
        if (affectsPair) score -= 2
      }

      // Generar razonamiento corto
      const reasoningParts: string[] = []
      if (confidence.includes('alta')) {
        reasoningParts.push('Confianza alta')
      }
      if (trend === 'Strengthening') {
        reasoningParts.push('correlación reforzando')
      } else if (trend === 'Stable') {
        reasoningParts.push('correlación estable')
      }
      if (macroRelevanceScore > 50) {
        reasoningParts.push('alta relevancia macro')
      }

      const confidenceLabel: 'Alta' | 'Media' | 'Baja' =
        confidence.includes('alta') ? 'Alta' : confidence.includes('baja') ? 'Baja' : 'Media'

      candidates.push({
        symbol,
        action: side,
        confidence: confidenceLabel,
        reasoning: reasoningParts.join(' + ') || 'Señal macro favorable',
        score,
      })
    }

    // Ordenar por score descendente y tomar top 5
    candidates.sort((a, b) => b.score - a.score)
    return candidates.slice(0, 5)
  } catch (error) {
    logger.error('[calculateOpportunitiesRadar] Error:', { 
      error: error instanceof Error ? error.message : String(error) 
    })
    return []
  }
}
