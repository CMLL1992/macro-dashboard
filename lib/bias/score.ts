/**
 * Macro Bias scoring engine
 */

import type {
  MacroBias,
  BiasInputs,
  AssetMeta,
  BiasOptions,
  BiasDriver,
  BiasDriverKey,
} from './types'
import { fetchBiasInputs } from './inputs'
import biasWeights from '@/config/bias.weights.json'

const DRIVER_KEYS: BiasDriverKey[] = [
  'risk_regime',
  'usd_bias',
  'inflation_momentum',
  'growth_momentum',
  'external_balance',
  'rates_context',
]

type DriverComputation = {
  key: BiasDriverKey
  name: string
  rawValue: number | null
  translatedValue: number | null
  context: Record<string, any>
}

const DRIVER_NAMES: Record<BiasDriverKey, string> = {
  risk_regime: 'Risk Regime',
  usd_bias: 'USD Bias',
  inflation_momentum: 'Inflation Momentum',
  growth_momentum: 'Growth Momentum',
  external_balance: 'External Balance',
  rates_context: 'Rates Context',
}

const CLAMP = (value: number, min = -1, max = 1) =>
  Math.max(min, Math.min(max, value))

type DataFreq = 'D' | 'M' | 'A'

function computeFreshnessStatus(freq: DataFreq, lastUpdatedISO: string): { stale: boolean; ageDays: number } {
  const now = Date.now()
  const last = new Date(lastUpdatedISO).getTime()
  const ageMs = Math.max(0, now - last)
  const ageDays = Math.floor(ageMs / 86400000)
  const limits: Record<DataFreq, number> = { D: 3, M: 40, A: 548 }
  const stale = ageDays > limits[freq]
  return { stale, ageDays }
}

function getWeightMap(asset: AssetMeta) {
  const globalWeights = biasWeights.global || {}
  const classWeights =
    biasWeights.by_asset_class?.[asset.class as keyof typeof biasWeights.by_asset_class] || {}

  const weightMap: Record<BiasDriverKey, number> = {
    risk_regime: classWeights.risk_regime ?? globalWeights.risk_regime ?? 0,
    usd_bias: classWeights.usd_bias ?? globalWeights.usd_bias ?? 0,
    inflation_momentum:
      classWeights.inflation_momentum ?? globalWeights.inflation_momentum ?? 0,
    growth_momentum:
      classWeights.growth_momentum ?? globalWeights.growth_momentum ?? 0,
    external_balance:
      classWeights.external_balance ?? globalWeights.external_balance ?? 0,
    rates_context: classWeights.rates_context ?? globalWeights.rates_context ?? 0,
  }

  return weightMap
}

function assetSidesFromSign(sign: 'positive' | 'negative' | 'neutral') {
  if (sign === 'positive') {
    return {
      asset_side: 'los largos',
      asset_side_opposite: 'los cortos',
    }
  }
  if (sign === 'negative') {
    return {
      asset_side: 'los cortos',
      asset_side_opposite: 'los largos',
    }
  }
  return {
    asset_side: 'el mercado',
    asset_side_opposite: 'el otro lado',
  }
}

function translateRiskRegime(inputs: BiasInputs, asset: AssetMeta): DriverComputation {
  const intensity = inputs.risk_regime.intensity
  const baseValue =
    inputs.risk_regime.value ??
    (inputs.risk_regime.regime === 'RISK_ON'
      ? intensity
      : inputs.risk_regime.regime === 'RISK_OFF'
      ? -intensity
      : 0)

  let multiplier = 1

  switch (asset.class) {
    case 'fx':
      if (asset.usd_exposure === 'long_usd') multiplier = -1
      else if (asset.usd_exposure === 'short_usd') multiplier = 1
      else multiplier = asset.risk_sensitivity === 'risk_on' ? 0.75 : -0.5
      break
    case 'metal':
      multiplier = -1
      break
    case 'crypto':
    case 'index':
    case 'energy':
    default:
      multiplier = 1
      break
  }

  if (asset.risk_sensitivity === 'risk_off') {
    multiplier *= -1
  }

  const translatedValue = CLAMP(baseValue * multiplier)

  return {
    key: 'risk_regime',
    name: DRIVER_NAMES.risk_regime,
    rawValue: baseValue,
    translatedValue,
    context: {
      regime:
        inputs.risk_regime.regime === 'RISK_ON'
          ? 'Risk ON'
          : inputs.risk_regime.regime === 'RISK_OFF'
          ? 'Risk OFF'
          : 'Neutral',
      lastUpdated: new Date().toISOString(),
      freq: 'D',
    },
  }
}

