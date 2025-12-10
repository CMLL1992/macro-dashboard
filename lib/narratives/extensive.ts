/**
 * Extensive narrative generation for web pages
 * Genera narrativas extensas y detalladas para la página web
 */

import { getMacroDiagnosis } from '@/domain/diagnostic'
import { usdBias, macroQuadrant } from '@/domain/bias'
import { getCorrelationsForSymbol } from '@/lib/db/read'
import { norm } from '@/lib/symbols'
import { fedfunds } from '@/lib/fred'
import { postureOf } from '@/domain/posture'
import { fetchBiasInputs } from '@/lib/bias/inputs'
import { getCalendarEvents } from '@/lib/notifications/weekly'
import { getRecentNewsItems } from '@/lib/notifications/news'
import { format, startOfWeek, endOfWeek, addDays } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'
import type { LatestPoint } from '@/lib/fred'

const TIMEZONE = process.env.TIMEZONE || 'Europe/Madrid'

/**
 * Get weekly extensive narrative for the top of narratives page
 */
export async function getWeeklyExtensiveNarrative(): Promise<string> {
  const diagnosis = await getMacroDiagnosis()
  const items = diagnosis.items
  const usd = usdBias(items)
  const quad = macroQuadrant(items)

  // Get monetary policy stance
  let monetaryStance = { stance: 'Neutral', fedFunds: null as number | null }
  try {
    const fedFundsData = await fedfunds()
    monetaryStance = {
      stance: fedFundsData.value != null ? postureOf('FEDFUNDS', fedFundsData.value) : 'Neutral',
      fedFunds: fedFundsData.value,
    }
  } catch (error) {
    console.warn('[narratives/extensive] Could not fetch Fed stance:', error)
  }

  // Get macro context
  let macroContext = { riskRegime: 'NEUTRAL', usdBias: 'Neutral', eurusdDirection: 'Neutral' }
  try {
    const inputs = await fetchBiasInputs('US')
    macroContext = {
      riskRegime: inputs.risk_regime.regime,
      usdBias: inputs.usd_bias.direction === 'STRONG' ? 'Fuerte' : inputs.usd_bias.direction === 'WEAK' ? 'Débil' : 'Neutral',
      eurusdDirection: 'Neutral', // Can be enhanced
    }
  } catch (error) {
    console.warn('[narratives/extensive] Could not fetch macro context:', error)
  }

  // Get VIX
  const vixItem = items.find((i: any) => {
    const key = (i.key || '').toLowerCase()
    return key === 'vix' || key === 'vixcls' || i.label?.toLowerCase().includes('vix')
  })
  const vixValue = vixItem?.value ?? null

  // Get current week
  const nowUTC = new Date()
  const madridNow = toZonedTime(nowUTC, TIMEZONE)
  const weekStart = startOfWeek(madridNow, { weekStartsOn: 0 })
  const weekEnd = endOfWeek(madridNow, { weekStartsOn: 0 })
  const nextWeekStart = addDays(weekEnd, 1)
  const nextWeekEnd = addDays(nextWeekStart, 6)

  // Get calendar events
  const nextWeekEvents = await getCalendarEvents(
    format(nextWeekStart, 'yyyy-MM-dd'),
    format(nextWeekEnd, 'yyyy-MM-dd')
  )
  const highImpactEvents = nextWeekEvents.filter((e: any) => e.importancia === 'high')

  // Get recent news (only real news from database, not generated)
  const recentNews = getRecentNewsItems(10).filter(news => {
    // Only include news that has been actually published (not placeholder)
    return news.titulo && news.titulo.trim().length > 0 && news.published_at
  })

  // Build narrative
  let narrative = `# NARRATIVA SEMANAL - CONTEXTO MACROECONÓMICO\n\n`
  narrative += `**Semana:** ${format(weekStart, 'dd/MM/yyyy')} - ${format(weekEnd, 'dd/MM/yyyy')}\n\n`

  // Executive summary
  narrative += `## RESUMEN EJECUTIVO\n\n`
  narrative += `**Postura Monetaria:** ${formatMonetaryStance(monetaryStance.stance)}`
  if (monetaryStance.fedFunds != null) {
    narrative += ` (${monetaryStance.fedFunds.toFixed(2)}%)\n`
  } else {
    narrative += `\n`
  }
  narrative += `**Régimen de Riesgo:** ${macroContext.riskRegime}\n`
  narrative += `**Sesgo USD:** ${macroContext.usdBias}\n`
  if (vixValue != null && !isNaN(vixValue)) {
    narrative += `**VIX:** ${vixValue.toFixed(2)} (${getVIXInterpretation(vixValue)})\n`
  }
  narrative += `\n`

  // Monetary policy
  narrative += `## POSTURA MONETARIA - FED Y BCE\n\n`
  narrative += buildMonetaryPolicySection(monetaryStance, diagnosis, items)
  narrative += `\n`

  // Risk regime
  narrative += `## RÉGIMEN DE RIESGO\n\n`
  narrative += buildRiskRegimeSection(macroContext, diagnosis, items)
  narrative += `\n`

  // USD bias
  narrative += `## SESGO DEL DÓLAR (USD)\n\n`
  narrative += buildUSDBiasSection(macroContext, diagnosis, items)
  narrative += `\n`

  // VIX and volatility
  if (vixValue != null && !isNaN(vixValue)) {
    narrative += `## VOLATILIDAD Y VIX\n\n`
    narrative += buildVIXSection(vixValue)
    narrative += `\n`
  }

  // Recent news (only if we have real news)
  if (recentNews.length > 0) {
    narrative += `## NOTICIAS RECIENTES RELEVANTES\n\n`
    narrative += buildRecentNewsSection(recentNews.slice(0, 5))
    narrative += `\n`
  } else {
    narrative += `## NOTICIAS RECIENTES\n\n`
    narrative += `No hay noticias recientes disponibles esta semana. Las noticias se actualizan automáticamente cuando se insertan a través de la API de ingesta.\n\n`
  }

  // Upcoming events
  if (highImpactEvents.length > 0) {
    narrative += `## EVENTOS DE ALTO IMPACTO - PRÓXIMA SEMANA\n\n`
    narrative += buildUpcomingEventsSection(highImpactEvents)
    narrative += `\n`
  }

  // Market outlook
  narrative += `## PERSPECTIVA GENERAL DEL MERCADO\n\n`
  narrative += buildMarketOutlookSection(monetaryStance, macroContext, vixValue, quad)
  narrative += `\n`

  return narrative
}

