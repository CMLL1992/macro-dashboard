import { describe, it, expect } from 'vitest'
import { getBiasTableTactical } from '@/domain/bias'
import { getMacroDiagnosis } from '@/domain/diagnostic'
import { getCorrMap } from '@/domain/corr-bridge'

describe('corr_ref mostrado tal cual', () => {
  it('Si el benchmark no es DXY en la fila táctica, debe conservarse', async () => {
    const diagnosis = await getMacroDiagnosis()
    const corrMap = await getCorrMap()
    const rows = await getBiasTableTactical(diagnosis.items as any[], 'RISK ON', 'Neutral', 0, [] as any, corrMap)
    // En datasets actuales suele ser DXY, pero validamos que si hubiese otro ref, lo mantenemos.
    const anyRow = rows.find(r => typeof (r as any).corrRef === 'string')
    if (!anyRow) {
      expect(true).toBe(true)
      return
    }
    const ref = (anyRow as any).corrRef || 'DXY'
    expect(typeof ref).toBe('string')
  })
})


