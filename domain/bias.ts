import type { LatestPoint } from '@/lib/fred'
import type { Posture } from './posture'
import fs from 'node:fs/promises'
import path from 'node:path'
import type { CorrMap } from '@/domain/corr-bridge'
import { variants, norm } from '@/lib/symbols'
import { getCorrelationsForSymbol } from '@/lib/db/read'
import type { CurrencyScores } from './diagnostic'
import { getPairMacroScore } from './diagnostic'

let pairsPriorityCache: Record<string, string[]> | null = null

async function loadPairsPriority(): Promise<Record<string, string[]>> {
  if (pairsPriorityCache) return pairsPriorityCache
  const configPath = path.join(process.cwd(), 'config', 'pair_event_priority.json')
  try {
    const raw = await fs.readFile(configPath, 'utf8')
    pairsPriorityCache = JSON.parse(raw)
    return pairsPriorityCache!
  } catch {
    return {}
  }
}

export type Bias = 'Buscar compras' | 'Buscar ventas' | 'Rango/táctico'
export type MacroStrength = 'Fuerte' | 'Débil' | 'Neutral'

// --- USD Strength ---
export function usdBias(items: LatestPoint[]): MacroStrength {
  const get = (k: string) => items.find(i => i.key === k)?.value ?? null
  const dxy = get('twex') ?? get('DTWEXBGS') // soporta key interna 'twex'
  const t10y2y = get('t10y2y') ?? get('T10Y2Y')
  const t10y3m = get('t10y3m') ?? get('T10Y3M')
  const pce = get('pce_yoy') ?? get('PCEPI')
  const core = get('corepce_yoy') ?? get('PCEPILFE')
  const gdp = get('gdp_yoy') ?? get('GDPC1')

  let score = 0
  if (dxy && dxy > 110) score += 1
  if (t10y2y && t10y2y > 0.5) score += 1
  if (t10y3m && t10y3m > 0.5) score += 1
  if (pce && pce > 3) score += 1
  if (core && core > 3) score += 1
  if (gdp && gdp > 2.5) score += 1
  if (score >= 3) return 'Fuerte'
  if (score <= 1) return 'Débil'
  return 'Neutral'
}

// --- Growth / Inflation quadrant ---
export function macroQuadrant(items: LatestPoint[]) {
  const get = (k: string) => items.find(i => i.key === k)?.value ?? null
  const gdp = get('gdp_yoy') ?? get('GDPC1')
  const indpro = get('indpro_yoy') ?? get('INDPRO')
  const core = get('corepce_yoy') ?? get('PCEPILFE')
  const infls = [core].filter((v): v is number => typeof v === 'number')
  const grths = [gdp, indpro].filter((v): v is number => typeof v === 'number')
  const avgInfl = infls.length ? infls.reduce((a, b) => a + b, 0) / infls.length : 0
  const avgGrowth = grths.length ? grths.reduce((a, b) => a + b, 0) / grths.length : 0
  if (avgInfl > 3 && avgGrowth > 2) return 'recalentamiento'
  if (avgInfl > 3 && avgGrowth < 1) return 'estanflacion'
  if (avgInfl < 2.5 && avgGrowth < 1) return 'desaceleracion'
  return 'expansion'
}

export type TacticalTrend = 'Alcista' | 'Bajista' | 'Neutral'
export type Confidence = 'Alta' | 'Media' | 'Baja'
export type BiasRow = { par: string; sesgoMacro: string; accion: Bias; motivo: string; tactico?: TacticalTrend; confianza?: Confidence; corr12m?: number | null; corr6m?: number | null; corr3m?: number | null; corrRef?: string; corrMapped?: boolean }

