import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { BiasState } from '@/domain/macro-engine/bias'
import type { CorrelationState } from '@/domain/macro-engine/correlations'
import { determineBias, determineConfidence, determineEnvironment } from '@/domain/macro-engine/trading-playbook'

// Mock data helpers
function createMockBiasState(overrides?: Partial<BiasState>): BiasState {
  return {
    updatedAt: new Date(),
    regime: {
      overall: 'Neutral',
      usd_direction: 'Neutral',
      quad: 'Expansivo',
      liquidity: 'Medium',
      credit: 'Medium',
      risk: 'Neutral',
    },
    metrics: {
      usdScore: 0,
      quadScore: 0,
      liquidityScore: null,
      creditScore: null,
      riskScore: null,
    },
    table: [],
    tableTactical: [],
    ...overrides,
  } as BiasState
}

function createMockCorrelation(corr12m: number | null, corr3m: number | null) {
  return { corr12m, corr3m }
}

describe('Trading Playbook', () => {
  describe('determineBias', () => {
    it('should return LONG for EURUSD when USD is weak and correlation is negative', () => {
      const biasState = createMockBiasState({
        regime: { ...createMockBiasState().regime, usd_direction: 'Débil' },
      })
      const correlation = createMockCorrelation(-0.59, -0.63)
      const config = { correlationSign: -1 }

      const bias = determineBias('EURUSD', 'Débil', 'Neutral', correlation, config, biasState)
      expect(bias).toBe('LONG')
    })

    it('should return SHORT for EURUSD when USD is strong and correlation is negative', () => {
      const biasState = createMockBiasState({
        regime: { ...createMockBiasState().regime, usd_direction: 'Fuerte' },
      })
      const correlation = createMockCorrelation(-0.59, -0.63)
      const config = { correlationSign: -1 }

      const bias = determineBias('EURUSD', 'Fuerte', 'Neutral', correlation, config, biasState)
      expect(bias).toBe('SHORT')
    })

    it('should return LONG for GBPUSD when USD is weak and correlation is negative', () => {
      const biasState = createMockBiasState({
        regime: { ...createMockBiasState().regime, usd_direction: 'Débil' },
      })
      const correlation = createMockCorrelation(-0.51, -0.62)
      const config = { correlationSign: -1 }

      const bias = determineBias('GBPUSD', 'Débil', 'Neutral', correlation, config, biasState)
      expect(bias).toBe('LONG')
    })

    it('should return LONG for DXY when USD direction is strong', () => {
      const biasState = createMockBiasState()
      const correlation = createMockCorrelation(null, null)
      const config = { base: true }

      const bias = determineBias('DXY', 'Fuerte', 'Neutral', correlation, config, biasState)
      expect(bias).toBe('LONG')
    })

    it('should return SHORT for DXY when USD direction is weak', () => {
      const biasState = createMockBiasState()
      const correlation = createMockCorrelation(null, null)
      const config = { base: true }

      const bias = determineBias('DXY', 'Débil', 'Neutral', correlation, config, biasState)
      expect(bias).toBe('SHORT')
    })

    it('should return LONG for XAUUSD when USD is weak and regime is Risk OFF', () => {
      const biasState = createMockBiasState({
        regime: { ...createMockBiasState().regime, usd_direction: 'Débil', overall: 'Risk OFF' },
      })
      const correlation = createMockCorrelation(-0.37, -0.25)
      const config = { correlationSign: -1 }

      const bias = determineBias('XAUUSD', 'Débil', 'Risk OFF', correlation, config, biasState)
      expect(bias).toBe('LONG')
    })

    it('should return NEUTRAL for XAUUSD when signals are mixed', () => {
      const biasState = createMockBiasState({
        regime: { ...createMockBiasState().regime, usd_direction: 'Débil', overall: 'Risk ON' },
      })
      const correlation = createMockCorrelation(-0.37, -0.25)
      const config = { correlationSign: -1 }

      const bias = determineBias('XAUUSD', 'Débil', 'Risk ON', correlation, config, biasState)
      expect(bias).toBe('NEUTRAL')
    })

    it('should return LONG for USDJPY when USD is strong', () => {
      const biasState = createMockBiasState({
        regime: { ...createMockBiasState().regime, usd_direction: 'Fuerte' },
      })
      const correlation = createMockCorrelation(0.43, 0.55)
      const config = { correlationSign: +1 }

      const bias = determineBias('USDJPY', 'Fuerte', 'Neutral', correlation, config, biasState)
      expect(bias).toBe('LONG')
    })

    it('should return SHORT for USDJPY when USD is weak', () => {
      const biasState = createMockBiasState({
        regime: { ...createMockBiasState().regime, usd_direction: 'Débil' },
      })
      const correlation = createMockCorrelation(0.43, 0.55)
      const config = { correlationSign: +1 }

      const bias = determineBias('USDJPY', 'Débil', 'Neutral', correlation, config, biasState)
      expect(bias).toBe('SHORT')
    })
  })

  describe('determineConfidence', () => {
    it('should return high confidence for strong correlation and clear regime', () => {
      const correlation = createMockCorrelation(-0.65, -0.70)
      const confidence = determineConfidence('EURUSD', correlation, 'LONG', 'Débil', 'Risk OFF')
      expect(confidence).toBe('high')
    })

    it('should return medium confidence for moderate correlation', () => {
      const correlation = createMockCorrelation(-0.45, -0.50)
      const confidence = determineConfidence('EURUSD', correlation, 'LONG', 'Débil', 'Neutral')
      expect(confidence).toBe('medium')
    })

    it('should return low confidence for neutral bias', () => {
      const correlation = createMockCorrelation(-0.20, -0.25)
      const confidence = determineConfidence('EURUSD', correlation, 'NEUTRAL', 'Neutral', 'Neutral')
      expect(confidence).toBe('low')
    })

    it('should return low confidence for weak correlation', () => {
      const correlation = createMockCorrelation(-0.15, -0.20)
      const confidence = determineConfidence('EURUSD', correlation, 'LONG', 'Neutral', 'Neutral')
      expect(confidence).toBe('low')
    })
  })

  describe('determineEnvironment', () => {
    it('should return range for neutral bias', () => {
      const correlation = createMockCorrelation(-0.59, -0.63)
      const environment = determineEnvironment('EURUSD', 'NEUTRAL', correlation, 'low', 'Neutral', 'Neutral')
      expect(environment).toBe('range')
    })

    it('should return range for low confidence', () => {
      const correlation = createMockCorrelation(-0.20, -0.25)
      const environment = determineEnvironment('EURUSD', 'LONG', correlation, 'low', 'Neutral', 'Débil')
      expect(environment).toBe('range')
    })

    it('should return range when correlations diverge significantly', () => {
      const correlation = createMockCorrelation(-0.60, -0.20) // Large divergence
      const environment = determineEnvironment('EURUSD', 'LONG', correlation, 'high', 'Risk OFF', 'Débil')
      expect(environment).toBe('range')
    })

    it('should return trend for strong signals and aligned correlations', () => {
      const correlation = createMockCorrelation(-0.59, -0.63) // Aligned
      const environment = determineEnvironment('EURUSD', 'LONG', correlation, 'high', 'Risk OFF', 'Débil')
      expect(environment).toBe('trend')
    })
  })
})

