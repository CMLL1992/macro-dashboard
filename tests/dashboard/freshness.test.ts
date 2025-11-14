/**
 * Test: Freshness de datos tras ingesta
 * Evita fechas antiguas mezcladas con recientes
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getAllLatest } from '@/lib/fred'
import { getMacroDiagnosis } from '@/domain/diagnostic'

// Helper para calcular días hábiles entre dos fechas
function businessDaysBetween(date1: Date, date2: Date): number {
  let count = 0
  const start = new Date(date1)
  const end = new Date(date2)
  
  while (start <= end) {
    const dayOfWeek = start.getDay()
    if (dayOfWeek !== 0 && dayOfWeek !== 6) { // No es sábado ni domingo
      count++
    }
    start.setDate(start.getDate() + 1)
  }
  
  return count
}

describe('Freshness de datos tras ingesta', () => {
  const FRESHNESS_SLA_DAYS = 3 // 3 días hábiles

  it('Todas las series deben tener fechas recientes (≤ 3 días hábiles)', async () => {
    const data = await getAllLatest()
    const today = new Date()
    
    for (const point of data) {
      if (point.value != null && (point as any).date) {
        const pointDate = new Date((point as any).date)
        const businessDays = businessDaysBetween(pointDate, today)
        
        expect(businessDays).toBeLessThanOrEqual(FRESHNESS_SLA_DAYS + 1) // +1 para ser tolerante
      }
    }
  })

  it('getMacroDiagnosis debe devolver fechas consistentes', async () => {
    const diagnosis = await getMacroDiagnosis()
    const today = new Date()
    const dates = diagnosis.items
      .map((i: any) => i.date)
      .filter(Boolean)
      .map((d: string) => new Date(d))
    
    if (dates.length > 0) {
      const maxDate = new Date(Math.max(...dates.map(d => d.getTime())))
      const businessDays = businessDaysBetween(maxDate, today)
      
      // La fecha más reciente debe estar dentro del SLA
      expect(businessDays).toBeLessThanOrEqual(FRESHNESS_SLA_DAYS + 1)
    }
  })

  it('No debe haber fechas futuras', async () => {
    const data = await getAllLatest()
    const today = new Date()
    today.setHours(23, 59, 59, 999) // Fin del día
    
    for (const point of data) {
      if ((point as any).date) {
        const pointDate = new Date((point as any).date)
        expect(pointDate.getTime()).toBeLessThanOrEqual(today.getTime())
      }
    }
  })
})