function translateUsdBias(inputs: BiasInputs, asset: AssetMeta): DriverComputation {
  const baseValue = inputs.usd_bias.value ?? 0
  let multiplier = 0

  switch (asset.class) {
    case 'fx':
      if (asset.usd_exposure === 'long_usd') multiplier = 1
      else if (asset.usd_exposure === 'short_usd') multiplier = -1
      else multiplier = 0
      break
    case 'metal':
    case 'energy':
      multiplier = -1
      break
    case 'index':
      multiplier = -0.6
      break
    case 'crypto':
      multiplier = -0.5
      break
    default:
      multiplier = 0
  }

  const translatedValue = CLAMP(baseValue * multiplier)

  const usdBiasDir =
    inputs.usd_bias.direction === 'STRONG'
      ? 'fuerte'
      : inputs.usd_bias.direction === 'WEAK'
      ? 'débil'
      : 'neutral'

  return {
    key: 'usd_bias',
    name: DRIVER_NAMES.usd_bias,
    rawValue: baseValue,
    translatedValue,
    context: {
      usd_bias_dir: usdBiasDir,
      effect: translatedValue >= 0 ? 'apoya' : 'penaliza',
      lastUpdated: new Date().toISOString(),
      freq: 'M',
    },
  }
}

function translateInflation(
  inputs: BiasInputs,
  asset: AssetMeta
): DriverComputation {
  const baseValue = inputs.inflation_momentum
  let multiplier = 0.5

  switch (asset.class) {
    case 'metal':
      multiplier = 1
      break
    case 'energy':
      multiplier = 0.8
      break
    case 'index':
      multiplier = -0.6
      break
    case 'crypto':
      multiplier = -0.5
      break
    case 'fx':
      multiplier = asset.usd_exposure === 'short_usd' ? 0.6 : -0.6
      break
    default:
      multiplier = 0.4
  }

  const translatedValue = CLAMP(baseValue * multiplier)

  return {
    key: 'inflation_momentum',
    name: DRIVER_NAMES.inflation_momentum,
    rawValue: baseValue,
    translatedValue,
    context: {
      infl_trend: baseValue >= 0 ? 'acelerando' : 'desacelerando',
      lastUpdated: new Date().toISOString(),
      freq: 'M',
    },
  }
}

function translateGrowth(inputs: BiasInputs, asset: AssetMeta): DriverComputation {
  const baseValue = inputs.growth_momentum
  let multiplier = 0.5

  switch (asset.class) {
    case 'index':
      multiplier = 1
      break
    case 'crypto':
      multiplier = 0.9
      break
    case 'energy':
      multiplier = 0.8
      break
    case 'metal':
      multiplier = -0.5
      break
    case 'fx':
      multiplier = asset.usd_exposure === 'short_usd' ? 0.7 : -0.7
      break
    default:
      multiplier = 0.6
  }

  const translatedValue = CLAMP(baseValue * multiplier)

  return {
    key: 'growth_momentum',
    name: DRIVER_NAMES.growth_momentum,
    rawValue: baseValue,
    translatedValue,
    context: {
      growth_trend: baseValue >= 0 ? 'acelerando' : 'desacelerando',
      lastUpdated: new Date().toISOString(),
      freq: 'M',
    },
  }
}

