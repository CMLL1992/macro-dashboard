/**
 * Tests for bias weights and narrative builder
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import weightsConfig from '@/config/bias.weights.json'
import { computeMacroBias } from '@/lib/bias/score'
import { buildBiasNarrative } from '@/lib/bias/explain'
import { fetchBiasInputs } from '@/lib/bias/inputs'
import type { AssetMeta, BiasInputs } from '@/lib/bias/types'

vi.mock('@/lib/bias/inputs')
vi.mock('@/lib/datasources/worldbank')
vi.mock('@/lib/datasources/imf')
vi.mock('@/lib/catalog')

describe('bias weights configuration', () => {
  it('global weights sum to 1', () => {
    const sum = Object.values(weightsConfig.global).reduce(
      (acc, value) => acc + value,
      0
    )
    expect(sum).toBeCloseTo(1, 5)
  })

  it('each asset class weights sum to 1', () => {
    const classes = weightsConfig.by_asset_class || {}
    Object.values(classes).forEach((weightMap) => {
      const sum = Object.values(weightMap).reduce(
        (acc, value) => acc + value,
        0
      )
      expect(sum).toBeCloseTo(1, 5)
    })
  })
})

describe('bias narrative and confidence', () => {
  const eurusdAsset: AssetMeta = {
    symbol: 'EURUSD',
    class: 'fx',
    base: 'EUR',
    quote: 'USD',
    risk_sensitivity: 'neutral',
    usd_exposure: 'short_usd',
    region: 'EA',
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('builds bearish narrative for EURUSD sample scenario', async () => {
    const mockInputs: BiasInputs = {
      risk_regime: { regime: 'RISK_OFF', intensity: 0.6, value: -0.6 },
      usd_bias: { direction: 'STRONG', value: 0.7 },
      inflation_momentum: -0.2,
      growth_momentum: -0.3,
      external_balance: {
        trade_balance_trend: 0.1,
        current_account_trend: 0,
        value: 0.1,
      },
      rates_context: { real_rates: 0.2, yield_curve: 0, value: 0.2 },
    }

    vi.mocked(fetchBiasInputs).mockResolvedValueOnce(mockInputs)

    const bias = await computeMacroBias(eurusdAsset)

    expect(bias.direction).toBe('short')
    expect(bias.score).toBeLessThan(-40)
    expect(bias.confidence).toBeGreaterThanOrEqual(0.7)
    expect(bias.meta?.coverage).toBeGreaterThan(0.8)

    const narrative = buildBiasNarrative(bias, eurusdAsset)
    expect(narrative.headline).toMatch(/bajista/i)
    expect(narrative.headline).not.toContain('{')
    expect(narrative.bullets.length).toBeGreaterThanOrEqual(3)
    narrative.bullets.forEach((bullet) => {
      expect(bullet).not.toContain('{')
      expect(bullet.trim().length).toBeGreaterThan(0)
    })
    expect(narrative.confidence_note).toMatch(/Confianza/)
  })

  it('reduces confidence when coverage drops and signals conflict', async () => {
    const baseInputs: BiasInputs = {
      risk_regime: { regime: 'RISK_ON', intensity: 0.3, value: 0.3 },
      usd_bias: { direction: 'STRONG', value: 0.25 },
      inflation_momentum: 0.05,
      growth_momentum: 0.2,
      external_balance: {
        trade_balance_trend: 0.02,
        current_account_trend: 0.02,
        value: 0.02,
      },
      rates_context: { real_rates: -0.2, yield_curve: -0.1, value: -0.15 },
    }

    vi.mocked(fetchBiasInputs).mockResolvedValueOnce(baseInputs)
    const fullBias = await computeMacroBias(eurusdAsset)

    vi.mocked(fetchBiasInputs).mockResolvedValueOnce({
      ...baseInputs,
      rates_context: null,
    })
    const reducedBias = await computeMacroBias(eurusdAsset)

    expect(reducedBias.meta?.coverage || 0).toBeLessThan(
      fullBias.meta?.coverage || 0
    )
    expect(reducedBias.confidence).toBeLessThan(fullBias.confidence)
  })
})

