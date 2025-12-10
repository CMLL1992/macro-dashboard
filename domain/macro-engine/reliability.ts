import getBiasState, { type BiasState } from '@/domain/macro-engine/bias'
import getCorrelationState, { type CorrelationState } from '@/domain/macro-engine/correlations'
import { getUpcomingEventsForWeek } from '@/domain/calendar'
import { logger } from '@/lib/obs/logger'

export type ReliabilityStatus = 'normal' | 'caution' | 'chaos'

export type ReliabilityScore = {
  score: number
  status: ReliabilityStatus
  message: string
  details: {
    percentWeakening: number
    percentBreak: number
    hasUpcomingHighImpactNews: boolean
    upcomingHighImpactEvents: Array<{ title: string; time: string | null }>
    hasHighImpactLaterToday: boolean
    highImpactLaterToday: Array<{ title: string; time: string | null }>
    regimeSwitchInLast24h: boolean
  }
}

/**
 * Calcula el Semáforo de Fiabilidad del Sistema
 * Responde: "¿Me puedo fiar del sistema hoy?"
 */
export async function calculateReliabilityScore(): Promise<ReliabilityScore> {
  try {
    const [biasState, correlationState, upcomingEvents] = await Promise.all([
      getBiasState(),
      getCorrelationState(),
      getUpcomingEventsForWeek(),
    ])

    const summary = correlationState.summary || []
    const totalPairs = summary.length

    if (totalPairs === 0) {
      return {
        score: 0,
        status: 'normal',
        message: 'Datos insuficientes para evaluar fiabilidad',
        details: {
          percentWeakening: 0,
          percentBreak: 0,
          hasUpcomingHighImpactNews: false,
          upcomingHighImpactEvents: [],
          hasHighImpactLaterToday: false,
          highImpactLaterToday: [],
          regimeSwitchInLast24h: false,
        },
      }
    }

    // 1. Calcular % de pares con trend = Weakening o Break
    const weakeningCount = summary.filter(
      (s) => s.trend === 'Weakening' || s.trend === 'Inconclusive'
    ).length
    const percentWeakening = totalPairs > 0 ? (weakeningCount / totalPairs) * 100 : 0

    // 2. Calcular % de pares con régimen Break
    const breakCount = summary.filter((s) => {
      const shift = correlationState.shifts?.find(
        (sh) => sh.symbol === s.symbol && sh.benchmark === s.benchmark
      )
      return shift?.regime === 'Break'
    }).length
    const percentBreak = totalPairs > 0 ? (breakCount / totalPairs) * 100 : 0

    // 3. Verificar eventos de alto impacto próximos (próximas 3h)
    const now = new Date()
    const THREE_HOURS = 3 * 60 * 60 * 1000
    
    // Eventos de alto impacto en las próximas 3 horas
    const upcomingHighImpact = upcomingEvents.filter((event) => {
      if (event.impact !== 'high') return false
      const eventDateTime = event.time 
        ? new Date(`${event.date}T${event.time}`)
        : new Date(`${event.date}T12:00:00`)
      const diff = eventDateTime.getTime() - now.getTime()
      return diff >= 0 && diff <= THREE_HOURS
    })

    const hasUpcomingHighImpactNews = upcomingHighImpact.length > 0
    const upcomingHighImpactEvents = upcomingHighImpact.map((e) => ({
      title: e.title,
      time: e.time,
    }))

    // Eventos de alto impacto más tarde hoy (después de 3h pero antes de fin de día)
    const endOfDay = new Date(now)
    endOfDay.setHours(23, 59, 59, 999)

    const highImpactLaterToday = upcomingEvents.filter((event) => {
      if (event.impact !== 'high') return false
      const eventDateTime = event.time 
        ? new Date(`${event.date}T${event.time}`)
        : new Date(`${event.date}T12:00:00`)
      const diff = eventDateTime.getTime() - now.getTime()
      return eventDateTime > now && eventDateTime <= endOfDay && diff > THREE_HOURS
    })

    const hasHighImpactLaterToday = highImpactLaterToday.length > 0
    const highImpactLaterTodayEvents = highImpactLaterToday.map((e) => ({
      title: e.title,
      time: e.time,
    }))

    // 4. Verificar cambios de régimen global (simplificado: comparar con estado anterior)
    // Por ahora, asumimos que si hay muchos breaks, hay cambio de régimen
    const regimeSwitchInLast24h = percentBreak > 10

    // Calcular score (solo penalizar si hay eventos en próximas 3h)
    let score = 0
    if (percentWeakening > 35) score += 2
    if (percentBreak > 10) score += 2
    if (hasUpcomingHighImpactNews) score += 2 // Solo penalizar eventos próximos (≤3h)
    if (regimeSwitchInLast24h) score += 1

    // Determinar estado y mensaje
    let status: ReliabilityStatus = 'normal'
    let message = 'Señales fiables'

    if (score >= 4) {
      status = 'chaos'
      const reasons: string[] = []
      if (percentBreak > 10) reasons.push('correlaciones rotas')
      if (hasUpcomingHighImpactNews) reasons.push('noticias próximas')
      if (percentWeakening > 35) reasons.push('correlaciones debilitándose')
      message = `Caos — ${reasons.join(' + ')}`
    } else if (score >= 2) {
      status = 'caution'
      const reasons: string[] = []
      if (regimeSwitchInLast24h) reasons.push(`${breakCount} cambios de régimen detectados`)
      if (hasUpcomingHighImpactNews) reasons.push('noticias próximas')
      message = `Precaución — ${reasons.join(', ')}`
    }

    return {
      score,
      status,
      message,
      details: {
        percentWeakening: Math.round(percentWeakening),
        percentBreak: Math.round(percentBreak),
        hasUpcomingHighImpactNews,
        upcomingHighImpactEvents,
        hasHighImpactLaterToday,
        highImpactLaterToday: highImpactLaterTodayEvents,
        regimeSwitchInLast24h,
      },
    }
  } catch (error) {
    logger.error('[calculateReliabilityScore] Error:', error)
    return {
      score: 0,
      status: 'normal',
      message: 'Error al calcular fiabilidad',
      details: {
        percentWeakening: 0,
        percentBreak: 0,
        hasUpcomingHighImpactNews: false,
        upcomingHighImpactEvents: [],
        hasHighImpactLaterToday: false,
        highImpactLaterToday: [],
        regimeSwitchInLast24h: false,
      },
    }
  }
}
