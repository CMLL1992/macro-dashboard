import type { LatestPoint } from '@/lib/fred'
import type { Posture } from './posture'
import fs from 'node:fs/promises'
import path from 'node:path'
import type { CorrMap } from '@/domain/corr-bridge'
import { variants, norm } from '@/lib/symbols'
import { getCorrelationsForSymbol } from '@/lib/db/read'

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
  const pce = get('pce_yoy') ?? get('PCEPI')
  const core = get('corepce_yoy') ?? get('PCEPILFE')
  const infls = [pce, core].filter((v): v is number => typeof v === 'number')
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

export function getBiasTable(risk: string, usd: MacroStrength, quadrant: string): BiasRow[] {
  const out: BiasRow[] = []
  function fx(pair: string, invert = false) {
    if (usd === 'Fuerte') out.push({ par: pair, sesgoMacro: 'USD fuerte', accion: invert ? 'Buscar ventas' : 'Buscar ventas', motivo: `USD ${usd} ⇒ Buscar ventas${invert ? ' (pares con USD al frente)' : ''}` })
    else if (usd === 'Débil') out.push({ par: pair, sesgoMacro: 'USD débil', accion: invert ? 'Buscar compras' : 'Buscar compras', motivo: `USD ${usd} ⇒ Buscar compras${invert ? ' (pares con USD al frente)' : ''}` })
    else out.push({ par: pair, sesgoMacro: 'USD neutral', accion: 'Rango/táctico', motivo: 'USD neutral ⇒ Rango/táctico' })
  }
  fx('EUR/USD')
  fx('GBP/USD')
  fx('AUD/USD')
  fx('USD/JPY', true)
  fx('USD/CAD', true)

  // Oro
  if (quadrant === 'desaceleracion' || quadrant === 'estanflacion') out.push({ par: 'XAU/USD', sesgoMacro: quadrant, accion: 'Buscar compras', motivo: `${quadrant} y USD ${usd} ⇒ Buscar compras` })
  else if (usd === 'Fuerte') out.push({ par: 'XAU/USD', sesgoMacro: 'USD fuerte', accion: 'Buscar ventas', motivo: `USD ${usd} ⇒ Buscar ventas` })
  else out.push({ par: 'XAU/USD', sesgoMacro: 'Neutral', accion: 'Rango/táctico', motivo: `USD ${usd} ⇒ Rango/táctico` })

  // Cripto
  const riskOn = risk === 'RISK ON'
  out.push({ par: 'BTC/USDT', sesgoMacro: riskOn ? 'RISK ON' : 'RISK OFF', accion: riskOn ? 'Buscar compras' : 'Buscar ventas', motivo: `${riskOn ? 'RISK ON' : 'RISK OFF'} ⇒ ${riskOn ? 'Buscar compras' : 'Buscar ventas'}` })
  out.push({ par: 'ETH/USDT', sesgoMacro: riskOn ? 'RISK ON' : 'RISK OFF', accion: riskOn ? 'Buscar compras' : 'Buscar ventas', motivo: `${riskOn ? 'RISK ON' : 'RISK OFF'} ⇒ ${riskOn ? 'Buscar compras' : 'Buscar ventas'}` })

  // Índices
  out.push({ par: 'SPX', sesgoMacro: riskOn ? 'RISK ON' : 'RISK OFF', accion: riskOn ? 'Buscar compras' : 'Buscar ventas', motivo: `${riskOn ? 'RISK ON' : 'RISK OFF'} ⇒ ${riskOn ? 'Buscar compras' : 'Buscar ventas'}` })
  out.push({ par: 'NDX', sesgoMacro: riskOn ? 'RISK ON' : 'RISK OFF', accion: riskOn ? 'Buscar compras' : 'Buscar ventas', motivo: `${riskOn ? 'RISK ON' : 'RISK OFF'} ⇒ ${riskOn ? 'Buscar compras' : 'Buscar ventas'}` })
  return out
}

export function confidenceFrom(score: number, threshold = 0.3, usd: 'Fuerte' | 'Débil' | 'Neutral'): Confidence {
  const dist = Math.abs(score)
  if (dist >= threshold * 1.2) return 'Alta'
  if (dist >= threshold * 0.7) return usd === 'Neutral' ? 'Media' : 'Alta'
  return 'Media'
}