function translateExternalBalance(
  inputs: BiasInputs,
  asset: AssetMeta
): DriverComputation {
  const baseValue =
    inputs.external_balance.value ??
    (inputs.external_balance.trade_balance_trend +
      inputs.external_balance.current_account_trend) /
      2

  let multiplier = 0.4

  switch (asset.class) {
    case 'fx':
      if (asset.usd_exposure === 'short_usd') multiplier = 1
      else if (asset.usd_exposure === 'long_usd') multiplier = -1
      else multiplier = 0.4
      break
    case 'metal':
    case 'crypto':
      multiplier = 0.2
      break
    case 'index':
    case 'energy':
      multiplier = 0.3
      break
    default:
      multiplier = 0.3
  }

  const translatedValue = CLAMP(baseValue * multiplier)

  return {
    key: 'external_balance',
    name: DRIVER_NAMES.external_balance,
    rawValue: baseValue,
    translatedValue,
    context: {
      trade_trend: inputs.external_balance.trade_balance_trend,
      ca_trend: inputs.external_balance.current_account_trend,
      lastUpdated: new Date().toISOString(),
      freq: 'M',
    },
  }
}

function translateRatesContext(
  inputs: BiasInputs,
  asset: AssetMeta
): DriverComputation {
  if (!inputs.rates_context) {
    return {
      key: 'rates_context',
      name: DRIVER_NAMES.rates_context,
      rawValue: null,
      translatedValue: null,
      context: {},
    }
  }

  const baseValue =
    inputs.rates_context.value ??
    (inputs.rates_context.real_rates + inputs.rates_context.yield_curve) / 2

  let multiplier = 0.5

  switch (asset.class) {
    case 'fx':
      multiplier = asset.usd_exposure === 'long_usd' ? 0.8 : -0.6
      break
    case 'metal':
      multiplier = -1
      break
    case 'crypto':
      multiplier = -0.8
      break
    case 'index':
      multiplier = -0.6
      break
    case 'energy':
      multiplier = -0.4
      break
    default:
      multiplier = 0.5
  }

  const translatedValue = CLAMP(baseValue * multiplier)

  const ratesEffect =
    translatedValue >= 0 ? 'USD y activos defensivos' : 'el riesgo y duration'

  return {
    key: 'rates_context',
    name: DRIVER_NAMES.rates_context,
    rawValue: baseValue,
    translatedValue,
    context: {
      rates_effect: ratesEffect,
      lastUpdated: new Date().toISOString(),
      freq: 'D',
    },
  }
}

function computeDrivers(
  inputs: BiasInputs,
  asset: AssetMeta
): DriverComputation[] {
  return [
    translateRiskRegime(inputs, asset),
    translateUsdBias(inputs, asset),
    translateInflation(inputs, asset),
    translateGrowth(inputs, asset),
    translateExternalBalance(inputs, asset),
    translateRatesContext(inputs, asset),
  ]
}

function normaliseWeights(
  drivers: DriverComputation[],
  weightMap: Record<BiasDriverKey, number>
) {
  const availableDrivers = drivers.filter((d) => d.translatedValue !== null)
  const totalWeight = availableDrivers.reduce(
    (sum, driver) => sum + (weightMap[driver.key] ?? 0),
    0
  )

  const fallbackWeight = availableDrivers.length
    ? 1 / availableDrivers.length
    : 0

  return drivers.map((driver) => {
    if (driver.translatedValue === null) {
      return {
        key: driver.key,
        weight: 0,
      }
    }

    const rawWeight = weightMap[driver.key] ?? 0
    const weight = totalWeight > 0 ? rawWeight / totalWeight : fallbackWeight
    return {
      key: driver.key,
      weight,
    }
  })
}

function determineDirection(score: number) {
  const thresholds = biasWeights.thresholds || {
    strong: 60,
    moderate: 30,
    neutral: 10,
  }

  if (score >= thresholds.neutral) {
    return 'long'
  }
  if (score <= -thresholds.neutral) {
    return 'short'
  }
  return 'neutral'
}

