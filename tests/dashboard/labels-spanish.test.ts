/**
 * Test: Etiquetas en español
 * Uniformidad total de nombres
 */

import { describe, it, expect } from 'vitest'
import { labelOf } from '@/lib/fred'
import { getMacroDiagnosis } from '@/domain/diagnostic'

const EXPECTED_LABELS: Record<string, string> = {
  T10Y2Y: 'Curva 10Y–2Y (spread %)',
  FEDFUNDS: 'Tasa Efectiva de Fondos Federales',
  GDPC1: 'PIB Interanual (GDP YoY)',
  GDPC1_QOQ: 'PIB Trimestral (GDP QoQ Anualizado)',
  INDPRO: 'Producción Industrial (YoY)',
  RSXFS: 'Ventas Minoristas (YoY)',
  PAYEMS: 'Nóminas No Agrícolas (NFP Δ miles)',
  UNRATE: 'Tasa de Desempleo (U3)',
  ICSA: 'Solicitudes Iniciales de Subsidio por Desempleo (Media 4 semanas)',
  CPIAUCSL: 'Inflación CPI (YoY)',
  CPILFESL: 'Inflación Core CPI (YoY)',
  PCEPI: 'Inflación PCE (YoY)',
  PCEPILFE: 'Inflación Core PCE (YoY)',
  PPIACO: 'Índice de Precios al Productor (PPI YoY)',
  VIXCLS: 'Índice de Volatilidad VIX',
}

describe('Etiquetas en español', () => {
  it('Todas las etiquetas deben coincidir exactamente con las esperadas', () => {
    for (const [key, expectedLabel] of Object.entries(EXPECTED_LABELS)) {
      const actualLabel = labelOf(key)
      expect(actualLabel).toBe(expectedLabel)
    }
  })

  it('getMacroDiagnosis debe devolver etiquetas en español', async () => {
    const diagnosis = await getMacroDiagnosis()
    
    for (const item of diagnosis.items) {
      // Verificar que la etiqueta no contiene texto en inglés común
      const englishPatterns = [
        /GDP\s+(?!YoY|QoQ)/i,
        /CPI\s+(?!YoY)/i,
        /PCE\s+(?!YoY)/i,
        /Unemployment\s+Rate/i,
        /Retail\s+Sales/i,
        /Industrial\s+Production/i,
        /Volatility\s+Index/i,
      ]
      
      for (const pattern of englishPatterns) {
        expect(item.label).not.toMatch(pattern)
      }
      
      // Verificar que contiene siglas oficiales cuando corresponde
      if (item.key === 'PAYEMS') {
        expect(item.label).toContain('NFP')
      }
      if (item.key === 'UNRATE') {
        expect(item.label).toContain('U3')
      }
      if (item.key === 'CPIAUCSL' || item.key === 'CPILFESL') {
        expect(item.label).toContain('CPI')
      }
      if (item.key === 'PCEPI' || item.key === 'PCEPILFE') {
        expect(item.label).toContain('PCE')
      }
      if (item.key === 'PPIACO') {
        expect(item.label).toContain('PPI')
      }
      if (item.key === 'VIXCLS' || item.key === 'VIX') {
        expect(item.label).toContain('VIX')
      }
      if (item.key === 'GDPC1') {
        expect(item.label).toContain('GDP')
      }
    }
  })

  it('No debe haber etiquetas en inglés', async () => {
    const diagnosis = await getMacroDiagnosis()
    const englishLabels = [
      'Gross Domestic Product',
      'Consumer Price Index',
      'Personal Consumption Expenditures',
      'Unemployment Rate',
      'Retail Sales',
      'Industrial Production',
      'Volatility Index',
    ]
    
    for (const item of diagnosis.items) {
      for (const englishLabel of englishLabels) {
        expect(item.label).not.toContain(englishLabel)
      }
    }
  })
})