export function tacticalFromAction(accion: Bias): TacticalTrend {
  if (accion === 'Buscar compras') return 'Alcista'
  if (accion === 'Buscar ventas') return 'Bajista'
  return 'Neutral'
}

export function confidenceAdvanced(base: 'Alta' | 'Media' | 'Baja', corr12: number | null, recentSurprise?: 'pos' | 'neg' | 'none'): 'Alta' | 'Media' | 'Baja' {
  let score = base === 'Alta' ? 2 : base === 'Media' ? 1 : 0
  const c = corr12 ?? 0
  if (Math.abs(c) >= 0.5) score += 1 // correlación fuerte con USD → más confianza
  if (recentSurprise && recentSurprise !== 'none') score += 1 // sorpresa macro reciente
  if (score >= 3) return 'Alta'
  if (score >= 1) return 'Media'
  return 'Baja'
}

export function detectRecentSurprise(items: any[], keys: string[]): 'pos' | 'neg' | 'none' {
  const getP = (k: string) => items.find((i: any) => i.key === k)?.posture as 'Hawkish' | 'Neutral' | 'Dovish' | undefined
  const arr = keys.map(getP).filter(Boolean) as string[]
  if (!arr.length) return 'none'
  const hawk = arr.filter(x => x === 'Hawkish').length
  const dov = arr.filter(x => x === 'Dovish').length
  if (hawk - dov >= 2) return 'pos'
  if (dov - hawk >= 2) return 'neg'
  return 'none'
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
function corrFromDB(par: string, corrMap: CorrMap): { corr12m: number | null; corr6m: number | null; corr3m: number | null; ref: string | undefined; mapped: boolean } {
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
      const dbCorr = getCorrelationsForSymbol(sym, 'DXY')
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
      const dbCorr = getCorrelationsForSymbol(sym, 'DXY')
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

export async function getBiasTableTactical(items: any[], risk: string, usdBiasStr: 'Fuerte' | 'Débil' | 'Neutral', score: number, _upcomingNamed: any[], corrMap: CorrMap): Promise<BiasRow[]> {
  const base = getBiasTable(risk, usdBiasStr, ((): string => {
    const gdp = items.find((i: any) => i.key === 'GDPC1')?.value
    const indpro = items.find((i: any) => i.key === 'INDPRO')?.value
    const pce = items.find((i: any) => i.key === 'PCEPI')?.value
    const core = items.find((i: any) => i.key === 'PCEPILFE')?.value
    const infl = [pce, core].filter((v: any) => typeof v === 'number') as number[]
    const grw = [gdp, indpro].filter((v: any) => typeof v === 'number') as number[]
    const avgInfl = infl.length ? infl.reduce((a, b) => a + b, 0) / infl.length : 0
    const avgGrw = grw.length ? grw.reduce((a, b) => a + b, 0) / grw.length : 0
    if (avgInfl > 3 && avgGrw > 2) return 'recalentamiento'
    if (avgInfl > 3 && avgGrw < 1) return 'estanflacion'
    if (avgInfl < 2.5 && avgGrw < 1) return 'desaceleracion'
    return 'expansion'
  })())
  const confBase = confidenceFrom(score, 0.3, usdBiasStr)
  const pairsPriority = await loadPairsPriority()
  const key = (par: string) => par.replace('/', '').toUpperCase()
  const prio = (par: string) => pairsPriority[key(par)] ?? []
  const results = await Promise.all(
    base.map(async r => {
      const tact = tacticalFromAction(r.accion)
      const surprise = detectRecentSurprise(items, prio(r.par))
      const corr = corrFromDB(r.par, corrMap) // Use DB first, fallback to map
      const conf = confidenceAdvanced(confBase, corr.corr12m ?? null, surprise)
      return { ...r, tactico: tact, confianza: conf, corr12m: corr.corr12m, corr6m: corr.corr6m, corr3m: corr.corr3m, corrRef: corr.ref, corrMapped: corr.mapped }
    })
  )
  return results
}


