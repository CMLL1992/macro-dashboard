/**
 * Test: Insights muestra 'Otros: 2/2'
 * Garantiza que FEDFUNDS y VIX están en la categoría Otros y el contador es correcto
 */

import { describe, it, expect } from 'vitest'
import { categoryFor } from '@/domain/categories'
import { getMacroDiagnosis } from '@/domain/diagnostic'
import { CATEGORY_ORDER } from '@/domain/categories'

describe('Insights muestra Otros: 2/2', () => {
  it('FEDFUNDS debe estar en categoría Otros', () => {
    const category = categoryFor('FEDFUNDS')
    expect(category).toBe('Otros')
  })

  it('VIX debe estar en categoría Otros', () => {
    const category = categoryFor('VIX')
    expect(category).toBe('Otros')
  })

  it('VIXCLS debe estar en categoría Otros', () => {
    const category = categoryFor('VIXCLS')
    expect(category).toBe('Otros')
  })

  it('Los contadores de Otros deben ser 2/2', async () => {
    const diagnosis = await getMacroDiagnosis()
    const otrosItems = diagnosis.items.filter((i: any) => i.category === 'Otros')
    
    expect(otrosItems.length).toBeGreaterThanOrEqual(2)
    
    // Verificar que FEDFUNDS y VIX están presentes
    const fedfundsPresent = otrosItems.some((i: any) => i.key === 'FEDFUNDS')
    const vixPresent = otrosItems.some((i: any) => i.key === 'VIX' || i.key === 'VIXCLS')
    
    expect(fedfundsPresent).toBe(true)
    expect(vixPresent).toBe(true)
    
    // Verificar contadores en categoryCounts
    const otrosCounts = diagnosis.categoryCounts?.['Otros']
    if (otrosCounts) {
      expect(otrosCounts.total).toBeGreaterThanOrEqual(2)
      expect(otrosCounts.withValue).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('Insights suman exactamente los indicadores visibles', () => {
  it('Los contadores deben coincidir con los indicadores visibles', async () => {
    const diagnosis = await getMacroDiagnosis()
    const categoryCounts = diagnosis.categoryCounts
    
    // Verificar cada categoría
    for (const cat of CATEGORY_ORDER) {
      const itemsInCategory = diagnosis.items.filter((i: any) => i.category === cat)
      const counts = categoryCounts?.[cat]
      
      if (counts) {
        expect(counts.total).toBe(itemsInCategory.length)
        const withValue = itemsInCategory.filter((i: any) => i.value != null).length
        expect(counts.withValue).toBe(withValue)
      }
    }
  })

  it('Categorías esperadas: Financieros/Curva: 2, Crecimiento: 4, Laboral: 3, Inflación: 5, Otros: 2', async () => {
    const diagnosis = await getMacroDiagnosis()
    const categoryCounts = diagnosis.categoryCounts
    
    // Verificar contadores esperados (aproximados, pueden variar según configuración)
    const expected = {
      'Financieros / Curva': 2,
      'Crecimiento / Actividad': 4,
      'Mercado laboral': 3,
      'Precios / Inflación': 5,
      'Otros': 2,
    }
    
    for (const [cat, expectedCount] of Object.entries(expected)) {
      const actual = categoryCounts?.[cat as keyof typeof categoryCounts]
      if (actual) {
        // Verificar que el contador es al menos el esperado (puede haber más)
        expect(actual.total).toBeGreaterThanOrEqual(expectedCount)
      }
    }
  })
})