/**
 * Build extensive narrative for a specific pair
 */
export async function getPairExtensiveNarrative(
  par: string,
  accion: string,
  tactico: string,
  confianza: 'Alta' | 'Media' | 'Baja',
  motivo: string | undefined,
  corr12m: number | null,
  corr3m: number | null
): Promise<string> {
  const diagnosis = await getMacroDiagnosis()
  const items = diagnosis.items
  const usd = usdBias(items)
  const symbol = norm(par)

  // Get correlations if not provided
  let corr12 = corr12m
  let corr3 = corr3m
  if (corr12 == null || corr3 == null) {
    const corr = symbol ? await getCorrelationsForSymbol(symbol, 'DXY') : { corr12m: null, corr3m: null }
    corr12 = corr.corr12m
    corr3 = corr.corr3m
  }

  // Build narrative
  let narrative = `# NARRATIVA DETALLADA - ${par}\n\n`

  // Summary
  narrative += `## RESUMEN\n\n`
  narrative += `**Dirección:** ${tactico === 'Neutral' ? 'Rango/Táctico' : tactico}\n`
  narrative += `**Acción Recomendada:** ${accion}\n`
  narrative += `**Confianza:** ${confianza}\n`
  narrative += `**Motivo Macro:** ${motivo || 'No especificado'}\n\n`

  // Why this direction
  narrative += `## ¿POR QUÉ ESTA DIRECCIÓN?\n\n`
  narrative += buildDirectionRationale(par, tactico, accion, usd, corr12, corr3, motivo)
  narrative += `\n`

  // Correlation analysis
  narrative += `## ANÁLISIS DE CORRELACIÓN CON USD\n\n`
  narrative += buildCorrelationAnalysis(par, corr12, corr3, usd)
  narrative += `\n`

  // Macro drivers
  narrative += `## DRIVERS MACROECONÓMICOS\n\n`
  narrative += buildMacroDriversSection(par, items, usd)
  narrative += `\n`

  // Trading implications
  narrative += `## IMPLICACIONES PARA EL TRADING\n\n`
  narrative += buildTradingImplications(par, tactico, confianza, corr12, corr3)
  narrative += `\n`

  // Risk factors
  narrative += `## FACTORES DE RIESGO\n\n`
  narrative += buildRiskFactors(par, confianza, corr12, corr3)
  narrative += `\n`

  return narrative
}

// Helper functions

