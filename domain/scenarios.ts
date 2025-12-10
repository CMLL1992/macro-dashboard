import type { Posture } from './posture'
import type { BiasRow } from './bias'

export type Scenario = { 
  id: string
  title: string
  severity: 'alta' | 'media' | 'baja'
  why: string
  actionHint: string
  // Nuevos campos para escenarios institucionales
  pair?: string
  direction?: 'BUY' | 'SELL'
  confidence?: 'Alta' | 'Media' | 'Baja'
  macroReasons?: string[]
  setupRecommendation?: string
}

export type ScenariosGrouped = {
  active: Scenario[]      // Confianza Alta
  watchlist: Scenario[]  // Confianza Media
}

/**
 * Tipo compatible con TacticalBiasRow para escenarios
 */
type TacticalRowForScenarios = {
  par?: string
  pair?: string
  sesgoMacro?: string
  accion?: string
  action?: string
  motivo?: string
  confianza?: string
  confidence?: string
  trend?: string
}

/**
 * SMOKE TEST: Versión simplificada para diagnosticar problemas
 * Ignora usdBias y solo filtra por acción, confianza y símbolos
 */
type Confidence = 'alta' | 'media' | 'baja'

interface TacticalRow {
  symbol: string       // "EUR/USD"
  action: string      // "Buscar compras" | "Buscar ventas" | "Rango/táctico"
  confidence: string  // "Alta" | "Media" | "Baja"
}

interface InstitutionalScenario {
  symbol: string
  direction: 'buy' | 'sell'
  confidence: Confidence
}

/**
 * Genera escenarios institucionales basados en el método:
 * Macro decide dirección → Confianza decide si operamos → Técnicos definen timing
 * Retorna escenarios agrupados en Activos (Alta) y Watchlist (Media)
 * 
 * SMOKE TEST VERSION: Simplificada para diagnosticar problemas
 */
