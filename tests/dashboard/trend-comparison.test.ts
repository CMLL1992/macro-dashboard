/**
 * Test: Comparativa Dato Anterior vs Actual
 * Muestra Dato anterior, Dato actual y Evolución (Mejora/Empeora/Estable)
 */

import { describe, it, expect } from 'vitest'
import { calculateTrend } from '@/domain/trend'

describe('Comparativa Dato Anterior vs Actual', () => {
  describe('Indicadores que mejoran cuando BAJAN', () => {
    it('Inflación CPI: baja = Mejora', () => {
      const trend = calculateTrend('CPIAUCSL', 2.5, 3.0) // Baja de 3.0 a 2.5
      expect(trend).toBe('Mejora')
    })

    it('Inflación CPI: sube = Empeora', () => {
      const trend = calculateTrend('CPIAUCSL', 3.5, 3.0) // Sube de 3.0 a 3.5
      expect(trend).toBe('Empeora')
    })

    it('Desempleo U3: baja = Mejora', () => {
      const trend = calculateTrend('UNRATE', 3.5, 4.0) // Baja de 4.0 a 3.5
      expect(trend).toBe('Mejora')
    })

    it('Desempleo U3: sube = Empeora', () => {
      const trend = calculateTrend('UNRATE', 4.5, 4.0) // Sube de 4.0 a 4.5
      expect(trend).toBe('Empeora')
    })

    it('PCE: cambio < 1% = Estable', () => {
      const trend = calculateTrend('PCEPI', 2.51, 2.50) // Cambio de 0.4% (< 1%)
      expect(trend).toBe('Estable')
    })
  })

  describe('Indicadores que mejoran cuando SUBEN', () => {
    it('GDP YoY: sube = Mejora', () => {
      const trend = calculateTrend('GDPC1', 3.0, 2.5) // Sube de 2.5 a 3.0
      expect(trend).toBe('Mejora')
    })

    it('GDP YoY: baja = Empeora', () => {
      const trend = calculateTrend('GDPC1', 2.0, 2.5) // Baja de 2.5 a 2.0
      expect(trend).toBe('Empeora')
    })

    it('Producción Industrial: sube = Mejora', () => {
      const trend = calculateTrend('INDPRO', 2.5, 2.0) // Sube de 2.0 a 2.5
      expect(trend).toBe('Mejora')
    })

    it('NFP: sube = Mejora', () => {
      const trend = calculateTrend('PAYEMS', 250, 200) // Sube de 200 a 250
      expect(trend).toBe('Mejora')
    })

    it('Ventas Minoristas: cambio < 1% = Estable', () => {
      const trend = calculateTrend('RSXFS', 2.01, 2.00) // Cambio de 0.5% (< 1%)
      expect(trend).toBe('Estable')
    })
  })

  describe('Manejo de valores nulos', () => {
    it('Debe retornar null si falta valor actual', () => {
      const trend = calculateTrend('CPIAUCSL', null, 3.0)
      expect(trend).toBeNull()
    })

    it('Debe retornar null si falta valor previo', () => {
      const trend = calculateTrend('CPIAUCSL', 3.0, null)
      expect(trend).toBeNull()
    })
  })
})