function formatMonetaryStance(stance: string): string {
  const map: Record<string, string> = {
    'Hawkish': 'HAWKISH (Restrictiva)',
    'Dovish': 'DOVISH (Acomodaticia)',
    'Neutral': 'NEUTRAL',
  }
  return map[stance] || stance
}

function getVIXInterpretation(vixValue: number): string {
  if (vixValue < 15) return 'BAJA (Mercado tranquilo, condiciones favorables)'
  if (vixValue <= 25) return 'MODERADA (Volatilidad normal)'
  return 'ALTA (Aversión al riesgo, volatilidad elevada)'
}

function buildMonetaryPolicySection(
  monetaryStance: { stance: string; fedFunds: number | null },
  diagnosis: any,
  items: LatestPoint[]
): string {
  let section = ''
  const fedFunds = monetaryStance.fedFunds

  if (monetaryStance.stance === 'Hawkish') {
    section += `La **Reserva Federal (FED)** mantiene una postura **HAWKISH (restrictiva)** con tipos de interés en **${fedFunds?.toFixed(2) || 'N/A'}%**.\n\n`
    section += `Esta postura restrictiva se justifica por:\n\n`
    
    const inflationIndicators = items.filter((i: any) => 
      (i.key === 'CPIAUCSL' || i.key === 'PCEPI' || i.key === 'PCEPILFE') && i.value != null && i.value > 2.5
    )
    if (inflationIndicators.length > 0) {
      section += `- **Inflación persistente:** ${inflationIndicators.map((i: any) => `${i.label} en ${i.value?.toFixed(2)}%`).join(', ')}\n`
    }
    
    const employmentIndicators = items.filter((i: any) => {
      if (i.key === 'UNRATE') return i.value != null && i.value < 4
      if (i.key === 'PAYEMS') return i.value != null && i.value > 200
      return false
    })
    if (employmentIndicators.length > 0) {
      section += `- **Mercado laboral sólido:** ${employmentIndicators.map((i: any) => `${i.label} ${i.key === 'UNRATE' ? i.value?.toFixed(2) + '%' : i.value?.toFixed(0)}`).join(', ')}\n`
    }
    
    section += `\nLa FED prioriza el **control de la inflación** sobre el crecimiento económico, manteniendo tipos altos para enfriar la demanda y reducir las presiones inflacionarias. Esto atrae capital hacia el dólar, fortaleciéndolo frente a otras monedas.\n\n`
  } else if (monetaryStance.stance === 'Dovish') {
    section += `La **Reserva Federal (FED)** adopta una postura **DOVISH (acomodaticia)** con tipos de interés en **${fedFunds?.toFixed(2) || 'N/A'}%**.\n\n`
    section += `Esta postura se justifica por:\n\n`
    
    const inflationIndicators = items.filter((i: any) => 
      (i.key === 'CPIAUCSL' || i.key === 'PCEPI') && i.value != null && i.value < 2.5
    )
    if (inflationIndicators.length > 0) {
      section += `- **Inflación controlada:** ${inflationIndicators.map((i: any) => `${i.label} en ${i.value?.toFixed(2)}%`).join(', ')}\n`
    }
    
    const growthIndicators = items.filter((i: any) => 
      (i.key === 'GDPC1' || i.key === 'INDPRO') && i.value != null && i.value < 2
    )
    if (growthIndicators.length > 0) {
      section += `- **Crecimiento moderado:** ${growthIndicators.map((i: any) => `${i.label} en ${i.value?.toFixed(2)}%`).join(', ')}\n`
    }
    
    section += `\nLa FED busca **estimular la economía** reduciendo las restricciones monetarias. Esto debilita el dólar al hacer que los activos en USD sean menos atractivos para inversores internacionales.\n\n`
  } else {
    section += `La **Reserva Federal (FED)** mantiene una postura **NEUTRAL** con tipos de interés en **${fedFunds?.toFixed(2) || 'N/A'}%**.\n\n`
    section += `Señales mixtas entre inflación y crecimiento sugieren mantener la política actual sin cambios significativos. El mercado espera más claridad sobre la dirección futura de la política monetaria.\n\n`
  }

  return section
}