export function getInstitutionalScenarios(
  tacticalRows: TacticalRowForScenarios[],
  usdBias: 'Fuerte' | 'Débil' | 'Neutral',
  regime: string
): ScenariosGrouped {
  // Normalizar campos básicos
  const normalizeSymbol = (s: string) => {
    if (!s) return ''
    return s.replace('/', '').replace('_', '').toUpperCase()
  }

  const normalizeConfidence = (c: string): Confidence => {
    if (!c) return 'baja'
    const v = c.toLowerCase()
    if (v.startsWith('alta') || v === 'high') return 'alta'
    if (v.startsWith('media') || v === 'medium') return 'media'
    return 'baja'
  }

  const isDirectional = (a: string) => {
    if (!a) return false
    const actionLower = a.toLowerCase()
    return actionLower.startsWith('buscar compras') || 
           actionLower.startsWith('buscar ventas') ||
           actionLower.startsWith('buy') ||
           actionLower.startsWith('sell')
  }

  // Lista de pares institucionales (para priorizar, pero no limitar)
  const INSTITUTIONAL = ['EURUSD', 'GBPUSD', 'XAUUSD', 'AUDUSD', 'NZDUSD', 'USDJPY', 'USDCAD', 'USDCHF']

  // Normalizar rows a formato simple
  const normalizedRows: TacticalRow[] = tacticalRows.map(row => ({
    symbol: (row.par ?? row.pair ?? row.symbol ?? '').toString(),
    action: (row.accion ?? row.action ?? '').toString(),
    confidence: (row.confianza ?? row.confidence ?? 'Media').toString(),
  }))

  // Log para diagnóstico
  console.log('[getInstitutionalScenarios] tacticalRows count:', tacticalRows.length)
  console.log('[getInstitutionalScenarios] sample rows:', normalizedRows.slice(0, 5))
  console.log('[getInstitutionalScenarios] usdBias:', usdBias)

  // Filtrar y generar escenarios - MOSTRAR TODOS los pares con dirección clara y confianza Alta/Media
  // No limitar solo a pares institucionales, mostrar todos los que cumplan criterios
  let scenarios: InstitutionalScenario[] = normalizedRows
    .filter((row) => isDirectional(row.action))
    .map((row) => {
      const symbolNorm = normalizeSymbol(row.symbol)
      const confidence = normalizeConfidence(row.confidence)

      // NO filtrar por INSTITUTIONAL - mostrar todos los pares con dirección clara
      // Solo verificar que tenga confianza Alta o Media
      if (confidence !== 'alta' && confidence !== 'media') return null

      const direction: 'buy' | 'sell' =
        row.action.toLowerCase().startsWith('buscar compras') || 
        row.action.toLowerCase().startsWith('buy')
          ? 'buy' 
          : 'sell'

      return {
        symbol: row.symbol,
        direction,
        confidence,
      }
    })
    .filter((x): x is InstitutionalScenario => x !== null)
  
  // Priorizar pares institucionales (ponerlos primero), pero incluir todos
  scenarios.sort((a, b) => {
    const aNorm = normalizeSymbol(a.symbol)
    const bNorm = normalizeSymbol(b.symbol)
    const aIsInstitutional = INSTITUTIONAL.includes(aNorm)
    const bIsInstitutional = INSTITUTIONAL.includes(bNorm)
    
    // Pares institucionales primero
    if (aIsInstitutional && !bIsInstitutional) return -1
    if (!aIsInstitutional && bIsInstitutional) return 1
    
    // Luego por confianza (Alta primero)
    if (a.confidence === 'alta' && b.confidence !== 'alta') return -1
    if (a.confidence !== 'alta' && b.confidence === 'alta') return 1
    
    // Finalmente alfabéticamente
    return a.symbol.localeCompare(b.symbol)
  })

  // Aplicar filtro de usdBias si no es Neutral
  if (usdBias !== 'Neutral') {
    const usdBiasLower = usdBias.toLowerCase()
    const isHawkish = usdBiasLower === 'fuerte' || usdBiasLower === 'hawkish'
    const isDovish = usdBiasLower === 'débil' || usdBiasLower === 'dovish'
    
    if (isHawkish) {
      // USD Hawkish → Solo SELL en pares contra USD
      scenarios = scenarios.filter(s => s.direction === 'sell')
      console.log('[getInstitutionalScenarios] USD Hawkish - filtered to SELL only:', scenarios.length)
    } else if (isDovish) {
      // USD Dovish → Solo BUY en pares contra USD
      scenarios = scenarios.filter(s => s.direction === 'buy')
      console.log('[getInstitutionalScenarios] USD Dovish - filtered to BUY only:', scenarios.length)
    }
  } else {
    // USD Neutral → Mostrar solo confianza Alta (si hay)
    // Si no hay Alta, mostrar Media también
    const hasAlta = scenarios.some(s => s.confidence === 'alta')
    if (hasAlta) {
      scenarios = scenarios.filter(s => s.confidence === 'alta')
      console.log('[getInstitutionalScenarios] USD Neutral - showing only Alta confidence:', scenarios.length)
    } else {
      console.log('[getInstitutionalScenarios] USD Neutral - no Alta, showing Media:', scenarios.filter(s => s.confidence === 'media').length)
    }
  }

  const active = scenarios.filter((s) => s.confidence === 'alta')
  const watchlist = scenarios.filter((s) => s.confidence === 'media')

  console.log('[getInstitutionalScenarios] Final scenarios found:', scenarios.length)
  console.log('[getInstitutionalScenarios] active:', active.length, 'watchlist:', watchlist.length)

  // Convertir a formato Scenario para compatibilidad con UI
  const activeScenarios: Scenario[] = active.map((s, index) => {
    const usdBiasLabel = usdBias === 'Fuerte' ? 'USD Hawkish' : usdBias === 'Débil' ? 'USD Dovish' : 'USD Neutral'
    const macroReasons = [
      usdBiasLabel,
      'Confianza Alta',
      `Sesgo macro claro en ${s.symbol}`,
    ]
    
    return {
      id: `institutional_active_${index + 1}`,
      title: `${s.symbol} – ${s.direction.toUpperCase()} (Institucional setup)`,
      severity: 'alta',
      why: `${usdBiasLabel}: ${macroReasons.join('; ')}`,
      actionHint: buildSetupRecommendation(s.symbol, s.direction === 'buy' ? 'BUY' : 'SELL', 'Alta'),
      pair: s.symbol,
      direction: s.direction === 'buy' ? 'BUY' : 'SELL',
      confidence: 'Alta',
      macroReasons,
      setupRecommendation: buildSetupRecommendation(s.symbol, s.direction === 'buy' ? 'BUY' : 'SELL', 'Alta'),
    }
  })

  const watchlistScenarios: Scenario[] = watchlist.map((s, index) => {
    const usdBiasLabel = usdBias === 'Fuerte' ? 'USD Hawkish' : usdBias === 'Débil' ? 'USD Dovish' : 'USD Neutral'
    const macroReasons = [
      usdBiasLabel,
      'Confianza Media',
      `Sesgo presente en ${s.symbol} pero con menos confirmación`,
    ]
    
    return {
      id: `institutional_watchlist_${index + 1}`,
      title: `${s.symbol} – ${s.direction.toUpperCase()} (Institucional setup)`,
      severity: 'media',
      why: `${usdBiasLabel}: ${macroReasons.join('; ')}`,
      actionHint: buildSetupRecommendation(s.symbol, s.direction === 'buy' ? 'BUY' : 'SELL', 'Media'),
      pair: s.symbol,
      direction: s.direction === 'buy' ? 'BUY' : 'SELL',
      confidence: 'Media',
      macroReasons,
      setupRecommendation: buildSetupRecommendation(s.symbol, s.direction === 'buy' ? 'BUY' : 'SELL', 'Media'),
    }
  })

  return {
    active: activeScenarios,
    watchlist: watchlistScenarios,
  }
  
  // Agrupar por dirección
  const buyPairs = highQualityPairs.filter(row => {
    const action = (row.accion ?? row.action ?? '').toLowerCase()
    return action.includes('compr') || action.includes('buy')
  })
  
  const sellPairs = highQualityPairs.filter(row => {
    const action = (row.accion ?? row.action ?? '').toLowerCase()
    return action.includes('venta') || action.includes('sell')
  })
  
  // Generar escenarios según bias del USD
  if (usdBias === 'Fuerte') {
    // USD Hawkish → Solo buscamos shorts en EUR/USD, GBP/USD, XAU/USD
    const usdShortPairs = sellPairs.filter(row => {
      const pair = ((row.par ?? row.pair) || '').toUpperCase()
      const normalizedPair = pair.replace('/', '').replace('_', '')
      const isInstitutional = 
        normalizedPair.includes('EURUSD') || 
        normalizedPair.includes('GBPUSD') || 
        normalizedPair.includes('XAUUSD') ||
        normalizedPair.includes('AUDUSD') ||
        normalizedPair.includes('NZDUSD') ||
        pair.includes('EUR/USD') || 
        pair.includes('GBP/USD') || 
        pair.includes('XAU/USD') ||
        pair.includes('AUD/USD') ||
        pair.includes('NZD/USD')
      
      if (isInstitutional) {
        console.log('[getInstitutionalScenarios] USD Hawkish - Found SELL pair:', pair, 'confidence:', row.confianza ?? row.confidence)
      }
      
      return isInstitutional
    })
    
    console.log('[getInstitutionalScenarios] USD Hawkish - usdShortPairs count:', usdShortPairs.length)
    
    // Priorizar por confianza
    usdShortPairs
      .sort((a, b) => {
        const confA = (a.confianza ?? a.confidence ?? 'media').toLowerCase()
        const confB = (b.confianza ?? b.confidence ?? 'media').toLowerCase()
        if (confA === 'alta' && confB !== 'alta') return -1
        if (confB === 'alta' && confA !== 'alta') return 1
        return 0
      })
      .slice(0, 3) // Top 3
      .forEach((row, index) => {
        const pair = (row.par ?? row.pair) || 'Unknown'
        const confidence = (row.confianza ?? row.confidence ?? 'Media') as string
        const confidenceLower = confidence.toLowerCase()
        const macroReasons = buildMacroReasons(row, usdBias, regime)
        
        const scenario: Scenario = {
          id: `usd_hawkish_short_${index + 1}`,
          title: `${pair} – SELL (Institucional setup)`,
          severity: confidenceLower === 'alta' ? 'alta' : 'media',
          why: `USD Hawkish: ${macroReasons.join('; ')}`,
          actionHint: buildSetupRecommendation(pair, 'SELL', confidence),
          pair,
          direction: 'SELL',
          confidence: (confidenceLower === 'alta' ? 'Alta' : confidenceLower === 'media' ? 'Media' : 'Baja') as 'Alta' | 'Media' | 'Baja',
          macroReasons,
          setupRecommendation: buildSetupRecommendation(pair, 'SELL', confidence),
        }
        
        // Separar en Activos (Alta) vs Watchlist (Media)
        if (confidenceLower === 'alta') {
          activeScenarios.push(scenario)
        } else if (confidenceLower === 'media') {
          watchlistScenarios.push(scenario)
        }
      })
  } else if (usdBias === 'Débil') {
    // USD Dovish → Solo buscamos longs contra USD
    const usdLongPairs = buyPairs.filter(row => {
      const pair = ((row.par ?? row.pair) || '').toUpperCase()
      const normalizedPair = pair.replace('/', '').replace('_', '')
      const isInstitutional = 
        normalizedPair.includes('EURUSD') || 
        normalizedPair.includes('GBPUSD') || 
        normalizedPair.includes('XAUUSD') ||
        normalizedPair.includes('AUDUSD') ||
        normalizedPair.includes('NZDUSD') ||
        pair.includes('EUR/USD') || 
        pair.includes('GBP/USD') || 
        pair.includes('XAU/USD') ||
        pair.includes('AUD/USD') ||
        pair.includes('NZD/USD')
      
      if (isInstitutional) {
        console.log('[getInstitutionalScenarios] USD Dovish - Found BUY pair:', pair, 'confidence:', row.confianza ?? row.confidence)
      }
      
      return isInstitutional
    })
    
    console.log('[getInstitutionalScenarios] USD Dovish - usdLongPairs count:', usdLongPairs.length)
    
    // Priorizar por confianza
    usdLongPairs
      .sort((a, b) => {
        const confA = (a.confianza ?? a.confidence ?? 'media').toLowerCase()
        const confB = (b.confianza ?? b.confidence ?? 'media').toLowerCase()
        if (confA === 'alta' && confB !== 'alta') return -1
        if (confB === 'alta' && confA !== 'alta') return 1
        return 0
      })
      .slice(0, 3) // Top 3
      .forEach((row, index) => {
        const pair = (row.par ?? row.pair) || 'Unknown'
        const confidence = (row.confianza ?? row.confidence ?? 'Media') as string
        const confidenceLower = confidence.toLowerCase()
        const macroReasons = buildMacroReasons(row, usdBias, regime)
        
        const scenario: Scenario = {
          id: `usd_dovish_long_${index + 1}`,
          title: `${pair} – BUY (Institucional setup)`,
          severity: confidenceLower === 'alta' ? 'alta' : 'media',
          why: `USD Dovish: ${macroReasons.join('; ')}`,
          actionHint: buildSetupRecommendation(pair, 'BUY', confidence),
          pair,
          direction: 'BUY',
          confidence: (confidenceLower === 'alta' ? 'Alta' : confidenceLower === 'media' ? 'Media' : 'Baja') as 'Alta' | 'Media' | 'Baja',
          macroReasons,
          setupRecommendation: buildSetupRecommendation(pair, 'BUY', confidence),
        }
        
        // Separar en Activos (Alta) vs Watchlist (Media)
        if (confidenceLower === 'alta') {
          activeScenarios.push(scenario)
        } else if (confidenceLower === 'media') {
          watchlistScenarios.push(scenario)
        }
      })
  } else {
    // USD Neutral: Aún así podemos mostrar pares con confianza Alta/Media si tienen dirección clara
    // Esto permite que aparezcan escenarios incluso cuando el USD no tiene sesgo claro
    console.log('[getInstitutionalScenarios] USD Neutral - checking for high confidence pairs anyway')
    
    const allDirectionalPairs = [...buyPairs, ...sellPairs].filter(row => {
      const pair = ((row.par ?? row.pair) || '').toUpperCase()
      const normalizedPair = pair.replace('/', '').replace('_', '')
      return normalizedPair.includes('EURUSD') || 
             normalizedPair.includes('GBPUSD') || 
             normalizedPair.includes('XAUUSD') ||
             normalizedPair.includes('AUDUSD') ||
             normalizedPair.includes('NZDUSD') ||
             pair.includes('EUR/USD') || 
             pair.includes('GBP/USD') || 
             pair.includes('XAU/USD') ||
             pair.includes('AUD/USD') ||
             pair.includes('NZD/USD')
    })
    
    console.log('[getInstitutionalScenarios] USD Neutral - allDirectionalPairs count:', allDirectionalPairs.length)
    
    // Si hay pares con confianza Alta incluso con USD Neutral, los mostramos
    allDirectionalPairs
      .filter(row => {
        const confidence = (row.confianza ?? row.confidence ?? 'media').toLowerCase()
        return confidence === 'alta' || confidence === 'high'
      })
      .slice(0, 3)
      .forEach((row, index) => {
        const pair = (row.par ?? row.pair) || 'Unknown'
        const action = (row.accion ?? row.action ?? '').toLowerCase()
        const direction = action.includes('compr') || action.includes('buy') ? 'BUY' : 'SELL'
        const confidence = (row.confianza ?? row.confidence ?? 'Media') as string
        const confidenceLower = confidence.toLowerCase()
        const macroReasons = buildMacroReasons(row, usdBias, regime)
        
        const scenario: Scenario = {
          id: `usd_neutral_${direction.toLowerCase()}_${index + 1}`,
          title: `${pair} – ${direction} (Institucional setup)`,
          severity: confidenceLower === 'alta' ? 'alta' : 'media',
          why: `USD Neutral pero confianza ${confidence}: ${macroReasons.join('; ')}`,
          actionHint: buildSetupRecommendation(pair, direction, confidence),
          pair,
          direction: direction as 'BUY' | 'SELL',
          confidence: (confidenceLower === 'alta' ? 'Alta' : confidenceLower === 'media' ? 'Media' : 'Baja') as 'Alta' | 'Media' | 'Baja',
          macroReasons,
          setupRecommendation: buildSetupRecommendation(pair, direction, confidence),
        }
        
        if (confidenceLower === 'alta') {
          activeScenarios.push(scenario)
        } else if (confidenceLower === 'media') {
          watchlistScenarios.push(scenario)
        }
      })
  }
  
  console.log('[getInstitutionalScenarios] Final result - active:', activeScenarios.length, 'watchlist:', watchlistScenarios.length)
  
  return {
    active: activeScenarios,
    watchlist: watchlistScenarios,
  }
}