export async function getBiasTableFromUniverse(
  risk: string, 
  usd: MacroStrength, 
  quadrant: string,
  currencyScores?: CurrencyScores // Opcional: para usar macro relativo
): Promise<BiasRow[]> {
  const out: BiasRow[] = []
  
  // Load universe assets
  let universeAssets: Array<{ symbol: string; class: string; base?: string | null; quote?: string | null; risk_sensitivity?: string; usd_exposure?: string }> = []
  try {
    const fs = await import('node:fs/promises')
    const path = await import('node:path')
    const configPath = path.join(process.cwd(), 'config', 'universe.assets.json')
    const raw = await fs.readFile(configPath, 'utf8')
    universeAssets = JSON.parse(raw)
  } catch (error) {
    console.warn('[getBiasTable] Failed to load universe.assets.json, using fallback list:', error)
    // Fallback to basic list if file not found
    universeAssets = [
      { symbol: 'EURUSD', class: 'fx', base: 'EUR', quote: 'USD' },
      { symbol: 'GBPUSD', class: 'fx', base: 'GBP', quote: 'USD' },
      { symbol: 'AUDUSD', class: 'fx', base: 'AUD', quote: 'USD' },
      { symbol: 'USDJPY', class: 'fx', base: 'USD', quote: 'JPY' },
      { symbol: 'USDCAD', class: 'fx', base: 'USD', quote: 'CAD' },
      { symbol: 'XAUUSD', class: 'metal', base: 'XAU', quote: 'USD' },
      { symbol: 'BTCUSDT', class: 'crypto', base: 'BTC', quote: 'USDT' },
      { symbol: 'ETHUSDT', class: 'crypto', base: 'ETH', quote: 'USDT' },
      { symbol: 'SPX', class: 'index' },
      { symbol: 'NDX', class: 'index' },
    ]
  }

  const riskOn = risk === 'RISK ON'
  
  // Helper function to format symbol for display
  const formatSymbol = (symbol: string, base?: string | null, quote?: string | null) => {
    if (base && quote) {
      return `${base}/${quote}`
    }
    return symbol
  }

  // Process all assets from universe
  for (const asset of universeAssets) {
    const symbol = asset.symbol
    const assetClass = asset.class
    const formattedPair = formatSymbol(symbol, asset.base, asset.quote)
    
    if (assetClass === 'fx') {
      // Forex pairs: usar macro relativo si está disponible, sino fallback a lógica USD-céntrica
      const pairScore = currencyScores ? getPairMacroScore(formattedPair, currencyScores) : null
      
      if (pairScore != null) {
        // Usar macro relativo: score_pair = score_base - score_quote
        const threshold = 0.3
        if (pairScore > threshold) {
          out.push({ 
            par: formattedPair, 
            sesgoMacro: `${asset.base} fuerte vs ${asset.quote}`, 
            accion: 'Buscar compras', 
            motivo: `Score relativo ${pairScore.toFixed(2)} (${asset.base} > ${asset.quote}) ⇒ Buscar compras` 
          })
        } else if (pairScore < -threshold) {
          out.push({ 
            par: formattedPair, 
            sesgoMacro: `${asset.base} débil vs ${asset.quote}`, 
            accion: 'Buscar ventas', 
            motivo: `Score relativo ${pairScore.toFixed(2)} (${asset.base} < ${asset.quote}) ⇒ Buscar ventas` 
          })
        } else {
          out.push({ 
            par: formattedPair, 
            sesgoMacro: 'Neutral', 
            accion: 'Rango/táctico', 
            motivo: `Score relativo ${pairScore.toFixed(2)} (neutral) ⇒ Rango/táctico` 
          })
        }
      } else {
        // Fallback: lógica USD-céntrica original
        const isUSDBase = asset.base === 'USD'
        const isUSDQuote = asset.quote === 'USD'
        
        if (usd === 'Fuerte') {
          if (isUSDBase) {
            // USD is base (e.g., USD/JPY) - USD fuerte = buscar compras
            out.push({ 
              par: formattedPair, 
              sesgoMacro: 'USD fuerte', 
              accion: 'Buscar compras', 
              motivo: `USD ${usd} (USD es base) ⇒ Buscar compras` 
            })
          } else if (isUSDQuote) {
            // USD is quote (e.g., EUR/USD) - USD fuerte = buscar ventas
            out.push({ 
              par: formattedPair, 
              sesgoMacro: 'USD fuerte', 
              accion: 'Buscar ventas', 
              motivo: `USD ${usd} (USD es cotización) ⇒ Buscar ventas` 
            })
          } else {
            // Cross pairs - neutral
            out.push({ 
              par: formattedPair, 
              sesgoMacro: 'USD fuerte', 
              accion: 'Rango/táctico', 
              motivo: `USD ${usd} (par cruzado) ⇒ Rango/táctico` 
            })
          }
        } else if (usd === 'Débil') {
          if (isUSDBase) {
            // USD is base - USD débil = buscar ventas
            out.push({ 
              par: formattedPair, 
              sesgoMacro: 'USD débil', 
              accion: 'Buscar ventas', 
              motivo: `USD ${usd} (USD es base) ⇒ Buscar ventas` 
            })
          } else if (isUSDQuote) {
            // USD is quote - USD débil = buscar compras
            out.push({ 
              par: formattedPair, 
              sesgoMacro: 'USD débil', 
              accion: 'Buscar compras', 
              motivo: `USD ${usd} (USD es cotización) ⇒ Buscar compras` 
            })
          } else {
            // Cross pairs - neutral
            out.push({ 
              par: formattedPair, 
              sesgoMacro: 'USD débil', 
              accion: 'Rango/táctico', 
              motivo: `USD ${usd} (par cruzado) ⇒ Rango/táctico` 
            })
          }
        } else {
          // USD neutral
          out.push({ 
            par: formattedPair, 
            sesgoMacro: 'USD neutral', 
            accion: 'Rango/táctico', 
            motivo: 'USD neutral ⇒ Rango/táctico' 
          })
        }
      }
    } else if (assetClass === 'metal') {
      // Metals (Gold, Silver, etc.)
      if (quadrant === 'desaceleracion' || quadrant === 'estanflacion') {
        out.push({ 
          par: formattedPair, 
          sesgoMacro: quadrant, 
          accion: 'Buscar compras', 
          motivo: `${quadrant} y USD ${usd} ⇒ Buscar compras` 
        })
      } else if (usd === 'Fuerte') {
        out.push({ 
          par: formattedPair, 
          sesgoMacro: 'USD fuerte', 
          accion: 'Buscar ventas', 
          motivo: `USD ${usd} ⇒ Buscar ventas` 
        })
      } else {
        out.push({ 
          par: formattedPair, 
          sesgoMacro: 'Neutral', 
          accion: 'Rango/táctico', 
          motivo: `USD ${usd} ⇒ Rango/táctico` 
        })
      }
    } else if (assetClass === 'crypto') {
      // Cryptocurrencies
      const riskSensitivity = asset.risk_sensitivity || 'risk_on'
      const isRiskOn = riskSensitivity === 'risk_on' && riskOn
      out.push({ 
        par: formattedPair, 
        sesgoMacro: isRiskOn ? 'RISK ON' : 'RISK OFF', 
        accion: isRiskOn ? 'Buscar compras' : 'Buscar ventas', 
        motivo: `${isRiskOn ? 'RISK ON' : 'RISK OFF'} ⇒ ${isRiskOn ? 'Buscar compras' : 'Buscar ventas'}` 
      })
    } else if (assetClass === 'index') {
      // Stock indices
      out.push({ 
        par: formattedPair, 
        sesgoMacro: riskOn ? 'RISK ON' : 'RISK OFF', 
        accion: riskOn ? 'Buscar compras' : 'Buscar ventas', 
        motivo: `${riskOn ? 'RISK ON' : 'RISK OFF'} ⇒ ${riskOn ? 'Buscar compras' : 'Buscar ventas'}` 
      })
    }
  }
  
  return out
}

