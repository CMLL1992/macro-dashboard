/**
 * Weekly narrative summary
 * Resumen semanal de todas las narrativas de la semana pasada
 */

import { getUnifiedDB } from '@/lib/db/unified-db'
import { enqueueMessage } from './queue'
import { sendTelegramMessage } from './telegram'
import { format, subDays, startOfWeek, endOfWeek, addDays } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'
import { incrementMetric } from './metrics'
import { fetchBiasInputs } from '@/lib/bias/inputs'
import { fedfunds } from '@/lib/fred'
import { postureOf } from '@/domain/posture'
import { getMacroDiagnosis } from '@/domain/diagnostic'
import { getBiasTableFromUniverse, usdBias, macroQuadrant } from '@/domain/bias'
import { getCalendarEvents } from './weekly'
import { getCurrentNarrative } from './narrative'
import type { LatestPoint } from '@/lib/fred'

const TIMEZONE = process.env.TIMEZONE || 'Europe/Madrid'

export type NarrativeState = 'RISK_ON' | 'RISK_OFF' | 'INFLACION_ARRIBA' | 'INFLACION_ABAJO' | 'NEUTRAL'

interface NarrativeChange {
  narrativa_anterior: string | null
  narrativa_actual: string
  cambiado_en: string
}

/**
 * Get all narrative changes from the past week
 */
async function getWeeklyNarrativeChanges(): Promise<NarrativeChange[]> {
  const db = getUnifiedDB()
  const nowUTC = new Date()
  const madridNow = toZonedTime(nowUTC, TIMEZONE)
  
  // Get start of week (last Sunday)
  const weekStart = startOfWeek(madridNow, { weekStartsOn: 0 })
  const weekStartISO = format(weekStart, 'yyyy-MM-dd')
  
  // Get all changes from this week
  // All methods are async now, so always use await
  const rows = await db.prepare(`
    SELECT narrativa_anterior, narrativa_actual, cambiado_en
    FROM narrative_state
    WHERE DATE(cambiado_en) >= ?
    ORDER BY cambiado_en ASC
  `).all(weekStartISO) as NarrativeChange[]

  return rows
}

// Use getCurrentNarrative from './narrative' instead

/**
 * Format narrative state name in Spanish
 */
function formatNarrativeName(state: string): string {
  const names: Record<string, string> = {
    'RISK_ON': '🟢 RIESGO AL ALZA',
    'RISK_OFF': '🔴 RIESGO A LA BAJA',
    'INFLACION_ARRIBA': '📈 INFLACIÓN AL ALZA',
    'INFLACION_ABAJO': '📉 INFLACIÓN A LA BAJA',
    'NEUTRAL': '⚪ NEUTRAL',
  }
  return names[state] || state
}

/**
 * Get monetary policy stance (Fed stance)
 */
async function getMonetaryPolicyStance(): Promise<{ stance: string; fedFunds: number | null }> {
  try {
    const fedFundsData = await fedfunds()
    const fedFundsValue = fedFundsData.value
    const stance = fedFundsValue != null ? postureOf('FEDFUNDS', fedFundsValue) : 'Neutral'
    return { stance, fedFunds: fedFundsValue }
  } catch (error) {
    console.warn('[narrative-weekly] Could not fetch Fed stance:', error)
    return { stance: 'Neutral', fedFunds: null }
  }
}

/**
 * Get risk regime and USD bias
 */