function buildRiskRegimeSection(
  macroContext: { riskRegime: string; usdBias: string },
  diagnosis: any,
  items: LatestPoint[]
): string {
  let section = ''
  
  if (macroContext.riskRegime === 'RISK_ON') {
    section += `El mercado se encuentra en modo **RISK ON**, indicando **apetito por activos de riesgo**.\n\n`
    
    const growthIndicators = items.filter((i: any) => 
      i.trend === 'Mejora' && (i.category === 'growth' || i.key === 'GDPC1' || i.key === 'INDPRO')
    )
    if (growthIndicators.length > 0) {
      section += `**Factores positivos:**\n`
      section += `- ${growthIndicators.slice(0, 3).map((i: any) => `${i.label} mostrando mejoras`).join('\n- ')}\n\n`
    }
    
    section += `**Implicaciones:**\n`
    section += `- Favorece activos de riesgo: **acciones** (SPX, NDX), **criptomonedas** (BTC, ETH), **pares de riesgo** (AUD/USD, GBP/USD)\n`
    section += `- Presiona a la baja activos refugio: USD, JPY, bonos\n`
    section += `- El oro puede comportarse de manera mixta dependiendo de la fortaleza del dólar\n\n`
  } else if (macroContext.riskRegime === 'RISK_OFF') {
    section += `El mercado se encuentra en modo **RISK OFF**, indicando **aversión al riesgo**.\n\n`
    
    const negativeIndicators = items.filter((i: any) => 
      i.trend === 'Empeora'
    )
    if (negativeIndicators.length > 0) {
      section += `**Factores negativos:**\n`
      section += `- ${negativeIndicators.slice(0, 3).map((i: any) => `${i.label} mostrando deterioro`).join('\n- ')}\n\n`
    }
    
    section += `**Implicaciones:**\n`
    section += `- Favorece activos refugio: **USD**, **JPY**, **oro** (XAU/USD)\n`
    section += `- Presiona a la baja activos de riesgo: acciones, cripto, pares de riesgo\n`
    section += `- Los inversores buscan seguridad y liquidez\n\n`
  } else {
    section += `El mercado se encuentra en modo **NEUTRAL**, con **señales mixtas**.\n\n`
    section += `**Implicaciones:**\n`
    section += `- Se recomienda **trading táctico** basado en price action\n`
    section += `- Confirmar señales con múltiples indicadores\n`
    section += `- Los movimientos pueden ser más erráticos y menos direccionales\n\n`
  }

  return section
}

function buildUSDBiasSection(
  macroContext: { riskRegime: string; usdBias: string },
  diagnosis: any,
  items: LatestPoint[]
): string {
  let section = ''
  
  if (macroContext.usdBias === 'Fuerte') {
    section += `El **USD muestra fortaleza** debido a:\n\n`
    
    const hawkishIndicators = items.filter((i: any) => 
      i.posture === 'Hawkish' && i.value != null
    )
    if (hawkishIndicators.length > 0) {
      section += `- **Postura hawkish de la FED:** Tipos de interés altos atraen capital hacia el dólar\n`
      section += `- **Indicadores macro positivos:** ${hawkishIndicators.slice(0, 2).map((i: any) => i.label).join(', ')}\n\n`
    }
    
    section += `**Impacto en los mercados:**\n`
    section += `- Presiona a la baja: **EUR/USD**, **GBP/USD**, **AUD/USD**, **oro** (XAU/USD)\n`
    section += `- Favorece: **USD/JPY**, **USD/CAD**\n`
    section += `- Los activos denominados en dólares se vuelven más caros para inversores internacionales\n\n`
  } else if (macroContext.usdBias === 'Débil') {
    section += `El **USD muestra debilidad** debido a:\n\n`
    
    const dovishIndicators = items.filter((i: any) => 
      i.posture === 'Dovish' && i.value != null
    )
    if (dovishIndicators.length > 0) {
      section += `- **Expectativas de recortes de tipos:** La FED podría reducir tipos en el futuro\n`
      section += `- **Indicadores macro mixtos:** ${dovishIndicators.slice(0, 2).map((i: any) => i.label).join(', ')}\n\n`
    }
    
    section += `**Impacto en los mercados:**\n`
    section += `- Favorece: **EUR/USD**, **GBP/USD**, **AUD/USD**, **oro** (XAU/USD)\n`
    section += `- Presiona a la baja: **USD/JPY**, **USD/CAD**\n`
    section += `- Los activos denominados en otras monedas se vuelven más atractivos\n\n`
  } else {
    section += `El **USD se mantiene neutral**, con fuerzas equilibradas.\n\n`
    section += `**Implicaciones:**\n`
    section += `- Se recomienda **trading táctico** basado en price action y eventos específicos\n`
    section += `- Los movimientos del dólar serán más dependientes de factores específicos de cada par\n\n`
  }

  return section
}

