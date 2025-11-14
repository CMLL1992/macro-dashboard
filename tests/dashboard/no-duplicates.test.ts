import { describe, it, expect } from 'vitest'
import { getMacroDiagnosis } from '@/domain/diagnostic'

describe('Dashboard - no duplicated labels', () => {
  it('no duplicated labels in macro items', async () => {
    const diag = await getMacroDiagnosis()
    const labels = diag.items.map((i: any) => String(i.label))
    const duplicates = labels.filter((l, i) => labels.indexOf(l) !== i)
    expect(Array.from(new Set(duplicates))).toEqual([])
  })
})