async function getMacroContext(): Promise<{
  riskRegime: string
  usdBias: string
  eurusdDirection: string
}> {
  try {
    const inputs = await fetchBiasInputs('US')
    
    // Risk regime
    const riskRegime = inputs.risk_regime.regime === 'RISK_ON' 
      ? '🟢 RISK ON' 
      : inputs.risk_regime.regime === 'RISK_OFF'
      ? '🔴 RISK OFF'
      : '⚪ NEUTRAL'
    
    // USD bias
    const usdBias = inputs.usd_bias.direction === 'STRONG'
      ? '💪 USD FUERTE'
      : inputs.usd_bias.direction === 'WEAK'
      ? '💤 USD DÉBIL'
      : '⚖️ USD NEUTRAL'
    
    // EUR/USD direction based on USD bias
    // EUR/USD has inverse relationship with USD: USD fuerte → EUR/USD bajista, USD débil → EUR/USD alcista
    let eurusdDirection = '⚖️ RANGO/TÁCTICO'
    if (inputs.usd_bias.direction === 'STRONG') {
      eurusdDirection = '📉 BAJISTA (Buscar ventas)'
    } else if (inputs.usd_bias.direction === 'WEAK') {
      eurusdDirection = '📈 ALCISTA (Buscar compras)'
    }
    
    return { riskRegime, usdBias, eurusdDirection }
  } catch (error) {
    console.warn('[narrative-weekly] Could not fetch macro context:', error)
    return {
      riskRegime: '⚪ NEUTRAL',
      usdBias: '⚖️ USD NEUTRAL',
      eurusdDirection: '⚖️ RANGO/TÁCTICO',
    }
  }
}

/**
 * Format monetary policy stance
 */
function formatMonetaryStance(stance: string): string {
  const stanceMap: Record<string, string> = {
    'Hawkish': '🦅 HAWKISH (Restrictiva)',
    'Dovish': '🕊️ DOVISH (Acomodaticia)',
    'Neutral': '⚖️ NEUTRAL',
  }
  return stanceMap[stance] || stance
}

/**
 * Format pair action for message
 */
function formatPairAction(action: string): string {
  if (action === 'Buscar compras') return '📈 ALCISTA'
  if (action === 'Buscar ventas') return '📉 BAJISTA'
  return '⚖️ RANGO/TÁCTICO'
}

/**
 * Format trend for indicator
 */
function formatTrend(trend: string | null): string {
  if (trend === 'Mejora') return '✅ Mejora'
  if (trend === 'Empeora') return '❌ Empeora'
  if (trend === 'Estable') return '➡️ Estable'
  return '❓ Sin datos'
}

/**
 * Get VIX interpretation
 */
function getVIXInterpretation(vixValue: number | null): string {
  if (vixValue == null) return 'Sin datos'
  if (vixValue < 15) return 'BAJA (Mercado tranquilo, condiciones favorables)'
  if (vixValue <= 25) return 'MODERADA (Volatilidad normal)'
  return 'ALTA (Aversión al riesgo, volatilidad elevada)'
}

/**
 * Get high impact events for next week
 */
function getHighImpactEvents(events: any[]): any[] {
  return events.filter(e => e.importancia === 'high')
}

/**
 * Build executive summary (TL;DR)
 */
function buildExecutiveSummary(
  monetaryStance: { stance: string; fedFunds: number | null },
  macroContext: { riskRegime: string; usdBias: string },
  currentNarrative: string,
  vixValue: number | null,
  highImpactEvents: any[]
): string {
  let summary = `\n⚡ RESUMEN EJECUTIVO (TL;DR):\n\n`
  
  summary += `🎯 Postura: ${formatMonetaryStance(monetaryStance.stance)}`
  if (monetaryStance.fedFunds != null) {
    summary += ` (${monetaryStance.fedFunds.toFixed(2)}%)\n`
  } else {
    summary += `\n`
  }
  
  summary += `📊 Régimen: ${macroContext.riskRegime}\n`
  summary += `💵 USD: ${macroContext.usdBias}\n`
  summary += `📈 Narrativa: ${formatNarrativeName(currentNarrative)}\n`
  
  if (vixValue != null && !isNaN(vixValue)) {
    summary += `⚠️ VIX: ${vixValue.toFixed(2)} (${getVIXInterpretation(vixValue)})\n`
  } else {
    summary += `⚠️ VIX: Sin datos disponibles\n`
  }
  
  if (highImpactEvents.length > 0) {
    summary += `\n🔥 Eventos clave próxima semana: ${highImpactEvents.length}\n`
    const topEvents = highImpactEvents.slice(0, 3)
    for (const event of topEvents) {
      const date = new Date(event.fecha)
      const dateStr = format(date, 'dd/MM')
      summary += `  • ${dateStr} ${event.hora_local || ''} - ${event.evento} (${event.pais || 'N/A'})\n`
    }
  }
  
  summary += `\n`
  return summary
}