function buildVIXSection(vixValue: number): string {
  let section = ''
  section += `**Nivel actual del VIX:** ${vixValue.toFixed(2)}\n\n`
  section += `**Interpretación:** ${getVIXInterpretation(vixValue)}\n\n`
  
  if (vixValue > 25) {
    section += `**Implicaciones:**\n`
    section += `- Alta volatilidad sugiere **aversión al riesgo** en el mercado\n`
    section += `- Considerar **reducir exposición** y esperar mayor claridad\n`
    section += `- Los movimientos pueden ser más erráticos y difíciles de predecir\n`
    section += `- Favorece estrategias defensivas y de cobertura\n\n`
  } else if (vixValue < 15) {
    section += `**Implicaciones:**\n`
    section += `- Baja volatilidad indica **condiciones favorables** para activos de riesgo\n`
    section += `- El mercado muestra confianza y estabilidad\n`
    section += `- Favorece estrategias de tendencia y carry trade\n\n`
  } else {
    section += `**Implicaciones:**\n`
    section += `- Volatilidad moderada, **condiciones normales** de mercado\n`
    section += `- Los movimientos siguen patrones típicos\n`
    section += `- Estrategias estándar de trading son apropiadas\n\n`
  }

  return section
}

function buildRecentNewsSection(news: any[]): string {
  let section = ''
  for (const item of news) {
    section += `- **${item.titulo}**`
    if (item.fuente) section += ` (${item.fuente})`
    if (item.valor_publicado != null && item.valor_esperado != null) {
      const diff = item.valor_publicado - item.valor_esperado
      section += ` - Publicado: ${item.valor_publicado.toFixed(2)}, Esperado: ${item.valor_esperado.toFixed(2)} (${diff > 0 ? '+' : ''}${diff.toFixed(2)})`
    }
    section += `\n`
  }
  return section
}

function buildUpcomingEventsSection(events: any[]): string {
  let section = ''
  const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
  
  for (const event of events.slice(0, 5)) {
    const date = new Date(event.fecha)
    const dateStr = format(date, 'dd/MM/yyyy')
    const dayName = dayNames[date.getDay()]
    section += `- **${dayName} ${dateStr}** ${event.hora_local || ''}\n`
    section += `  ${event.evento} (${event.pais || 'N/A'})`
    if (event.consenso) {
      section += ` - Consenso: ${event.consenso}`
    }
    section += `\n\n`
  }
  
  section += `Estos eventos pueden generar **volatilidad significativa**. Monitorear especialmente decisiones de FOMC, NFP, CPI y decisiones del BCE.\n`
  
  return section
}

function buildMarketOutlookSection(
  monetaryStance: { stance: string; fedFunds: number | null },
  macroContext: { riskRegime: string; usdBias: string },
  vixValue: number | null,
  quad: string
): string {
  let section = ''
  
  section += `**Contexto actual:**\n\n`
  section += `- Postura monetaria: ${formatMonetaryStance(monetaryStance.stance)}\n`
  section += `- Régimen de riesgo: ${macroContext.riskRegime}\n`
  section += `- Sesgo USD: ${macroContext.usdBias}\n`
  if (vixValue != null) {
    section += `- VIX: ${vixValue.toFixed(2)} (${getVIXInterpretation(vixValue)})\n`
  }
  section += `- Cuadrante macro: ${quad}\n\n`
  
  section += `**Perspectiva general:**\n\n`
  
  if (monetaryStance.stance === 'Hawkish' && macroContext.riskRegime === 'RISK_OFF') {
    section += `El entorno actual combina política monetaria restrictiva con aversión al riesgo. Esto favorece al dólar y activos refugio, mientras presiona a la baja activos de riesgo. Se recomienda cautela y enfoque defensivo.\n\n`
  } else if (monetaryStance.stance === 'Dovish' && macroContext.riskRegime === 'RISK_ON') {
    section += `El entorno actual combina política monetaria acomodaticia con apetito por riesgo. Esto favorece activos de riesgo como acciones y cripto, mientras debilita el dólar. Se recomienda enfoque pro-cíclico.\n\n`
  } else {
    section += `El entorno actual muestra señales mixtas. Se recomienda trading táctico con confirmación de múltiples indicadores y price action. Los movimientos pueden ser más erráticos y menos direccionales.\n\n`
  }
  
  section += `**⚠️ Importante:** Estos sesgos son válidos para los próximos 3-10 días. Siempre confirmar con price action en marcos temporales D/H4 antes de operar.\n`
  
  return section
}

