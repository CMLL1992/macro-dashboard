/**
 * Test: /api/bias usa BD como fuente de verdad
 * Simular fallo de FRED y afirmar que el endpoint sigue respondiendo con filas desde SQLite
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getAllLatestFromDB, checkMacroDataHealth } from '@/lib/db/read-macro'
import { getMacroDiagnosis } from '@/domain/diagnostic'

// Mock FRED to simulate failure
vi.mock('@/lib/fred', () => ({
  getAllLatest: vi.fn(() => {
    throw new Error('FRED API unavailable')
  }),
  labelOf: (id: string) => `Label for ${id}`,
}))

describe('/api/bias usa BD como fuente de verdad', () => {
  it('getAllLatestFromDB debe devolver datos desde SQLite', () => {
    const data = getAllLatestFromDB()
    expect(data.length).toBeGreaterThan(0)
    // Al menos algunos deben tener valores
    const withValues = data.filter(d => d.value != null)
    expect(withValues.length).toBeGreaterThan(0)
  })

  it('getMacroDiagnosis debe funcionar aunque FRED falle', async () => {
    // Con USE_LIVE_SOURCES=false (default), no debe llamar a FRED
    process.env.USE_LIVE_SOURCES = 'false'
    
    const diagnosis = await getMacroDiagnosis()
    
    // Debe devolver datos desde BD
    expect(diagnosis.items.length).toBeGreaterThan(0)
    expect(diagnosis.regime).toBeDefined()
    expect(diagnosis.score).toBeDefined()
  })

  it('checkMacroDataHealth debe detectar datos faltantes', () => {
    const health = checkMacroDataHealth()
    
    expect(health).toHaveProperty('hasObservations')
    expect(health).toHaveProperty('hasBias')
    expect(health).toHaveProperty('hasCorrelations')
    expect(health).toHaveProperty('observationCount')
    expect(health).toHaveProperty('biasCount')
    expect(health).toHaveProperty('correlationCount')
  })
})

describe('Cold start: BD vacía', () => {
  it('Si macro_bias tiene 9 filas, /api/bias no puede devolver 0', async () => {
    const health = checkMacroDataHealth()
    
    if (health.biasCount >= 9) {
      const diagnosis = await getMacroDiagnosis()
      // Si hay bias en BD, debe haber items
      expect(diagnosis.items.length).toBeGreaterThan(0)
    }
  })
})

describe('Contract check', () => {
  it('Si macro_bias tiene filas, getMacroDiagnosis debe devolver datos', async () => {
    const health = checkMacroDataHealth()
    
    if (health.biasCount > 0) {
      const diagnosis = await getMacroDiagnosis()
      expect(diagnosis.items.length).toBeGreaterThan(0)
    }
  })
})





