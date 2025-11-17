/**
 * Macro Bias types and interfaces
 */

export type RiskRegime = 'RISK_ON' | 'RISK_OFF' | 'NEUTRAL'

export type USDBias = 'STRONG' | 'WEAK' | 'NEUTRAL'

export type BiasDirection = 'long' | 'short' | 'neutral'

export interface MacroBias {
  score: number // [-100, +100]
  direction: BiasDirection
  confidence: number // [0, 1]
  drivers: BiasDriver[]
  timestamp: string
  asset: string
  meta?: {
    coverage: number
    coherence: number
    drivers_used: number
    drivers_total: number
  }
}

export interface BiasDriver {
  key: BiasDriverKey
  name: string
  weight: number
  sign: 'positive' | 'negative' | 'neutral'
  value: number // Normalised [-1, 1] after translation
  contribution: number // Contribution to score
  description: string
  context?: Record<string, any>
}

export interface BiasInputs {
  risk_regime: {
    regime: RiskRegime
    intensity: number // [0, 1]
    value?: number // [-1, 1]
  }
  usd_bias: {
    direction: USDBias
    value: number // [-1, 1]
  }
  inflation_momentum: number // [-1, 1] -1 = disinflación, +1 = aceleración
  growth_momentum: number // [-1, 1] -1 = desaceleración, +1 = aceleración
  external_balance: {
    trade_balance_trend: number // [-1, 1] -1 = deterioro, +1 = mejora
    current_account_trend: number // [-1, 1]
    value?: number // [-1, 1]
  }
  rates_context?: {
    real_rates: number // [-1, 1]
    yield_curve: number // [-1, 1] -1 = invertida, +1 = normal
    value?: number // [-1, 1]
  } | null
}

export interface AssetMeta {
  symbol: string
  class: 'fx' | 'index' | 'metal' | 'crypto' | 'energy'
  base?: string | null
  quote?: string | null
  risk_sensitivity: 'risk_on' | 'risk_off' | 'neutral'
  usd_exposure: 'long_usd' | 'short_usd' | 'mixed' | 'none'
  region: string
}

export interface BiasOptions {
  lookbackDays?: number
  weights?: Record<string, number>
}

export type BiasDriverKey =
  | 'risk_regime'
  | 'usd_bias'
  | 'inflation_momentum'
  | 'growth_momentum'
  | 'external_balance'
  | 'rates_context'