/**
 * Build extensive narrative explanation
 */
function buildExtensiveNarrative(
  monetaryStance: { stance: string; fedFunds: number | null },
  macroContext: { riskRegime: string; usdBias: string; eurusdDirection: string },
  diagnosis: any,
  indicatorsThisWeek: any[],
  pairs: any[],
  vixValue: number | null,
  highImpactEvents: any[]
): string {
  let narrative = `\n📝 NARRATIVA SEMANAL - ANÁLISIS DETALLADO:\n\n`
  
  // VIX section
  if (vixValue != null && !isNaN(vixValue)) {
    narrative += `⚠️ VOLATILIDAD (VIX):\n`
    narrative += `Nivel actual: ${vixValue.toFixed(2)}\n`
    narrative += `Interpretación: ${getVIXInterpretation(vixValue)}\n`
    if (vixValue > 25) {
      narrative += `Alta volatilidad sugiere aversión al riesgo. Considerar reducir exposición y esperar claridad.\n`
    } else if (vixValue < 15) {
      narrative += `Baja volatilidad indica condiciones favorables para activos de riesgo.\n`
    } else {
      narrative += `Volatilidad moderada, condiciones normales de mercado.\n`
    }
    narrative += `\n`
  } else {
    narrative += `⚠️ VOLATILIDAD (VIX):\n`
    narrative += `Sin datos disponibles esta semana.\n\n`
  }
  
  // High impact events
  if (highImpactEvents.length > 0) {
    narrative += `🔥 EVENTOS DE ALTO IMPACTO - PRÓXIMA SEMANA:\n\n`
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
    for (const event of highImpactEvents.slice(0, 5)) {
      const date = new Date(event.fecha)
      const dateStr = format(date, 'dd/MM')
      const dayName = dayNames[date.getDay()]
      narrative += `📅 ${dayName} ${dateStr} ${event.hora_local || ''}:\n`
      narrative += `  ${event.evento} (${event.pais || 'N/A'})\n`
      if (event.consenso) {
        narrative += `  Consenso: ${event.consenso}\n`
      }
      narrative += `\n`
    }
    narrative += `Estos eventos pueden generar volatilidad significativa. Monitorear especialmente FOMC, NFP, CPI y decisiones del BCE.\n\n`
  } else {
    narrative += `🔥 EVENTOS DE ALTO IMPACTO - PRÓXIMA SEMANA:\n`
    narrative += `No hay eventos de alta importancia programados esta semana.\n\n`
  }
  
  // FED/BCE explanation
  narrative += `🏦 POSTURA MONETARIA (FED):\n`
  const fedFunds = monetaryStance.fedFunds
  if (monetaryStance.stance === 'Hawkish') {
    narrative += `La FED mantiene una postura HAWKISH (restrictiva) con tipos en ${fedFunds?.toFixed(2) || 'N/A'}%.\n`
    narrative += `Esta postura se justifica por:\n`
    const inflationIndicators = diagnosis.items.filter((i: any) => 
      i.category === 'inflation' && i.value != null
    )
    const highInflation = inflationIndicators.filter((i: any) => i.value > 3)
    if (highInflation.length > 0) {
      narrative += `• Inflación persistente: ${highInflation.map((i: any) => `${i.label} en ${i.value?.toFixed(2)}%`).join(', ')}\n`
    }
    const employmentIndicators = diagnosis.items.filter((i: any) => 
      i.category === 'employment' && i.value != null
    )
    const strongEmployment = employmentIndicators.filter((i: any) => {
      if (i.key === 'UNRATE') return i.value < 4
      if (i.key === 'PAYEMS') return i.value > 200
      return false
    })
    if (strongEmployment.length > 0) {
      narrative += `• Mercado laboral sólido: ${strongEmployment.map((i: any) => `${i.label} ${i.key === 'UNRATE' ? i.value?.toFixed(2) + '%' : i.value?.toFixed(0)}`).join(', ')}\n`
    }
    narrative += `\nLa FED prioriza el control de la inflación sobre el crecimiento, manteniendo tipos altos para enfriar la economía.\n\n`
  } else if (monetaryStance.stance === 'Dovish') {
    narrative += `La FED adopta una postura DOVISH (acomodaticia) con tipos en ${fedFunds?.toFixed(2) || 'N/A'}%.\n`
    narrative += `Esta postura se justifica por:\n`
    const inflationIndicators = diagnosis.items.filter((i: any) => 
      i.category === 'inflation' && i.value != null
    )
    const lowInflation = inflationIndicators.filter((i: any) => i.value < 2.5)
    if (lowInflation.length > 0) {
      narrative += `• Inflación controlada: ${lowInflation.map((i: any) => `${i.label} en ${i.value?.toFixed(2)}%`).join(', ')}\n`
    }
    const growthIndicators = diagnosis.items.filter((i: any) => 
      i.category === 'growth' && i.value != null
    )
    const weakGrowth = growthIndicators.filter((i: any) => i.value < 2)
    if (weakGrowth.length > 0) {
      narrative += `• Crecimiento moderado: ${weakGrowth.map((i: any) => `${i.label} en ${i.value?.toFixed(2)}%`).join(', ')}\n`
    }
    narrative += `\nLa FED busca estimular la economía reduciendo restricciones monetarias.\n\n`
  } else {
    narrative += `La FED mantiene una postura NEUTRAL con tipos en ${fedFunds?.toFixed(2) || 'N/A'}%.\n`
    narrative += `Señales mixtas entre inflación y crecimiento sugieren mantener la política actual sin cambios significativos.\n\n`
  }
  
  // Risk regime explanation
  narrative += `📊 RÉGIMEN DE RIESGO:\n`
  if (macroContext.riskRegime.includes('RISK ON')) {
    narrative += `El mercado se encuentra en modo RISK ON, indicando apetito por activos de riesgo.\n`
    const growthIndicators = diagnosis.items.filter((i: any) => 
      i.category === 'growth' && i.trend === 'Mejora'
    )
    if (growthIndicators.length > 0) {
      narrative += `Factores positivos: ${growthIndicators.map((i: any) => i.label).slice(0, 3).join(', ')} mostrando mejoras.\n`
    }
    narrative += `Esto favorece activos como acciones, cripto y pares de riesgo (AUD, GBP).\n\n`
  } else if (macroContext.riskRegime.includes('RISK OFF')) {
    narrative += `El mercado se encuentra en modo RISK OFF, indicando aversión al riesgo.\n`
    const negativeIndicators = diagnosis.items.filter((i: any) => 
      i.trend === 'Empeora'
    )
    if (negativeIndicators.length > 0) {
      narrative += `Factores negativos: ${negativeIndicators.map((i: any) => i.label).slice(0, 3).join(', ')} mostrando deterioro.\n`
    }
    narrative += `Esto favorece activos refugio como USD, JPY y oro, mientras presiona a la baja acciones y cripto.\n\n`
  } else {
    narrative += `El mercado se encuentra en modo NEUTRAL, con señales mixtas.\n`
    narrative += `Se recomienda trading táctico y confirmación con price action.\n\n`
  }
  
  // USD bias explanation
  narrative += `💵 SESGO USD:\n`
  if (macroContext.usdBias.includes('FUERTE')) {
    narrative += `El USD muestra fortaleza debido a:\n`
    const hawkishIndicators = diagnosis.items.filter((i: any) => 
      i.posture === 'Hawkish' && i.value != null
    )
    if (hawkishIndicators.length > 0) {
      narrative += `• Postura hawkish de la FED (tipos altos atraen capital)\n`
      narrative += `• Indicadores macro positivos: ${hawkishIndicators.slice(0, 2).map((i: any) => i.label).join(', ')}\n`
    }
    narrative += `\nEsto presiona a la baja a pares como EUR/USD, GBP/USD, AUD/USD y oro.\n\n`
  } else if (macroContext.usdBias.includes('DÉBIL')) {
    narrative += `El USD muestra debilidad debido a:\n`
    const dovishIndicators = diagnosis.items.filter((i: any) => 
      i.posture === 'Dovish' && i.value != null
    )
    if (dovishIndicators.length > 0) {
      narrative += `• Expectativas de recortes de tipos de la FED\n`
      narrative += `• Indicadores macro mixtos: ${dovishIndicators.slice(0, 2).map((i: any) => i.label).join(', ')}\n`
    }
    narrative += `\nEsto favorece a pares como EUR/USD, GBP/USD, AUD/USD y oro.\n\n`
  } else {
    narrative += `El USD se mantiene neutral, con fuerzas equilibradas.\n`
    narrative += `Se recomienda trading táctico basado en price action y eventos específicos.\n\n`
  }
  
  // Weekly summary
  narrative += `📈 RESUMEN DE LA SEMANA:\n`
  const improving = indicatorsThisWeek.filter((i: any) => i.trend === 'Mejora').length
  const deteriorating = indicatorsThisWeek.filter((i: any) => i.trend === 'Empeora').length
  const stable = indicatorsThisWeek.filter((i: any) => i.trend === 'Estable').length
  
  if (indicatorsThisWeek.length > 0) {
    narrative += `Esta semana se actualizaron ${indicatorsThisWeek.length} indicadores:\n`
    narrative += `• ${improving} mejoraron ✅\n`
    narrative += `• ${deteriorating} empeoraron ❌\n`
    narrative += `• ${stable} se mantuvieron estables ➡️\n\n`
  }
  
  // Pairs explanation
  narrative += `💱 DIRECCIÓN DE PARES - RACIONAL:\n\n`
  
  const fxPairs = pairs.filter(p => {
    const par = p.par.toUpperCase()
    return par.includes('/') && !par.includes('XAU') && !par.includes('BTC') && !par.includes('ETH')
  })
  
  if (fxPairs.length > 0) {
    narrative += `FX:\n`
    for (const pair of fxPairs.slice(0, 3)) {
      const action = pair.accion
      if (action === 'Buscar compras') {
        narrative += `• ${pair.par}: Sesgo ALCISTA - ${pair.motivo}\n`
      } else if (action === 'Buscar ventas') {
        narrative += `• ${pair.par}: Sesgo BAJISTA - ${pair.motivo}\n`
      } else {
        narrative += `• ${pair.par}: RANGO/TÁCTICO - ${pair.motivo}\n`
      }
    }
    narrative += `\n`
  }
  
  const metals = pairs.filter(p => p.par.toUpperCase().includes('XAU'))
  if (metals.length > 0) {
    narrative += `Metales:\n`
    for (const pair of metals) {
      const action = pair.accion
      if (action === 'Buscar compras') {
        narrative += `• ${pair.par}: Sesgo ALCISTA - ${pair.motivo}\n`
      } else if (action === 'Buscar ventas') {
        narrative += `• ${pair.par}: Sesgo BAJISTA - ${pair.motivo}\n`
      } else {
        narrative += `• ${pair.par}: RANGO/TÁCTICO - ${pair.motivo}\n`
      }
    }
    narrative += `\n`
  }
  
  const crypto = pairs.filter(p => {
    const par = p.par.toUpperCase()
    return par.includes('BTC') || par.includes('ETH')
  })
  if (crypto.length > 0) {
    narrative += `Cripto:\n`
    for (const pair of crypto) {
      const action = pair.accion
      if (action === 'Buscar compras') {
        narrative += `• ${pair.par}: Sesgo ALCISTA - ${pair.motivo}\n`
      } else if (action === 'Buscar ventas') {
        narrative += `• ${pair.par}: Sesgo BAJISTA - ${pair.motivo}\n`
      } else {
        narrative += `• ${pair.par}: RANGO/TÁCTICO - ${pair.motivo}\n`
      }
    }
    narrative += `\n`
  }
  
  const indices = pairs.filter(p => {
    const par = p.par.toUpperCase()
    return par === 'SPX' || par === 'NDX'
  })
  if (indices.length > 0) {
    narrative += `Índices:\n`
    for (const pair of indices) {
      const action = pair.accion
      if (action === 'Buscar compras') {
        narrative += `• ${pair.par}: Sesgo ALCISTA - ${pair.motivo}\n`
      } else if (action === 'Buscar ventas') {
        narrative += `• ${pair.par}: Sesgo BAJISTA - ${pair.motivo}\n`
      } else {
        narrative += `• ${pair.par}: RANGO/TÁCTICO - ${pair.motivo}\n`
      }
    }
    narrative += `\n`
  }
  
  narrative += `⚠️ IMPORTANTE: Estos sesgos son válidos para los próximos 3-10 días. Siempre confirmar con price action en marcos temporales D/H4 antes de operar.\n`
  
  return narrative
}