/**
 * Construye las razones macro para un escenario
 */
function buildMacroReasons(
  row: TacticalRowForScenarios,
  usdBias: 'Fuerte' | 'Débil' | 'Neutral',
  regime: string
): string[] {
  const reasons: string[] = []
  
  // Razón principal: bias del USD
  if (usdBias === 'Fuerte') {
    reasons.push('USD Hawkish (inflación + empleo fuertes)')
  } else if (usdBias === 'Débil') {
    reasons.push('USD Dovish (debilidad macro)')
  }
  
  // Confianza
  const confidence = (row.confianza ?? row.confidence ?? 'Media') as string
  if (confidence.toLowerCase() === 'alta') {
    reasons.push('Confianza Alta')
  } else if (confidence.toLowerCase() === 'media') {
    reasons.push('Confianza Media')
  }
  
  // Motivo del sesgo
  if (row.motivo) {
    reasons.push(row.motivo)
  }
  
  // Sesgo macro
  if (row.sesgoMacro) {
    reasons.push(row.sesgoMacro)
  }
  
  // Régimen
  if (regime) {
    reasons.push(`Régimen: ${regime}`)
  }
  
  return reasons
}

/**
 * Construye la recomendación de setup técnico
 */
function buildSetupRecommendation(
  pair: string,
  direction: 'BUY' | 'SELL',
  confidence: string
): string {
  const pairUpper = pair.toUpperCase()
  const isForex = pairUpper.includes('/USD') || pairUpper.includes('EUR') || pairUpper.includes('GBP')
  const isGold = pairUpper.includes('XAU') || pairUpper.includes('GOLD')
  
  let setup = ''
  
  if (confidence === 'Alta') {
    setup = 'Buscar setups con tamaño normal. '
  } else if (confidence === 'Media') {
    setup = 'Scalping / riesgo controlado. '
  }
  
  if (direction === 'SELL') {
    setup += 'Buscar SELL en OB tras BOS bajista. '
    setup += 'Confirmación en H1/M15 con rechazo institucional. '
    if (isForex) {
      setup += 'TP: liquidez en mínimos y FVG inferior.'
    } else if (isGold) {
      setup += 'TP: liquidez en soportes previos y FVG inferior.'
    }
  } else {
    setup += 'Buscar BUY en OB tras BOS alcista. '
    setup += 'Confirmación en H1/M15 con rechazo institucional. '
    if (isForex) {
      setup += 'TP: liquidez en máximos y FVG superior.'
    } else if (isGold) {
      setup += 'TP: liquidez en resistencias previas y FVG superior.'
    }
  }
  
  return setup.trim()
}

