/**
 * Macro Bias scoring tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { computeMacroBias } from '@/lib/bias/score'
import type { AssetMeta, BiasInputs } from '@/lib/bias/types'
import { fetchBiasInputs } from '@/lib/bias/inputs'

vi.mock('@/lib/bias/inputs')
vi.mock('@/lib/datasources/worldbank')
vi.mock('@/lib/datasources/imf')
vi.mock('@/lib/catalog')

describe('computeMacroBias', () => {
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

  it('should return MacroBias with correct shape', async () => {
    const mockInputs: BiasInputs = {
      risk_regime: { regime: 'RISK_OFF', intensity: 0.8, value: -0.8 },
      usd_bias: { direction: 'STRONG', value: 0.8 },
      inflation_momentum: -0.2,
      growth_momentum: -0.3,
      external_balance: {
        trade_balance_trend: -0.1,
        current_account_trend: -0.15,
        value: -0.125,
      },
      rates_context: null,
    }

    vi.mocked(fetchBiasInputs).mockResolvedValueOnce(mockInputs)

    const result = await computeMacroBias(eurusdAsset)

    expect(result).toHaveProperty('score')
    expect(result).toHaveProperty('direction')
    expect(result).toHaveProperty('confidence')
    expect(result).toHaveProperty('drivers')
    expect(result).toHaveProperty('timestamp')
    expect(result).toHaveProperty('asset', 'EURUSD')
    expect(Array.isArray(result.drivers)).toBe(true)
  })

  it('should return negative score for EURUSD with RISK_OFF and USD STRONG', async () => {
    const mockInputs: BiasInputs = {
      risk_regime: { regime: 'RISK_OFF', intensity: 0.8, value: -0.8 },
      usd_bias: { direction: 'STRONG', value: 0.8 },
      inflation_momentum: -0.2,
      growth_momentum: -0.3,
      external_balance: {
        trade_balance_trend: -0.1,
        current_account_trend: -0.15,
        value: -0.125,
      },
      rates_context: null,
    }

    vi.mocked(fetchBiasInputs).mockResolvedValueOnce(mockInputs)

    const result = await computeMacroBias(eurusdAsset)

    expect(result.score).toBeLessThan(0)
    expect(result.direction).toBe('short')
  })

  it('should include drivers with correct structure', async () => {
    const mockInputs: BiasInputs = {
      risk_regime: { regime: 'RISK_ON', intensity: 0.7, value: 0.7 },
      usd_bias: { direction: 'WEAK', value: -0.6 },
      inflation_momentum: 0.1,
      growth_momentum: 0.2,
      external_balance: {
        trade_balance_trend: 0.05,
        current_account_trend: 0.1,
        value: 0.075,
      },
      rates_context: null,
    }

    vi.mocked(fetchBiasInputs).mockResolvedValueOnce(mockInputs)

    const result = await computeMacroBias(eurusdAsset)

    expect(result.drivers.length).toBeGreaterThan(0)
    result.drivers.forEach((driver) => {
      expect(driver).toHaveProperty('name')
      expect(driver).toHaveProperty('weight')
      expect(driver).toHaveProperty('sign')
      expect(driver).toHaveProperty('value')
      expect(driver).toHaveProperty('description')
      expect(['positive', 'negative', 'neutral']).toContain(driver.sign)
    })
  })

  it('should calculate confidence based on driver coherence', async () => {
    const mockInputs: BiasInputs = {
      risk_regime: { regime: 'RISK_ON', intensity: 0.9, value: 0.9 },
      usd_bias: { direction: 'WEAK', value: -0.6 },
      inflation_momentum: 0.1,
      growth_momentum: 0.2,
      external_balance: {
        trade_balance_trend: 0.05,
        current_account_trend: 0.1,
        value: 0.075,
      },
      rates_context: null,
    }

    vi.mocked(fetchBiasInputs).mockResolvedValueOnce(mockInputs)

    const result = await computeMacroBias(eurusdAsset)

    expect(result.confidence).toBeGreaterThanOrEqual(0)
    expect(result.confidence).toBeLessThanOrEqual(1)
  })
})

