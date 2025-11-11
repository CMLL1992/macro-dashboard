import { getMacroDiagnosis } from './diagnostic'
import { usdBias } from './bias'
import { getCorrelationsForSymbol } from '@/lib/db/read'
import { variants, norm } from '@/lib/symbols'
import type { LatestPoint } from '@/lib/fred'

export type NarrativeData = {
  symbol: string
  par: string
  direccion: 'Alcista' | 'Bajista' | 'Rango'
  accion: string
  resumen: string
  usdBias: 'Fuerte' | 'Débil' | 'Neutral'
  usdRazon: string
  corr12m: number | null
  corr3m: number | null
  corrLabel12m: string
  corrLabel3m: string
  confianza: 'Alta' | 'Media' | 'Baja'
  confianzaRazon: string
  drivers: Array<{
    key: string
    label: string
    value: number | null
    value_previous: number | null
    posture: string
    weight: number
  }>
  notaOperativa: string
  updatedAt: string | null
}

function getUSDRazon(usd: 'Fuerte' | 'Débil' | 'Neutral', items: LatestPoint[]): string {
  const get = (k: string) => items.find(i => i.key === k)?.value ?? null
  
  if (usd === 'Débil') {
    const pce = get('pce_yoy') ?? get('PCEPI')
    const nfp = get('payems_delta') ?? get('PAYEMS')
    const t10y2y = get('t10y2y') ?? get('T10Y2Y')
    const reasons: string[] = []
    if (pce != null && pce < 3) reasons.push('desinflación')
    if (nfp != null && nfp < 200) reasons.push('empleo enfriándose')
    if (t10y2y != null && t10y2y > -0.5) reasons.push('curva normalizando')
    return reasons.length > 0 ? `(${reasons.join(' / ')})` : '(indicadores débiles)'
  } else if (usd === 'Fuerte') {
    const pce = get('pce_yoy') ?? get('PCEPI')
    const nfp = get('payems_delta') ?? get('PAYEMS')
    const t10y2y = get('t10y2y') ?? get('T10Y2Y')
    const reasons: string[] = []
    if (pce != null && pce > 3) reasons.push('inflación pegajosa')
    if (nfp != null && nfp > 200) reasons.push('empleo sólido')
    if (t10y2y != null && t10y2y < -0.5) reasons.push('curva invertida')
    return reasons.length > 0 ? `(${reasons.join(' / ')})` : '(indicadores fuertes)'
  }
  return '(indicadores mixtos)'
}

function getCorrLabel(corr: number | null): string {
  if (corr == null) return 'no disponible'
  const abs = Math.abs(corr)
  const sign = corr < 0 ? 'inversa' : 'directa'
  if (abs >= 0.60) return `${sign} fuerte`
  if (abs >= 0.30) return `${sign} media`
  return `${sign} baja`
}

function getConfianzaRazon(
  confianza: 'Alta' | 'Media' | 'Baja',
  corr12m: number | null,
  corr3m: number | null,
  usd: 'Fuerte' | 'Débil' | 'Neutral'
): string {
  if (confianza === 'Alta') {
    return 'correlación fuerte y régimen claro'
  }
  if (confianza === 'Media') {
    const abs12 = Math.abs(corr12m ?? 0)
    if (abs12 < 0.70) return 'correlación 12m moderada'
    if (Math.abs(corr3m ?? 0) < 0.50) return '3m más débil; validar con PA'
    return 'correlación moderada'
  }
  if (usd === 'Neutral') {
    return 'USD neutral; preferir rango'
  }
  const abs12 = Math.abs(corr12m ?? 0)
  if (abs12 < 0.50) return 'correlación débil'
  return 'correlaciones contradictorias'
}

function getTopDrivers(
  items: LatestPoint[],
  usd: 'Fuerte' | 'Débil' | 'Neutral',
  maxDrivers: number = 3
): Array<{
  key: string
  label: string
  value: number | null
  value_previous: number | null
  posture: string
  weight: number
}> {
  // Seleccionar indicadores con mayor peso que estén alineados con el sesgo USD
  const aligned: Array<{
    key: string
    label: string
    value: number | null
    value_previous: number | null
    posture: string
    weight: number
  }> = []

  for (const item of items) {
    const weight = (item as any).weight ?? 0
    if (weight <= 0) continue

    const posture = (item as any).posture ?? 'Neutral'
    
    // Lógica de alineación: si USD es fuerte, buscar Hawkish; si débil, buscar Dovish
    let isAligned = false
    if (usd === 'Fuerte' && (posture === 'Hawkish' || posture === 'Neutral')) {
      isAligned = true
    } else if (usd === 'Débil' && (posture === 'Dovish' || posture === 'Neutral')) {
      isAligned = true
    } else if (usd === 'Neutral') {
      isAligned = true // Todos son relevantes si USD es neutral
    }

    if (isAligned) {
      aligned.push({
        key: item.key,
        label: item.label,
        value: item.value,
        value_previous: (item as any).value_previous ?? null,
        posture,
        weight,
      })
    }
  }

  // Ordenar por peso descendente y tomar los top N
  return aligned
    .sort((a, b) => b.weight - a.weight)
    .slice(0, maxDrivers)
}