function buildDirectionRationale(
  par: string,
  tactico: string,
  accion: string,
  usd: 'Fuerte' | 'Débil' | 'Neutral',
  corr12: number | null,
  corr3: number | null,
  motivo: string | undefined
): string {
  let section = ''
  
  const parUpper = par.toUpperCase()
  const isFX = parUpper.includes('/') && !parUpper.includes('XAU') && !parUpper.includes('BTC') && !parUpper.includes('ETH')
  const isMetal = parUpper.includes('XAU')
  const isCrypto = parUpper.includes('BTC') || parUpper.includes('ETH')
  const isIndex = parUpper === 'SPX' || parUpper === 'NDX'
  
  section += `El sesgo **${tactico === 'Neutral' ? 'Rango/Táctico' : tactico}** para ${par} se fundamenta en:\n\n`
  
  // Correlation explanation
  if (corr12 != null) {
    const corrAbs = Math.abs(corr12)
    const isNegative = corr12 < 0
    const strength = corrAbs >= 0.6 ? 'fuerte' : corrAbs >= 0.3 ? 'moderada' : 'débil'
    
    section += `1. **Correlación con USD:** ${par} tiene una correlación ${isNegative ? 'negativa' : 'positiva'} ${strength} (${corr12.toFixed(2)}) con el dólar en 12 meses.\n`
    
    if (isNegative) {
      if (usd === 'Fuerte') {
        section += `   - Con USD fuerte, ${par} tiende a **caer** debido a la relación inversa.\n`
      } else if (usd === 'Débil') {
        section += `   - Con USD débil, ${par} tiende a **subir** debido a la relación inversa.\n`
      }
    } else {
      if (usd === 'Fuerte') {
        section += `   - Con USD fuerte, ${par} tiende a **subir** debido a la relación directa.\n`
      } else if (usd === 'Débil') {
        section += `   - Con USD débil, ${par} tiende a **caer** debido a la relación directa.\n`
      }
    }
    section += `\n`
  }
  
  // Asset-specific factors
  if (isFX) {
    section += `2. **Factores específicos de divisas:**\n`
    if (parUpper.includes('EUR')) {
      section += `   - El EUR se ve afectado por la política del BCE y la situación económica de la zona euro.\n`
    }
    if (parUpper.includes('GBP')) {
      section += `   - El GBP responde a la política del Banco de Inglaterra y datos económicos del Reino Unido.\n`
    }
    if (parUpper.includes('AUD')) {
      section += `   - El AUD es sensible al apetito por riesgo y a los precios de commodities.\n`
    }
    if (parUpper.includes('JPY')) {
      section += `   - El JPY actúa como activo refugio y se fortalece en entornos de riesgo.\n`
    }
    section += `\n`
  } else if (isMetal) {
    section += `2. **Factores específicos del oro:**\n`
    section += `   - El oro tiene correlación negativa fuerte con el USD.\n`
    section += `   - Se beneficia de la debilidad del dólar y de la incertidumbre geopolítica.\n`
    section += `   - También responde a expectativas de inflación y tipos de interés reales.\n\n`
  } else if (isCrypto) {
    section += `2. **Factores específicos de cripto:**\n`
    section += `   - Las criptomonedas son activos de riesgo y se benefician de entornos RISK ON.\n`
    section += `   - También responden a la debilidad del dólar y a la adopción institucional.\n`
    section += `   - La volatilidad puede ser alta independientemente de factores macro.\n\n`
  } else if (isIndex) {
    section += `2. **Factores específicos de índices:**\n`
    section += `   - Los índices de acciones se benefician de entornos RISK ON y crecimiento económico.\n`
    section += `   - Responden a expectativas de beneficios corporativos y política monetaria.\n`
    section += `   - La debilidad del dólar puede favorecer a empresas exportadoras.\n\n`
  }
  
  // Motivo macro
  if (motivo) {
    section += `3. **Motivo macro específico:** ${motivo}\n\n`
  }
  
  // Divergence warning
  if (corr12 != null && corr3 != null) {
    const abs12 = Math.abs(corr12)
    const abs3 = Math.abs(corr3)
    const sameSign = corr12 * corr3 >= 0
    
    if (!sameSign && abs12 >= 0.3 && abs3 >= 0.3) {
      section += `⚠️ **Advertencia:** Hay divergencia entre la correlación de 12m (${corr12.toFixed(2)}) y 3m (${corr3.toFixed(2)}). Esto reduce la confianza en el sesgo y sugiere que la relación histórica puede estar cambiando.\n\n`
    }
  }
  
  return section
}

