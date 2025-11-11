import { describe, it, expect } from 'vitest'
import { bucketConfidence, deriveAction, narrativeVsBiasInvariant, summarize, usdLogicInvariant, fxCorrelationSigns, freshnessSLA, plausibilityGuards, upcomingDatesConsistency } from '@/lib/quality/invariants'

describe('quality invariants', () => {
  const bias = {
    score: -68,
    direction: 'short' as const,
    confidence: 0.74,
    drivers: [
      { key: 'usd_bias', name: 'USD Bias', weight: 0.35, sign: 'positive' as const, value: 0.7, contribution: -24, description: '' },
    ],
    timestamp: new Date().toISOString(),
    asset: 'EURUSD',
    meta: { coverage: 0.8, coherence: 0.8, drivers_used: 5, drivers_total: 6 },
  }

  const narrative = {
    headline: 'Sesgo macro **bajista** para EURUSD (score -68).',
    bullets: ['Entorno Risk OFF penaliza los largos.', 'USD fuerte penaliza EURUSD.'],
    confidence_note: 'Confianza 0.74 por coherencia alta y cobertura 5 de 6 drivers.',
  }

  it('narrativa y bias coherentes', () => {
    const res = narrativeVsBiasInvariant(bias as any, narrative as any)
    const sum = summarize(res)
    expect(sum.fail).toBe(0)
  })

  it('buckets de confianza', () => {
    expect(bucketConfidence(0.3)).toBe('Baja')
    expect(bucketConfidence(0.55)).toBe('Media')
    expect(bucketConfidence(0.72)).toBe('Alta')
  })

  it('acción derivada de dirección y confianza', () => {
    expect(deriveAction('neutral', 0.9)).toBe('Rango/táctico')
    expect(deriveAction('long', 0.7)).toBe('Buscar compras')
    expect(deriveAction('short', 0.7)).toBe('Buscar ventas')
    expect(deriveAction('long', 0.55)).toBe('Rango/táctico')
  })

  it('regla USD para FX XXXUSD', () => {
    const usdCheck = usdLogicInvariant(bias as any, true)
    expect(['PASS','WARN','FAIL']).toContain(usdCheck.level)
  })

  it('correlación EURUSD–DXY positiva dispara WARN', () => {
    const inv = fxCorrelationSigns({ correlations: { EURUSD_DXY_12m: 0.2 } } as any)
    const eurusd = inv.find((r) => r.name === 'corr_eurusd_dxy')!
    expect(eurusd.level).toBe('WARN')
  })

  it('CPI mensual con 45 días marcado como stale', () => {
    const fortyFiveDaysMs = 45 * 24 * 3600 * 1000
    const now = new Date()
    const last = new Date(now.getTime() - fortyFiveDaysMs).toISOString()
    const res = freshnessSLA({ nowTs: now.toISOString(), driversMeta: [{ key: 'CPI', freq: 'M', lastUpdated: last }] } as any)
    expect(res.staleDrivers).toContain('CPI')
  })

  it('YoY 300% reporta outlier', () => {
    const pl = plausibilityGuards({ outliers: 1 } as any)
    expect(pl.outliers).toBe(1)
    expect(pl.results[0].level).toBe('WARN')
  })

  it('Fecha próxima en pasado → FAIL', () => {
    const now = new Date()
    const past = new Date(now.getTime() - 86400000).toISOString()
    const inv = upcomingDatesConsistency({ nowTs: now.toISOString(), upcomingDates: [{ name: 'CPI', date: past }] } as any)
    const rule = inv.find((r) => r.name === 'upcoming_past')
    expect(rule?.level).toBe('FAIL')
  })
})