function computeConfidence(
  contributions: BiasDriver[],
  driversTotal: number
): { confidence: number; coverage: number; coherence: number } {
  const config = biasWeights.confidence || {
    min: 0.2,
    max: 0.9,
    coherence_bonus: 0.05,
    conflict_penalty: 0.1,
  }

  const activeDrivers = contributions.filter((d) => d.sign !== 'neutral')
  const coverage = driversTotal
    ? contributions.filter((d) => d.weight > 0).length / driversTotal
    : 0

  const totalPairs = (activeDrivers.length * (activeDrivers.length - 1)) / 2
  let conflicts = 0
  for (let i = 0; i < activeDrivers.length; i++) {
    for (let j = i + 1; j < activeDrivers.length; j++) {
      if (activeDrivers[i].sign !== activeDrivers[j].sign) {
        conflicts++
      }
    }
  }

  const coherence = totalPairs > 0 ? 1 - conflicts / totalPairs : 0.5

  const base = Math.min(
    config.max,
    Math.max(config.min, 0.2 + 0.6 * coverage + 0.2 * coherence)
  )

  let confidence = base

  if (coherence > 0.75) {
    confidence = Math.min(config.max, confidence + (config.coherence_bonus ?? 0))
  } else if (coherence < 0.45) {
    confidence = Math.max(config.min, confidence - (config.conflict_penalty ?? 0))
  }

  return { confidence, coverage, coherence }
}

/**
 * Compute macro bias for an asset
 */
export async function computeMacroBias(
  asset: AssetMeta,
  opts?: BiasOptions
): Promise<MacroBias> {
  const inputs = await fetchBiasInputs(asset.region)

  const driverComputations = computeDrivers(inputs, asset)
  const weightMap = getWeightMap(asset)
  const normalisedWeights = normaliseWeights(driverComputations, weightMap)

  const drivers: BiasDriver[] = []
  let score = 0

  driverComputations.forEach((driver) => {
    const weightEntry = normalisedWeights.find((w) => w.key === driver.key)
    const weight = weightEntry?.weight ?? 0

    if (driver.translatedValue === null || weight === 0) {
      drivers.push({
        key: driver.key,
        name: driver.name,
        weight,
        sign: 'neutral',
        value: 0,
        contribution: 0,
        description: 'Sin datos suficientes',
        context: driver.context,
      })
      return
    }

    const freq = (driver.context?.freq as DataFreq) || 'M'
    const lastUpdated = (driver.context?.lastUpdated as string) || new Date().toISOString()
    const { stale } = computeFreshnessStatus(freq, lastUpdated)

    let contribution = driver.translatedValue * weight * 100
    if (stale) contribution *= 0.5
    score += contribution

    const sign: BiasDriver['sign'] =
      contribution > 1 ? 'positive' : contribution < -1 ? 'negative' : 'neutral'

    drivers.push({
      key: driver.key,
      name: driver.name,
      weight,
      sign,
      value: driver.translatedValue,
      contribution,
      description: `Contribución: ${contribution.toFixed(1)} pts (valor ${driver.translatedValue.toFixed(2)})`,
      context: { ...driver.context, freshnessStatus: stale ? 'stale' : 'fresh' },
    })
  })

  score = Math.max(-100, Math.min(100, score))

  const direction = determineDirection(score)

  const { confidence, coverage, coherence } = computeConfidence(
    drivers,
    DRIVER_KEYS.length
  )

  // Degrade confidence if any stale driver has high weight (>= 0.25)
  const highWeightStale = drivers.some((d) => (d.context?.freshnessStatus === 'stale') && d.weight >= 0.25)
  const adjustedConfidence = Math.max(
    (biasWeights.confidence?.min ?? 0.2),
    Math.min((biasWeights.confidence?.max ?? 0.95), confidence - (highWeightStale ? 0.05 : 0))
  )

  // Ordenar drivers por contribución absoluta
  drivers.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))

  return {
    score,
    direction,
    confidence: adjustedConfidence,
    drivers,
    timestamp: new Date().toISOString(),
    asset: asset.symbol,
    meta: {
      coverage,
      coherence,
      drivers_used: drivers.filter((d) => d.weight > 0).length,
      drivers_total: DRIVER_KEYS.length,
    },
  }
}