export function confidenceFrom(score: number, threshold = 0.3, usd: 'Fuerte' | 'Débil' | 'Neutral'): Confidence {
  const dist = Math.abs(score)
  
  // Alta: score muy claro (|score| >= 0.50)
  if (dist >= 0.50) return 'Alta'
  
  // Media o Alta: score moderado (0.30 <= |score| < 0.50)
  // - Alta si el sesgo USD es muy claro (Fuerte/Débil)
  // - Media si el sesgo USD es débil/neutro
  if (dist >= 0.30) {
    return (usd === 'Fuerte' || usd === 'Débil') ? 'Alta' : 'Media'
  }
  
  // Baja: score débil (|score| < 0.30)
  return 'Baja'
}

export function tacticalFromAction(accion: Bias): TacticalTrend {
  if (accion === 'Buscar compras') return 'Alcista'
  if (accion === 'Buscar ventas') return 'Bajista'
  return 'Neutral'
}

/**
 * Tipo para bias macro del USD
 */
type MacroBias = 'hawkish' | 'dovish' | 'neutral'

/**
 * Tipo para nivel de confianza
 */
type ConfidenceLevel = 'alta' | 'media' | 'baja'

/**
 * Parámetros para calcular la confianza de un par
 */
interface ConfidenceParams {
  macroScoreGlobal: number        // -1 a +1
  usdBias: MacroBias              // sesgo macro del USD
  corrDxy: number                 // correlación par vs DXY (-1 a 1)
  alignedBigSurprises: number     // nº de sorpresas grandes alineadas con el sesgo
}

