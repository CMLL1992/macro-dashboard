import { getCorrelations as getCorrRows } from '@/domain/corr-dashboard'
import { norm } from '@/lib/symbols'

export type CorrMap = Map<string, { ref: string; c12: number | null; c6: number | null; c3: number | null }>

export async function getCorrMap(): Promise<CorrMap> {
  try {
    const rows = await getCorrRows()
    const map: CorrMap = new Map()
    
    // Normalizar rows
    if (!Array.isArray(rows)) {
      return map
    }
    
    for (const r of rows) {
      if (!r || typeof r !== 'object') continue
      const N = norm(r.activo ?? '')
      if (!N) continue
      const ref = 'DXY'
      const val = {
        ref,
        c12: r.corr12 ?? null,
        c6: (r as any).corr6 ?? null,
        c3: (r as any).corr3 ?? null,
      }
      map.set(N, val)
      if (N.length === 6) {
        map.set(`${N.slice(0, 3)}/${N.slice(3)}`, val)
        map.set(N.toLowerCase(), val)
        map.set(`${N.slice(0, 3).toLowerCase()}/${N.slice(3).toLowerCase()}`, val)
      } else {
        map.set(r.activo, val)
        map.set(String(r.activo).toUpperCase(), val)
        map.set(String(r.activo).toLowerCase(), val)
      }
    }
    return map
  } catch (error) {
    console.warn('[getCorrMap] Error building correlation map, returning empty map', error)
    return new Map()
  }
}
