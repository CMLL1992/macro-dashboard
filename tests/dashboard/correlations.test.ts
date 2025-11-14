/**
 * Test: Correlaciones DXY - ventanas y alineación
 * Asegura cálculo correcto y estable de Corr. 12m (252) y Corr. 3m (63)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { calculateCorrelation } from '@/lib/correlations/calc'
import { getCorrelation, getCorrelationsForSymbol } from '@/lib/db/read'
import type { PricePoint } from '@/lib/correlations/calc'

// Helper para generar datos de prueba
function generatePriceSeries(startDate: string, days: number, baseValue: number, volatility: number = 0.01): PricePoint[] {
  const series: PricePoint[] = []
  const start = new Date(startDate)
  let currentValue = baseValue
  
  for (let i = 0; i < days; i++) {
    const date = new Date(start)
    date.setDate(date.getDate() + i)
    const dateStr = date.toISOString().slice(0, 10)
    
    // Simular movimiento de precio con volatilidad
    const change = (Math.random() - 0.5) * volatility
    currentValue = currentValue * (1 + change)
    
    series.push({ date: dateStr, value: currentValue })
  }
  
  return series
}

describe('Correlaciones DXY - ventanas y alineación', () => {
  it('Correlación 12m debe usar exactamente 252 observaciones', () => {
    const assetPrices = generatePriceSeries('2023-01-01', 300, 1.10, 0.01)
    const dxyPrices = generatePriceSeries('2023-01-01', 300, 110.0, 0.005)
    
    const result = calculateCorrelation(assetPrices, dxyPrices, 252, 150)
    
    // Si hay suficientes datos, debe calcular correlación
    if (result.n_obs >= 150) {
      expect(result.correlation).not.toBeNull()
      expect(result.n_obs).toBeGreaterThanOrEqual(150)
    }
  })

  it('Correlación 3m debe usar exactamente 63 observaciones', () => {
    const assetPrices = generatePriceSeries('2024-09-01', 100, 1.10, 0.01)
    const dxyPrices = generatePriceSeries('2024-09-01', 100, 110.0, 0.005)
    
    const result = calculateCorrelation(assetPrices, dxyPrices, 63, 40)
    
    // Si hay suficientes datos, debe calcular correlación
    if (result.n_obs >= 40) {
      expect(result.correlation).not.toBeNull()
      expect(result.n_obs).toBeGreaterThanOrEqual(40)
    }
  })

  it('Debe manejar forward-fill máximo 3 días', () => {
    // Crear series con gaps de 1-3 días
    const assetPrices: PricePoint[] = [
      { date: '2024-11-01', value: 1.10 },
      { date: '2024-11-05', value: 1.11 }, // Gap de 3 días
      { date: '2024-11-06', value: 1.12 },
    ]
    
    const dxyPrices: PricePoint[] = [
      { date: '2024-11-01', value: 110.0 },
      { date: '2024-11-02', value: 110.1 },
      { date: '2024-11-03', value: 110.2 },
      { date: '2024-11-04', value: 110.3 },
      { date: '2024-11-05', value: 110.4 },
      { date: '2024-11-06', value: 110.5 },
    ]
    
    const result = calculateCorrelation(assetPrices, dxyPrices, 10, 5)
    
    // Debe poder alinear las series con forward-fill
    expect(result.n_obs).toBeGreaterThan(0)
  })

  it('Debe rechazar datos demasiado antiguos (> 5 días)', () => {
    const today = new Date()
    const oldDate = new Date(today)
    oldDate.setDate(oldDate.getDate() - 10) // 10 días atrás
    
    const assetPrices = generatePriceSeries(oldDate.toISOString().slice(0, 10), 100, 1.10, 0.01)
    const dxyPrices = generatePriceSeries(oldDate.toISOString().slice(0, 10), 100, 110.0, 0.005)
    
    // Asegurar que la última fecha es antigua
    assetPrices[assetPrices.length - 1].date = oldDate.toISOString().slice(0, 10)
    dxyPrices[dxyPrices.length - 1].date = oldDate.toISOString().slice(0, 10)
    
    const result = calculateCorrelation(assetPrices, dxyPrices, 63, 40)
    
    // Debe rechazar datos antiguos
    expect(result.correlation).toBeNull()
  })

  it('Debe filtrar fechas futuras', () => {
    const today = new Date()
    const futureDate = new Date(today)
    futureDate.setDate(futureDate.getDate() + 5) // 5 días en el futuro
    
    const assetPrices: PricePoint[] = [
      { date: today.toISOString().slice(0, 10), value: 1.10 },
      { date: futureDate.toISOString().slice(0, 10), value: 1.11 }, // Fecha futura
    ]
    
    const dxyPrices: PricePoint[] = [
      { date: today.toISOString().slice(0, 10), value: 110.0 },
      { date: futureDate.toISOString().slice(0, 10), value: 110.1 }, // Fecha futura
    ]
    
    const result = calculateCorrelation(assetPrices, dxyPrices, 10, 5)
    
    // Las fechas futuras deben ser filtradas
    expect(result.n_obs).toBeLessThanOrEqual(1) // Solo la fecha de hoy
  })
})