/**
 * Calcula la confianza (Alta, Media, Baja) para un par táctico.
 * Sistema de puntos refinado:
 * - Base: Alta=2, Media=1, Baja=0
 * - Correlación fuerte (|ρ| >= 0.5): +1
 * - Sorpresas grandes alineadas: +1 (≥1) o +2 (≥2)
 */
export function getPairConfidence({
  macroScoreGlobal,
  usdBias,
  corrDxy,
  alignedBigSurprises,
}: ConfidenceParams): ConfidenceLevel {
  const scoreAbs = Math.abs(macroScoreGlobal)

  // 1) Confianza base (solo por macroScore + sesgo USD)
  let basePoints = 0
  const usdBiasIsStrong = usdBias === 'hawkish' || usdBias === 'dovish'

  if (scoreAbs >= 0.5) {
    // Macro muy clara
    basePoints = 2        // Base Alta
  } else if (scoreAbs >= 0.3) {
    // Zona intermedia: depende de lo claro que esté el sesgo del USD
    basePoints = usdBiasIsStrong ? 2 : 1 // Alta o Media
  } else {
    // Macro floja / poco clara
    basePoints = 0        // Base Baja
  }

  // 2) Puntos por correlación con DXY
  const corrAbs = Math.abs(corrDxy)
  const corrPoints = corrAbs >= 0.5 ? 1 : 0

  // 3) Puntos por sorpresas macro grandes alineadas
  // +1 si hay ≥1 sorpresa grande en la dirección del sesgo
  // +2 si hay ≥2 sorpresas grandes alineadas
  let surprisePoints = 0
  if (alignedBigSurprises >= 2) {
    surprisePoints = 2
  } else if (alignedBigSurprises === 1) {
    surprisePoints = 1
  }

  // 4) Puntuación total → nivel de confianza
  const totalPoints = basePoints + corrPoints + surprisePoints

  if (totalPoints >= 3) return 'alta'
  if (totalPoints >= 1) return 'media'
  return 'baja'
}

/**
 * Calcula la confianza (Alta, Media, Baja) para un par táctico.
 * Versión legacy que mantiene compatibilidad con código existente.
 * Sistema de puntos refinado:
 * - Base: Alta=2, Media=1, Baja=0
 * - Correlación fuerte (|ρ| >= 0.5): +1
 * - Sorpresas grandes alineadas: +1 (≥1) o +2 (≥2)
 */
export function confidenceAdvanced(
  base: 'Alta' | 'Media' | 'Baja',
  corr12: number | null,
  alignedBigSurprises: number = 0
): 'Alta' | 'Media' | 'Baja' {
  // Puntuación inicial según confianza base
  let score = base === 'Alta' ? 2 : base === 'Media' ? 1 : 0
  
  // +1 punto si correlación fuerte con USD (|ρ| >= 0.5)
  const c = corr12 ?? 0
  if (Math.abs(c) >= 0.5) score += 1
  
  // Puntos por sorpresas macro grandes alineadas
  // +1 si hay ≥1 sorpresa grande alineada
  // +2 si hay ≥2 grandes sorpresas alineadas
  if (alignedBigSurprises >= 2) {
    score += 2
  } else if (alignedBigSurprises >= 1) {
    score += 1
  }
  
  // Clasificación final
  if (score >= 3) return 'Alta'
  if (score >= 1) return 'Media'
  return 'Baja' // score = 0 (base Baja sin correlación fuerte ni sorpresas)
}

export function detectRecentSurprise(items: any[], keys: string[]): 'pos' | 'neg' | 'none' {
  if (!items || !Array.isArray(items)) {
    return 'none'
  }
  const getP = (k: string) => items.find((i: any) => i?.key === k)?.posture as 'Hawkish' | 'Neutral' | 'Dovish' | undefined
  const arr = keys.map(getP).filter(Boolean) as string[]
  if (!arr.length) return 'none'
  const hawk = arr.filter(x => x === 'Hawkish').length
  const dov = arr.filter(x => x === 'Dovish').length
  if (hawk - dov >= 2) return 'pos'
  if (dov - hawk >= 2) return 'neg'
  return 'none'
}

/**
 * Identifica si un indicador es considerado "grande" para sorpresas macro.
 * Los indicadores grandes son: CPI, Core CPI, PCE, Core PCE, NFP, PMI Manufacturing.
 */
