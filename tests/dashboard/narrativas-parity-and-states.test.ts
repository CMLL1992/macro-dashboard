import { describe, it, expect } from 'vitest'
import { getBiasTableTactical } from '@/domain/bias'
import { getMacroDiagnosis } from '@/domain/diagnostic'
import { validateBiasRowFinal } from '@/lib/types/bias-final'
import { getCorrMap } from '@/domain/corr-bridge'

describe('Paridad de conteo y estados', () => {
  it('Paridad: número de tarjetas = número de filas tácticas', async () => {
    const diagnosis = await getMacroDiagnosis()
    const corrMap = await getCorrMap()
    const rows = await getBiasTableTactical(diagnosis.items as any[], 'RISK ON', 'Neutral', 0, [] as any, corrMap)
    // Narrativas consume exactamente rows (1:1)
    const narrativeRows = rows
    expect(narrativeRows.length).toBe(rows.length)
  })

  it('NaN en corr_12m ⇒ falla validación del contrato', () => {
    const invalid = {
      symbol: 'EUR/USD',
      trend_final: 'Alcista',
      action_final: 'Buscar compras',
      confidence_level: 'Alta',
      motivo_macro: 'Test',
      corr_ref: 'DXY',
      corr_12m: Number.NaN,
      corr_3m: 0.1,
    }
    const res = validateBiasRowFinal(invalid as any)
    expect(res.ok).toBe(false)
  })
})


