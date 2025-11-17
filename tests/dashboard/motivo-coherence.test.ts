/**
 * Test: Motivo coherente con USD y correlación
 * Que el campo Motivo sea lógico
 */

import { describe, it, expect } from 'vitest'
import { getBiasTableTactical } from '@/domain/bias'
import { getMacroDiagnosis } from '@/domain/diagnostic'

describe('Motivo coherente con USD y correlación', () => {
  it('USD Débil + corr12m(EURUSD,DXY) < -0.30 → Motivo debe sugerir compras', async () => {
    const diagnosis = await getMacroDiagnosis()
    
    // Simular USD Débil
    const usdBias = 'Débil'
    const regime = 'RISK ON'
    const score = 0.35
    
    const tacticalRows = await getBiasTableTactical(
      diagnosis.items as any[],
      regime,
      usdBias,
      score,
      []
    )
    
    // Buscar EURUSD
    const eurusdRow = tacticalRows.find(r => r.par === 'EUR/USD' || r.par.includes('EUR'))
    
    if (eurusdRow) {
      // Si correlación es negativa fuerte y USD es débil, debería sugerir compras
      if (eurusdRow.corr12m != null && eurusdRow.corr12m < -0.30) {
        // El motivo debe ser coherente con USD débil
        expect(eurusdRow.motivo).toContain('USD')
        expect(eurusdRow.accion).toBe('Buscar compras') // Para pares con USD como divisa cotizada
      }
    }
  })

  it('USD Fuerte + corr12m(USDJPY,DXY) > +0.30 → Motivo debe sugerir compras', async () => {
    const diagnosis = await getMacroDiagnosis()
    
    // Simular USD Fuerte
    const usdBias = 'Fuerte'
    const regime = 'RISK ON'
    const score = -0.35
    
    const tacticalRows = await getBiasTableTactical(
      diagnosis.items as any[],
      regime,
      usdBias,
      score,
      []
    )
    
    // Buscar USDJPY
    const usdjpyRow = tacticalRows.find(r => r.par === 'USD/JPY' || r.par.includes('USDJPY'))
    
    if (usdjpyRow) {
      // Si correlación es positiva fuerte y USD es fuerte, debería sugerir compras (USD al frente)
      if (usdjpyRow.corr12m != null && usdjpyRow.corr12m > 0.30) {
        expect(usdjpyRow.motivo).toContain('USD')
      }
    }
  })

  it('Motivo no debe contradecir el sesgo USD', async () => {
    const diagnosis = await getMacroDiagnosis()
    
    const usdBias = 'Fuerte'
    const regime = 'RISK ON'
    const score = -0.35
    
    const tacticalRows = await getBiasTableTactical(
      diagnosis.items as any[],
      regime,
      usdBias,
      score,
      []
    )
    
    // Para pares con USD como divisa cotizada (EURUSD, GBPUSD, etc.)
    const eurusdRow = tacticalRows.find(r => r.par === 'EUR/USD' || r.par.includes('EUR'))
    
    if (eurusdRow && usdBias === 'Fuerte') {
      // USD fuerte debería sugerir ventas en EURUSD (USD como divisa cotizada)
      expect(eurusdRow.accion).toBe('Buscar ventas')
      expect(eurusdRow.motivo).toContain('USD')
    }
  })
})