function isBigIndicator(key: string): boolean {
  const bigIndicators = [
    'CPIAUCSL',      // CPI YoY
    'CPILFESL',      // Core CPI YoY
    'PCEPILFE',      // Core PCE YoY
    'PAYEMS',        // NFP (Nonfarm Payrolls)
    'USPMI',         // ISM Manufacturing PMI
    // También aceptar keys internos
    'cpi_yoy',
    'corecpi_yoy',
    'corepce_yoy',
    'nfp_change',
    'payems_delta',
    'ism_manufacturing_pmi',
    'pmi_mfg',
  ]
  return bigIndicators.includes(key.toUpperCase()) || bigIndicators.includes(key)
}

/**
 * Cuenta el número de sorpresas grandes alineadas con el sesgo del USD.
 * 
 * @param items Array de indicadores macro con sus posturas
 * @param keys Array de keys de indicadores a revisar (normalmente del pair_event_priority)
 * @param usdBias Sesgo del USD ('Fuerte' = hawkish, 'Débil' = dovish, 'Neutral' = neutral)
 * @returns Número de sorpresas grandes alineadas (0, 1, 2+)
 */
export function countAlignedBigSurprises(
  items: any[],
  keys: string[],
  usdBias: 'Fuerte' | 'Débil' | 'Neutral'
): number {
  if (!items || !Array.isArray(items) || !keys || keys.length === 0) {
    return 0
  }
  
  // Si el sesgo USD es neutral, no hay sorpresas alineadas
  if (usdBias === 'Neutral') {
    return 0
  }
  
  // Mapear sesgo USD a posture esperado
  const expectedPosture = usdBias === 'Fuerte' ? 'Hawkish' : 'Dovish'
  
  // Contar sorpresas grandes alineadas usando z-scores
  let count = 0
  let surpriseScore = 0 // Suma de |z| para sorpresas alineadas
  
  for (const key of keys) {
    const item = items.find((i: any) => i?.key === key || i?.originalKey === key)
    if (!item) continue
    
    // Verificar si es un indicador grande
    if (!isBigIndicator(key) && !isBigIndicator(item.key ?? '')) continue
    
    // Verificar si la postura está alineada con el sesgo USD
    if (item.posture === expectedPosture) {
      // Si tiene z-score, usarlo para medir el tamaño de la sorpresa
      const zScore = item.zScore ?? null
      if (zScore != null && Math.abs(zScore) >= 1) {
        // z-score >= 1: sorpresa relevante
        // z-score >= 2: sorpresa muy grande
        surpriseScore += Math.abs(zScore)
        count++
      } else {
        // Sin z-score o z-score < 1: contar como sorpresa pequeña
        count++
      }
    }
  }
  
  // Si tenemos sorpresas con z-scores significativos, ajustar el conteo
  // surpriseScore >= 3 → equivalente a 2+ sorpresas grandes
  // surpriseScore >= 1 → equivalente a 1 sorpresa grande
  if (surpriseScore >= 3) {
    return Math.max(2, count) // Mínimo 2 si hay múltiples sorpresas grandes
  } else if (surpriseScore >= 1) {
    return Math.max(1, count) // Mínimo 1 si hay al menos una sorpresa relevante
  }
  
  return count
}


function corrFromMap(par: string, corrMap: CorrMap): { corr12m: number | null; corr6m: number | null; corr3m: number | null; ref: string | undefined; mapped: boolean } {
  const keys = variants(par)
  let c: { ref: string; c12: number | null; c6: number | null; c3: number | null } | undefined = undefined
  let mapped = false
  for (const k of keys) {
    if (corrMap.has(k)) {
      c = corrMap.get(k)!
      mapped = true
      break
    }
  }
  if (!c && corrMap.has(norm(par))) {
    c = corrMap.get(norm(par))!
    mapped = true
  }
  return { corr12m: c?.c12 ?? null, corr6m: c?.c6 ?? null, corr3m: c?.c3 ?? null, ref: c?.ref, mapped }
}

/**
 * Get correlations from SQLite (preferred) or fallback to corrMap
 */