function buildCorrelationAnalysis(
  par: string,
  corr12: number | null,
  corr3: number | null,
  usd: 'Fuerte' | 'Débil' | 'Neutral'
): string {
  let section = ''
  
  if (corr12 == null && corr3 == null) {
    section += `No hay datos de correlación disponibles para ${par}.\n\n`
    return section
  }
  
  section += `**Correlación 12 meses:** ${corr12 != null ? corr12.toFixed(2) : 'N/A'}\n`
  section += `**Correlación 3 meses:** ${corr3 != null ? corr3.toFixed(2) : 'N/A'}\n\n`
  
  if (corr12 != null) {
    const abs12 = Math.abs(corr12)
    const isNegative = corr12 < 0
    const strength = abs12 >= 0.6 ? 'muy fuerte' : abs12 >= 0.3 ? 'moderada' : 'débil'
    
    section += `**Interpretación:**\n`
    section += `- La correlación de 12 meses es ${isNegative ? 'negativa' : 'positiva'} y ${strength}.\n`
    
    if (abs12 >= 0.6) {
      section += `- Esto indica una relación **muy estable** entre ${par} y el USD.\n`
      section += `- El sesgo direccional basado en el USD tiene **alta confianza**.\n`
    } else if (abs12 >= 0.3) {
      section += `- Esto indica una relación **moderada** entre ${par} y el USD.\n`
      section += `- El sesgo direccional tiene **confianza media**, pero otros factores también influyen.\n`
    } else {
      section += `- Esto indica una relación **débil** entre ${par} y el USD.\n`
      section += `- El sesgo direccional tiene **baja confianza**; priorizar otros drivers.\n`
    }
    section += `\n`
  }
  
  if (corr12 != null && corr3 != null) {
    const abs12 = Math.abs(corr12)
    const abs3 = Math.abs(corr3)
    const sameSign = corr12 * corr3 >= 0
    const diff = Math.abs(abs12 - abs3)
    
    if (diff > 0.2) {
      if (abs3 > abs12) {
        section += `**Cambio reciente:** La correlación de 3 meses (${corr3.toFixed(2)}) es más fuerte que la de 12 meses, sugiriendo que la relación se está **intensificando**.\n\n`
      } else {
        section += `**Cambio reciente:** La correlación de 3 meses (${corr3.toFixed(2)}) es más débil que la de 12 meses, sugiriendo que la relación se está **debilitando**.\n\n`
      }
    }
    
    if (!sameSign) {
      section += `⚠️ **Advertencia:** Las correlaciones tienen signos opuestos, lo que indica un **cambio de régimen**. La relación histórica puede no aplicarse en el corto plazo.\n\n`
    }
  }
  
  section += `**Impacto del sesgo USD actual (${usd}):**\n`
  if (corr12 != null) {
    const isNegative = corr12 < 0
    if (isNegative) {
      if (usd === 'Fuerte') {
        section += `- Con USD fuerte y correlación negativa, ${par} tiene sesgo **bajista**.\n`
      } else if (usd === 'Débil') {
        section += `- Con USD débil y correlación negativa, ${par} tiene sesgo **alcista**.\n`
      } else {
        section += `- Con USD neutral, la correlación negativa tiene menos impacto.\n`
      }
    } else {
      if (usd === 'Fuerte') {
        section += `- Con USD fuerte y correlación positiva, ${par} tiene sesgo **alcista**.\n`
      } else if (usd === 'Débil') {
        section += `- Con USD débil y correlación positiva, ${par} tiene sesgo **bajista**.\n`
      } else {
        section += `- Con USD neutral, la correlación positiva tiene menos impacto.\n`
      }
    }
  }
  section += `\n`
  
  return section
}

function buildMacroDriversSection(
  par: string,
  items: LatestPoint[],
  usd: 'Fuerte' | 'Débil' | 'Neutral'
): string {
  let section = ''
  
  // Get top drivers
  const topDrivers = items
    .filter((i: any) => i.value != null && (i as any).posture !== 'Neutral')
    .sort((a: any, b: any) => {
      const aWeight = Math.abs(a.value || 0)
      const bWeight = Math.abs(b.value || 0)
      return bWeight - aWeight
    })
    .slice(0, 5) as Array<LatestPoint & { posture?: string; trend?: string }>
  
  if (topDrivers.length > 0) {
    section += `Los principales drivers macroeconómicos que afectan a ${par} son:\n\n`
    
    for (const driver of topDrivers) {
      const posture = (driver as any).posture || 'Neutral'
      section += `- **${driver.label}:** ${driver.value?.toFixed(2)} (Postura: ${posture})\n`
      if ((driver as any).trend) {
        section += `  - Tendencia: ${(driver as any).trend}\n`
      }
    }
    section += `\n`
  }
  
  section += `**Sesgo USD actual:** ${usd}\n`
  section += `- Este es uno de los drivers más importantes para ${par}, especialmente si tiene correlación fuerte con el dólar.\n\n`
  
  return section
}

