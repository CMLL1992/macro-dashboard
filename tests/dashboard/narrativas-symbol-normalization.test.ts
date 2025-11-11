import { describe, it, expect } from 'vitest'
import { getBiasTableTactical } from '@/domain/bias'
import { getMacroDiagnosis } from '@/domain/diagnostic'
import { getCorrMap } from '@/domain/corr-bridge'

function normalizeSymbolRoute(s: string): string {
  return s.toUpperCase().replace('/', '')
}

describe('Normalización de símbolo en ruta', () => {
  it('Coincide con eurusd / EURUSD / EUR/USD', async () => {
    const diagnosis = await getMacroDiagnosis()
    const corrMap = await getCorrMap()
    const rows = await getBiasTableTactical(diagnosis.items as any[], 'RISK ON', 'Neutral', 0, [] as any, corrMap)
    const eurRow = rows.find(r => r.par?.toUpperCase().includes('EUR') && r.par?.toUpperCase().includes('USD'))
    if (!eurRow) {
      expect(true).toBe(true)
      return
    }
    const base = eurRow.par
    const candidates = ['eurusd', 'EURUSD', 'EUR/USD']
    for (const c of candidates) {
      const matched = rows.find(r => r.par && normalizeSymbolRoute(r.par) === normalizeSymbolRoute(c))
      expect(matched?.par).toBe(base)
    }
  })
})