async function corrFromDB(par: string, corrMap: CorrMap): Promise<{ corr12m: number | null; corr6m: number | null; corr3m: number | null; ref: string | undefined; mapped: boolean }> {
  // Try SQLite first
  // IMPORTANTE: Para BTC/USDT y ETH/USDT, norm() convierte a BTCUSDT y ETHUSDT
  // Pero si en la BD está guardado como BTCUSD (sin T), también intentamos buscar esa variante
  const symbol = norm(par)
  const variants = [symbol]
  
  // Para criptos, también intentar variantes sin T (por compatibilidad con datos antiguos)
  if (symbol === 'BTCUSDT') variants.push('BTCUSD')
  if (symbol === 'ETHUSDT') variants.push('ETHUSD')
  
  for (const sym of variants) {
    if (sym) {
      const dbCorr = await getCorrelationsForSymbol(sym, 'DXY')
      // Use DB if we have valid data (n_obs meets minimums) OR if we have correlation values
      // This ensures we show correlations even if n_obs is low but value exists
      if ((dbCorr.n_obs12m >= 150 || dbCorr.n_obs3m >= 40) || (dbCorr.corr12m != null || dbCorr.corr3m != null)) {
        return {
          corr12m: dbCorr.corr12m,
          corr6m: null, // Not stored in DB
          corr3m: dbCorr.corr3m,
          ref: 'DXY',
          mapped: true,
        }
      }
    }
  }
  
  // Fallback to corrMap
  const mapResult = corrFromMap(par, corrMap)
  // If corrMap has data, use it; otherwise return DB result even if n_obs is low
  if (mapResult.mapped) {
    return mapResult
  }
  
  // Last resort: return DB data even if n_obs is low (better than nothing)
  for (const sym of variants) {
    if (sym) {
      const dbCorr = await getCorrelationsForSymbol(sym, 'DXY')
      if (dbCorr.corr12m != null || dbCorr.corr3m != null) {
        return {
          corr12m: dbCorr.corr12m,
          corr6m: null,
          corr3m: dbCorr.corr3m,
          ref: 'DXY',
          mapped: true,
        }
      }
    }
  }
  
  return mapResult
}

export async function getBiasTableTactical(
  items: any[], 
  risk: string, 
  usdBiasStr: 'Fuerte' | 'Débil' | 'Neutral', 
  score: number, 
  _upcomingNamed: any[], 
  corrMap: CorrMap,
  currencyScores?: CurrencyScores // Opcional: para usar macro relativo
): Promise<BiasRow[]> {
  // Validate items is not undefined
  if (!items || !Array.isArray(items)) {
    console.warn('[getBiasTableTactical] items is undefined or not an array, using empty array')
    items = []
  }
  
  const base = await getBiasTableFromUniverse(
    risk, 
    usdBiasStr, 
    ((): string => {
      const gdp = items.find((i: any) => i?.key === 'GDPC1')?.value
      const indpro = items.find((i: any) => i?.key === 'INDPRO')?.value
      const core = items.find((i: any) => i?.key === 'PCEPILFE')?.value
      const infl = [core].filter((v: any) => typeof v === 'number') as number[]
      const grw = [gdp, indpro].filter((v: any) => typeof v === 'number') as number[]
      const avgInfl = infl.length ? infl.reduce((a, b) => a + b, 0) / infl.length : 0
      const avgGrw = grw.length ? grw.reduce((a, b) => a + b, 0) / grw.length : 0
      if (avgInfl > 3 && avgGrw > 2) return 'recalentamiento'
      if (avgInfl > 3 && avgGrw < 1) return 'estanflacion'
      if (avgInfl < 2.5 && avgGrw < 1) return 'desaceleracion'
      return 'expansion'
    })(),
    currencyScores // Pasar currencyScores a getBiasTableFromUniverse
  )
  const confBase = confidenceFrom(score, 0.3, usdBiasStr)
  const pairsPriority = await loadPairsPriority()
  const key = (par: string) => par.replace('/', '').toUpperCase()
  const prio = (par: string) => (pairsPriority && pairsPriority[key(par)]) ? pairsPriority[key(par)] : []
  const results = await Promise.all(
    base.map(async r => {
      const tact = tacticalFromAction(r.accion)
      const alignedBigSurprises = countAlignedBigSurprises(items, prio(r.par), usdBiasStr)
      const corr = await corrFromDB(r.par, corrMap) // Use DB first, fallback to map
      const conf = confidenceAdvanced(confBase, corr.corr12m ?? null, alignedBigSurprises)
      return { ...r, tactico: tact, confianza: conf, corr12m: corr.corr12m, corr6m: corr.corr6m, corr3m: corr.corr3m, corrRef: corr.ref, corrMapped: corr.mapped }
    })
  )
  return results
}