export async function generateNarrative(
  par: string,
  accion: string,
  tactico: string,
  confianza: 'Alta' | 'Media' | 'Baja',
  motivo: string | undefined,
  updatedAt: string | null
): Promise<NarrativeData> {
  const diagnosis = await getMacroDiagnosis()
  const items = diagnosis.items
  const usd = usdBias(items)

  // Obtener correlaciones
  const symbol = norm(par)
  const corr = symbol ? getCorrelationsForSymbol(symbol, 'DXY') : { corr12m: null, corr3m: null, n_obs12m: 0, n_obs3m: 0 }
  
  // Dirección
  const direccion = tactico === 'Alcista' ? 'Alcista' : tactico === 'Bajista' ? 'Bajista' : 'Rango'

  // Resumen
  const corrAbs12 = Math.abs(corr.corr12m ?? 0)
  const corrType = corr.corr12m != null && corr.corr12m < 0 ? 'inversa' : 'directa'
  const corrStrength = corrAbs12 >= 0.60 ? 'fuerte' : corrAbs12 >= 0.30 ? 'media' : 'baja'
  const resumen = `${usd === 'Débil' ? 'USD débil' : usd === 'Fuerte' ? 'USD fuerte' : 'USD neutral'} + correlación ${corrType} ${corrStrength} ⇒ ${accion.toLowerCase()}.`

  // Drivers
  const drivers = getTopDrivers(items, usd, 3)

  // Nota operativa
  const notaOperativa = 'Sesgo válido 3–10 días; confirmar con price action en D/H4.'

  return {
    symbol: symbol || par.replace('/', ''),
    par,
    direccion,
    accion,
    resumen,
    usdBias: usd,
    usdRazon: getUSDRazon(usd, items),
    corr12m: corr.corr12m,
    corr3m: corr.corr3m,
    corrLabel12m: getCorrLabel(corr.corr12m),
    corrLabel3m: getCorrLabel(corr.corr3m),
    confianza,
    confianzaRazon: getConfianzaRazon(confianza, corr.corr12m, corr.corr3m, usd),
    drivers,
    notaOperativa,
    updatedAt,
  }
}

export async function getAllNarratives(): Promise<NarrativeData[]> {
  const diagnosis = await getMacroDiagnosis()
  const items = diagnosis.items
  const usd = usdBias(items)
  
  // Obtener datos de bias desde API
  const base = process.env.APP_URL || 'http://localhost:3000'
  let biasData: any = null
  try {
    const res = await fetch(`${base}/api/bias`, { cache: 'no-store' })
    if (res.ok) {
      biasData = await res.json()
    }
  } catch (e) {
    console.error('[narratives] Error fetching bias data:', e)
  }

  if (!biasData?.rows || !Array.isArray(biasData.rows)) {
    return []
  }

  const narratives = await Promise.all(
    biasData.rows.map(async (row: any) => {
      return generateNarrative(
        row.par,
        row.accion,
        row.tactico || (row.accion === 'Buscar compras' ? 'Alcista' : row.accion === 'Buscar ventas' ? 'Bajista' : 'Neutral'),
        row.confianza || 'Media',
        row.motivo || '',
        biasData.updatedAt || null
      )
    })
  )

  // Ordenar: FX primero, luego XAU, índices, cripto
  const order = (par: string) => {
    if (par.includes('/USD') || par.includes('USD/')) return 1
    if (par.includes('XAU')) return 2
    if (['SPX', 'NDX', 'DJI'].includes(par)) return 3
    return 4
  }

  return narratives.sort((a, b) => order(a.par) - order(b.par))
}

export async function getNarrativeBySymbol(symbol: string): Promise<NarrativeData | null> {
  const all = await getAllNarratives()
  const normalized = symbol.toUpperCase().replace('/', '')
  return all.find(n => n.symbol === normalized || n.par.toUpperCase().replace('/', '') === normalized) || null
}

