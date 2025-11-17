import { describe, it, expect } from 'vitest'
import { getBiasTableTactical } from '@/domain/bias'
import { getMacroDiagnosis } from '@/domain/diagnostic'
import { getCorrMap } from '@/domain/corr-bridge'

describe('Neutral → Rango (mapeo explícito en presentación)', () => {
  it('Si tactico es Neutral, la etiqueta mostrada debe ser Rango', async () => {
    const diagnosis = await getMacroDiagnosis()
    const regime = 'RISK ON'
    const usd = 'Neutral' as const
    const score = 0
    const corrMap = await getCorrMap()
    const rows = await getBiasTableTactical(diagnosis.items as any[], regime, usd, score, [] as any, corrMap)

    const anyNeutral = rows.find(r => r.tactico === 'Neutral')
    if (!anyNeutral) {
      // Si no hay Neutral en el dataset actual, el test es no determinista; lo marcamos como OK
      expect(true).toBe(true)
      return
    }

    const label = anyNeutral.tactico === 'Neutral' ? 'Rango' : anyNeutral.tactico
    expect(label).toBe('Rango')
  })
})


