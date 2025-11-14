/**
 * Test: Freshness SLA por frecuencia
 * Valida que el badge "Desactualizado" solo aparece cuando corresponde según la frecuencia
 */

import { describe, it, expect } from 'vitest'
import { isStaleByFrequency, businessDaysBetween, calendarDaysBetween } from '@/lib/utils/freshness'

describe('Freshness SLA por frecuencia', () => {
  const today = new Date('2025-01-15')
  
  it('Diaria: dato con 4 días hábiles → isStale=true', () => {
    // 4 días hábiles atrás (ej: lunes 2025-01-06 si hoy es lunes 2025-01-13)
    const dateStr = '2025-01-10' // 5 días naturales atrás, ~3-4 días hábiles
    const result = isStaleByFrequency(dateStr, 't10y2y')
    expect(result.frequency).toBe('daily')
    expect(result.isStale).toBe(true) // > 3 días hábiles
  })

  it('Diaria: dato con 2 días hábiles → isStale=false', () => {
    const dateStr = '2025-01-13' // 2 días naturales atrás, ~1-2 días hábiles
    const result = isStaleByFrequency(dateStr, 't10y2y')
    expect(result.frequency).toBe('daily')
    expect(result.isStale).toBe(false) // ≤ 3 días hábiles
  })

  it('Semanal: dato con 9 días naturales → isStale=false', () => {
    const dateStr = '2025-01-06' // 9 días naturales atrás
    const result = isStaleByFrequency(dateStr, 'claims_4w')
    expect(result.frequency).toBe('weekly')
    expect(result.isStale).toBe(false) // ≤ 10 días naturales
  })

  it('Semanal: dato con 11 días naturales → isStale=true', () => {
    const dateStr = '2025-01-04' // 11 días naturales atrás
    const result = isStaleByFrequency(dateStr, 'claims_4w')
    expect(result.frequency).toBe('weekly')
    expect(result.isStale).toBe(true) // > 10 días naturales
  })

  it('Mensual: dato con 45 días naturales → isStale=false', () => {
    const dateStr = '2024-12-01' // 45 días naturales atrás
    const result = isStaleByFrequency(dateStr, 'cpi_yoy')
    expect(result.frequency).toBe('monthly')
    expect(result.isStale).toBe(false) // ≤ 60 días naturales
  })

  it('Mensual: dato con 65 días naturales → isStale=true', () => {
    const dateStr = '2024-11-11' // 65 días naturales atrás
    const result = isStaleByFrequency(dateStr, 'cpi_yoy')
    expect(result.frequency).toBe('monthly')
    expect(result.isStale).toBe(true) // > 60 días naturales
  })

  it('Trimestral: dato con 120 días naturales → isStale=false', () => {
    const dateStr = '2024-09-17' // 120 días naturales atrás
    const result = isStaleByFrequency(dateStr, 'gdp_yoy')
    expect(result.frequency).toBe('quarterly')
    expect(result.isStale).toBe(false) // ≤ 150 días naturales
  })

  it('Trimestral: dato con 160 días naturales → isStale=true', () => {
    const dateStr = '2024-08-08' // 160 días naturales atrás
    const result = isStaleByFrequency(dateStr, 'gdp_yoy')
    expect(result.frequency).toBe('quarterly')
    expect(result.isStale).toBe(true) // > 150 días naturales
  })

  it('Sin fecha → isStale=true', () => {
    const result = isStaleByFrequency(null, 'cpi_yoy')
    expect(result.isStale).toBe(true)
    expect(result.daysDiff).toBe(Infinity)
  })

  it('Indicador desconocido → usa frecuencia mensual por defecto', () => {
    const dateStr = '2024-11-01' // 75 días naturales atrás
    const result = isStaleByFrequency(dateStr, 'unknown_key')
    expect(result.frequency).toBe('monthly') // Default
    expect(result.isStale).toBe(true) // > 60 días naturales
  })
})

describe('Helper functions', () => {
  it('businessDaysBetween calcula correctamente', () => {
    const start = new Date('2025-01-13') // Lunes
    const end = new Date('2025-01-17')   // Viernes
    const days = businessDaysBetween(start, end)
    expect(days).toBe(5) // Lunes, Martes, Miércoles, Jueves, Viernes
  })

  it('calendarDaysBetween calcula correctamente', () => {
    const start = new Date('2025-01-10')
    const end = new Date('2025-01-15')
    const days = calendarDaysBetween(start, end)
    expect(days).toBe(5)
  })
})