/**
 * Get indicators updated this week
 */
function getIndicatorsUpdatedThisWeek(items: any[], weekStart: Date): any[] {
  return items.filter(item => {
    if (!item.date) return false
    const itemDate = new Date(item.date)
    return itemDate >= weekStart
  })
}

/**
 * Build weekly narrative summary message
 */
async function buildWeeklyNarrativeMessage(): Promise<string> {
  const changes = await getWeeklyNarrativeChanges()
  const current = await getCurrentNarrative()
  const nowUTC = new Date()
  const madridNow = toZonedTime(nowUTC, TIMEZONE)
  
  // Get week range
  const weekStart = startOfWeek(madridNow, { weekStartsOn: 0 })
  const weekEnd = endOfWeek(madridNow, { weekStartsOn: 0 })
  const weekStartStr = format(weekStart, 'dd/MM')
  const weekEndStr = format(weekEnd, 'dd/MM')
  
  // Get macro diagnosis and pairs
  const [monetaryStance, macroContext, diagnosis] = await Promise.all([
    getMonetaryPolicyStance(),
    getMacroContext(),
    getMacroDiagnosis(),
  ])
  
  // Get next week events (Monday to Sunday)
  const nextMonday = startOfWeek(addDays(madridNow, 7), { weekStartsOn: 1 })
  const nextSunday = endOfWeek(nextMonday, { weekStartsOn: 1 })
  const mondayStr = format(nextMonday, 'yyyy-MM-dd')
  const sundayStr = format(nextSunday, 'yyyy-MM-dd')
  const nextWeekEvents = await getCalendarEvents(mondayStr, sundayStr)
  
  // Get all pairs
  const usd = usdBias(diagnosis.items as LatestPoint[])
  const quad = macroQuadrant(diagnosis.items as LatestPoint[])
  const pairs = await getBiasTableFromUniverse(diagnosis.regime, usd, quad)
  
  // Get indicators updated this week
  const indicatorsThisWeek = getIndicatorsUpdatedThisWeek(diagnosis.items, weekStart)
  
  // Get VIX value
  const vixItem = diagnosis.items.find((i: any) => {
    const key = (i.key || '').toLowerCase()
    return key === 'vix' || key === 'vixcls' || i.label?.toLowerCase().includes('vix')
  })
  const vixValue = vixItem?.value ?? null
  
  // Get high impact events (filter by importance)
  const highImpactEvents = nextWeekEvents.filter((e: any) => e.importancia === 'high')
  
  let message = `📊 RESUMEN SEMANAL COMPLETO\n`
  message += `Semana: ${weekStartStr} - ${weekEndStr}\n`
  
  // Add executive summary at the beginning
  const executiveSummary = buildExecutiveSummary(
    monetaryStance,
    macroContext,
    current,
    vixValue,
    highImpactEvents
  )
  message += executiveSummary
  
  // Postura monetaria
  message += `💰 POSTURA MONETARIA (Fed):\n`
  message += `${formatMonetaryStance(monetaryStance.stance)}`
  if (monetaryStance.fedFunds != null) {
    message += ` (${monetaryStance.fedFunds.toFixed(2)}%)\n`
  } else {
    message += `\n`
  }
  message += `\n`
  
  // Risk regime
  message += `📊 RÉGIMEN DE RIESGO:\n`
  message += `${macroContext.riskRegime}\n\n`
  
  // USD bias
  message += `💵 SESGO USD:\n`
  message += `${macroContext.usdBias}\n\n`
  
  // All pairs - filter correctly to avoid duplicates
  message += `📈 DIRECCIÓN DE PARES - PRÓXIMA SEMANA:\n\n`
  
  // FX pairs (only true FX, exclude XAU, BTC, ETH)
  const fxPairs = pairs.filter(p => {
    const par = p.par.toUpperCase()
    return par.includes('/') && 
           !par.includes('XAU') && 
           !par.includes('BTC') && 
           !par.includes('ETH')
  })
  if (fxPairs.length > 0) {
    message += `💱 FX:\n`
    for (const pair of fxPairs) {
      const action = formatPairAction(pair.accion)
      message += `  ${pair.par}: ${action}\n`
    }
    message += `\n`
  }
  
  // Metals (only XAU)
  const metals = pairs.filter(p => p.par.toUpperCase().includes('XAU'))
  if (metals.length > 0) {
    message += `🥇 METALES:\n`
    for (const pair of metals) {
      const action = formatPairAction(pair.accion)
      message += `  ${pair.par}: ${action}\n`
    }
    message += `\n`
  }
  
  // Crypto (only BTC and ETH)
  const crypto = pairs.filter(p => {
    const par = p.par.toUpperCase()
    return par.includes('BTC') || par.includes('ETH')
  })
  if (crypto.length > 0) {
    message += `₿ CRIPTO:\n`
    for (const pair of crypto) {
      const action = formatPairAction(pair.accion)
      message += `  ${pair.par}: ${action}\n`
    }
    message += `\n`
  }
  
  // Indices (only SPX and NDX)
  const indices = pairs.filter(p => {
    const par = p.par.toUpperCase()
    return par === 'SPX' || par === 'NDX'
  })
  if (indices.length > 0) {
    message += `📊 ÍNDICES:\n`
    for (const pair of indices) {
      const action = formatPairAction(pair.accion)
      message += `  ${pair.par}: ${action}\n`
    }
    message += `\n`
  }
  
  // Indicators updated this week
  if (indicatorsThisWeek.length > 0) {
    message += `📉 INDICADORES ACTUALIZADOS ESTA SEMANA:\n\n`
    
    // Group by category
    const byCategory = new Map<string, any[]>()
    for (const item of indicatorsThisWeek) {
      const cat = item.category || 'Otros'
      if (!byCategory.has(cat)) {
        byCategory.set(cat, [])
      }
      byCategory.get(cat)!.push(item)
    }
    
    // Category order
    const categoryOrder = ['inflation', 'growth', 'employment', 'monetary_policy', 'risk', 'external']
    const sortedCategories = Array.from(byCategory.entries()).sort((a, b) => {
      const idxA = categoryOrder.indexOf(a[0])
      const idxB = categoryOrder.indexOf(b[0])
      if (idxA === -1 && idxB === -1) return a[0].localeCompare(b[0])
      if (idxA === -1) return 1
      if (idxB === -1) return -1
      return idxA - idxB
    })
    
    for (const [category, items] of sortedCategories) {
      const categoryNames: Record<string, string> = {
        inflation: '💰 Inflación',
        growth: '📈 Crecimiento',
        employment: '👔 Empleo',
        monetary_policy: '🏦 Política Monetaria',
        risk: '⚠️ Riesgo',
        external: '🌍 Externa',
      }
      message += `${categoryNames[category] || category}:\n`
      
      for (const item of items) {
        const trend = formatTrend(item.trend)
        const valueStr = item.value != null ? item.value.toFixed(2) : 'N/A'
        const prevStr = item.value_previous != null ? item.value_previous.toFixed(2) : 'N/A'
        message += `  • ${item.label}: ${valueStr} (antes: ${prevStr}) ${trend}\n`
      }
      message += `\n`
    }
  } else {
    message += `📉 INDICADORES:\n`
    message += `✅ No hubo actualizaciones esta semana\n\n`
  }
  
  // Narrative changes
  if (changes.length === 0) {
    message += `📈 CAMBIOS DE NARRATIVA:\n`
    message += `✅ Sin cambios esta semana\n\n`
  } else {
    message += `📈 CAMBIOS DE NARRATIVA (${changes.length}):\n\n`
    
    // Group changes by day
    const changesByDay = new Map<string, NarrativeChange[]>()
    for (const change of changes) {
      const changeDate = new Date(change.cambiado_en)
      const madridDate = toZonedTime(changeDate, TIMEZONE)
      const dayKey = format(madridDate, 'dd/MM')
      
      if (!changesByDay.has(dayKey)) {
        changesByDay.set(dayKey, [])
      }
      changesByDay.get(dayKey)!.push(change)
    }
    
    // Format by day
    for (const [day, dayChanges] of Array.from(changesByDay.entries())) {
      message += `📅 ${day}:\n`
      for (const change of dayChanges) {
        const changeDate = new Date(change.cambiado_en)
        const madridDate = toZonedTime(changeDate, TIMEZONE)
        const timeStr = format(madridDate, 'HH:mm')
        
        const from = change.narrativa_anterior || 'NEUTRAL'
        const to = change.narrativa_actual
        
        message += `  ${timeStr} → ${formatNarrativeName(from)} → ${formatNarrativeName(to)}\n`
      }
      message += `\n`
    }
  }
  
  message += `Estado actual: ${formatNarrativeName(current)}\n`
  
  // Add extensive narrative
  const extensiveNarrative = buildExtensiveNarrative(
    monetaryStance,
    macroContext,
    diagnosis,
    indicatorsThisWeek,
    pairs,
    vixValue,
    highImpactEvents
  )
  message += extensiveNarrative
  
  return message
}