function buildTradingImplications(
  par: string,
  tactico: string,
  confianza: 'Alta' | 'Media' | 'Baja',
  corr12: number | null,
  corr3: number | null
): string {
  let section = ''
  
  section += `**Dirección recomendada:** ${tactico === 'Neutral' ? 'Rango/Táctico' : tactico}\n\n`
  
  if (tactico === 'Alcista') {
    section += `**Estrategia sugerida:**\n`
    section += `- Buscar **oportunidades de compra** en correcciones o retrocesos\n`
    section += `- Confirmar con price action en marcos temporales D/H4\n`
    section += `- Considerar entradas escalonadas si la confianza es media o baja\n`
  } else if (tactico === 'Bajista') {
    section += `**Estrategia sugerida:**\n`
    section += `- Buscar **oportunidades de venta** en rallies o rebotes\n`
    section += `- Confirmar con price action en marcos temporales D/H4\n`
    section += `- Considerar entradas escalonadas si la confianza es media o baja\n`
  } else {
    section += `**Estrategia sugerida:**\n`
    section += `- Trading **táctico** y **rango**\n`
    section += `- Buscar rebotes en soportes y ventas en resistencias\n`
    section += `- Confirmar con price action y múltiples indicadores\n`
  }
  section += `\n`
  
  section += `**Nivel de confianza:** ${confianza}\n`
  if (confianza === 'Alta') {
    section += `- Puedes considerar posiciones más grandes y mantenerlas por más tiempo\n`
    section += `- El sesgo tiene alta probabilidad de cumplirse\n`
  } else if (confianza === 'Media') {
    section += `- Considera posiciones moderadas y confirma con price action\n`
    section += `- El sesgo tiene probabilidad media de cumplirse\n`
  } else {
    section += `- Considera posiciones pequeñas y confirma con múltiples señales\n`
    section += `- El sesgo tiene baja probabilidad de cumplirse; priorizar price action\n`
  }
  section += `\n`
  
  section += `**Marco temporal:**\n`
  section += `- Este sesgo es válido para los próximos **3-10 días**\n`
  section += `- Revisar y actualizar según nuevos datos macro y cambios en el mercado\n`
  section += `- Siempre usar stop loss y gestión de riesgo adecuada\n\n`
  
  return section
}

function buildRiskFactors(
  par: string,
  confianza: 'Alta' | 'Media' | 'Baja',
  corr12: number | null,
  corr3: number | null
): string {
  let section = ''
  
  section += `**Factores que pueden invalidar el sesgo:**\n\n`
  
  if (confianza === 'Baja') {
    section += `- **Confianza baja:** El sesgo tiene menor probabilidad de cumplirse\n`
  }
  
  if (corr12 != null && corr3 != null) {
    const abs12 = Math.abs(corr12)
    const abs3 = Math.abs(corr3)
    const sameSign = corr12 * corr3 >= 0
    
    if (abs12 < 0.3) {
      section += `- **Correlación débil:** La relación con el USD es débil, otros factores pueden dominar\n`
    }
    
    if (!sameSign && abs12 >= 0.3 && abs3 >= 0.3) {
      section += `- **Divergencia de correlaciones:** La relación histórica puede estar cambiando\n`
    }
  }
  
  section += `- **Eventos inesperados:** Noticias geopolíticas, decisiones de bancos centrales, datos macro sorpresa\n`
  section += `- **Cambios de régimen:** Cambios abruptos en el apetito por riesgo o política monetaria\n`
  section += `- **Factores técnicos:** Rupturas de niveles clave, cambios en el sentimiento del mercado\n\n`
  
  section += `**Recomendaciones de gestión de riesgo:**\n`
  section += `- Usar **stop loss** apropiado según el marco temporal y volatilidad\n`
  section += `- No arriesgar más del 1-2% del capital por operación\n`
  section += `- Considerar reducir el tamaño de la posición si la confianza es baja\n`
  section += `- Monitorear eventos del calendario económico que puedan afectar a ${par}\n\n`
  
  return section
}