export function detectScenarios(items: any[], regime: string): Scenario[] {
  const get = (k: string) => items.find((i: any) => i.key === k)
  const p = (k: string) => get(k)?.posture as Posture | undefined
  const v = (k: string) => get(k)?.value as number | undefined
  const out: Scenario[] = []

  // 1) Estanflación: Inflación Hawkish + Crecimiento Dovish
  const inflHawk = ['PCEPI', 'PCEPILFE', 'CPIAUCSL', 'CPILFESL'].map(k => p(k)).some(pp => pp === 'Hawkish')
  const growthDov = ['GDPC1', 'INDPRO', 'RSXFS', 'USSLIND'].map(k => p(k)).some(pp => pp === 'Dovish')
  if (inflHawk && growthDov)
    out.push({
      id: 'estanflacion',
      title: 'Riesgo de estanflación',
      severity: 'alta',
      why: 'Inflación alta coincidiendo con debilidad en crecimiento',
      actionHint: 'Evitar cíclicos; favorecer USD/defensivos, oro selectivo',
    })

  // 2) Expansión limpia: Inflación Dovish + Crecimiento Hawkish
  const inflDov = ['PCEPI', 'PCEPILFE', 'CPIAUCSL', 'CPILFESL'].map(k => p(k)).some(pp => pp === 'Dovish')
  const growthHawk = ['GDPC1', 'INDPRO', 'RSXFS', 'USSLIND'].map(k => p(k)).some(pp => pp === 'Hawkish')
  if (inflDov && growthHawk)
    out.push({
      id: 'expansion_limpia',
      title: 'Expansión con inflación controlada',
      severity: 'media',
      why: 'Crecimiento sólido con desinflación',
      actionHint: 'Favorecer riesgo (SPX/NDX), EUR/GBP/AUD, cripto',
    })

  // 3) Empleo se enfría: Δ NFP bajo + Claims > 300k + U3 subiendo
  const nfp = v('PAYEMS')
  const claims = v('ICSA')
  const u3 = v('UNRATE')
  if ((nfp != null && nfp < 100) || (claims != null && claims > 300000) || (u3 != null && u3 > 4.5)) {
    out.push({
      id: 'empleo_enfriando',
      title: 'Empleo enfriándose',
      severity: 'media',
      why: 'NFP bajo / Claims altos / U3 alto',
      actionHint: 'USD tendería a debilitarse a medio plazo; vigilar cortes de tipos',
    })
  }

  // 4) USD fuerte amplio: DXY proxy en Hawkish + curvas Hawkish
  const dxyHawk = p('DTWEXBGS') === 'Hawkish'
  const curveHawk = p('T10Y2Y') === 'Hawkish' && p('T10Y3M') === 'Hawkish'
  if (dxyHawk && curveHawk)
    out.push({
      id: 'usd_fuerte',
      title: 'USD ampliamente fuerte',
      severity: 'media',
      why: 'Dólar amplio + curvas sugieren tipos altos',
      actionHint: 'Vender EUR/GBP/AUD; preferir USDJPY/USDCAD',
    })

  // 5) Riesgo macro (NFCI)
  const nfci = v('NFCI')
  if (nfci != null && nfci > 0.3)
    out.push({
      id: 'condiciones_financieras_tensas',
      title: 'Condiciones financieras tensas',
      severity: 'alta',
      why: 'NFCI elevado indica restricciones de liquidez',
      actionHint: 'Reducir exposición a beta; priorizar calidad y USD/JPY',
    })

  // Regla general por régimen
  if (regime === 'RISK OFF')
    out.push({
      id: 'riesgo_off',
      title: 'Entorno Risk-OFF',
      severity: 'alta',
      why: 'Score ponderado por debajo del umbral',
      actionHint: 'Coberturas, largos en USD/JPY, evitar cíclicos',
    })

  return out
}