/**
 * Send weekly narrative summary
 */
export async function sendWeeklyNarrativeSummary(): Promise<{ success: boolean; error?: string; changeCount?: number }> {
  try {
    const changes = await getWeeklyNarrativeChanges()
    const message = await buildWeeklyNarrativeMessage()
    
    // Use queue for advanced rate limiting
    const useQueue = process.env.USE_MESSAGE_QUEUE !== 'false' // Default: true
    if (useQueue) {
      const testsEnabled = process.env.ENABLE_TELEGRAM_TESTS === 'true'
      const chatId = testsEnabled 
        ? process.env.TELEGRAM_TEST_CHAT_ID 
        : process.env.TELEGRAM_CHAT_ID
      
      if (!chatId) {
        return { success: false, error: 'Chat ID not configured' }
      }
      
      // Weekly summary has normal priority
      enqueueMessage(message, chatId, 'normal', 'weekly')
      incrementMetric('notification_sent_total', JSON.stringify({ type: 'narrative_weekly', status: 'queued' }))
      console.log(`[narrative-weekly] queued changeCount=${changes.length}`)
      return { success: true, changeCount: changes.length }
    } else {
      // Fallback to direct send (legacy mode)
      const result = await sendTelegramMessage(message, { noParseMode: true })
      const sentAtISO = new Date().toISOString()
      
      // Log to notification_history
      try {
        const { getUnifiedDB, isUsingTurso } = await import('@/lib/db/unified-db')
        const db = getUnifiedDB()
        // All methods are async now, so always use await
        await db.prepare(`
          INSERT INTO notification_history (tipo, mensaje, status, sent_at, created_at)
          VALUES (?, ?, ?, ?, ?)
        `).run(
          'narrative_weekly',
          message.substring(0, 200),
          result.success ? 'sent' : 'failed',
          result.success ? sentAtISO : null,
          sentAtISO
        )
      } catch (err) {
        console.warn('[narrative-weekly] Could not log to notification_history:', err)
      }
      
      if (result.success) {
        await incrementMetric('notification_sent_total', JSON.stringify({ type: 'narrative_weekly', status: 'sent' }))
        console.log(`[narrative-weekly] sent changeCount=${changes.length}`)
        return { success: true, changeCount: changes.length }
      } else {
        await incrementMetric('notification_sent_total', JSON.stringify({ type: 'narrative_weekly', status: 'failed' }))
        console.error(`[narrative-weekly] failed reason=${result.error || 'unknown'}`)
        return { success: false, error: result.error }
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('[narrative-weekly] Error:', errorMessage)
    return { success: false, error: errorMessage }
  }
}

