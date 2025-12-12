/**
 * Correlation calculation engine
 * Calculates Pearson correlation between log returns of assets and DXY
 */

import { pearson } from '@/domain/correlation'
import fs from 'node:fs'
import path from 'node:path'

// Load correlation config
function loadCorrelationConfig() {
  try {
    const configPath = path.join(process.cwd(), 'config', 'correlations.config.json')
    const raw = fs.readFileSync(configPath, 'utf8')
    return JSON.parse(raw)
  } catch {
    // Defaults
    return {
      windows: {
        w12m: { trading_days: 252, min_obs: 150 },
        w3m: { trading_days: 63, min_obs: 40 },
      },
      method: {
        fill: { max_days: 3 },
        winsorize: { p_low: 0.01, p_high: 0.99 },
      },
    }
  }
}

const CORR_CONFIG = loadCorrelationConfig()

export type PricePoint = { date: string; value: number }

/**
 * Winsorize returns at configured percentiles
 */
function winsorize(values: number[]): number[] {
  if (values.length === 0) return []
  const pLow = CORR_CONFIG.method.winsorize?.p_low ?? 0.01
  const pHigh = CORR_CONFIG.method.winsorize?.p_high ?? 0.99
  const sorted = [...values].sort((a, b) => a - b)
  const p1 = sorted[Math.floor(sorted.length * pLow)] ?? sorted[0]
  const p99 = sorted[Math.floor(sorted.length * pHigh)] ?? sorted[sorted.length - 1]
  return values.map(v => Math.max(p1, Math.min(p99, v)))
}

/**
 * Calculate log returns: log(price_t / price_{t-1})
 */
function calculateLogReturns(prices: PricePoint[]): { date: string; return: number }[] {
  const returns: { date: string; return: number }[] = []
  for (let i = 1; i < prices.length; i++) {
    const prev = prices[i - 1].value
    const curr = prices[i].value
    if (prev > 0 && curr > 0 && Number.isFinite(prev) && Number.isFinite(curr)) {
      const logRet = Math.log(curr / prev)
      if (Number.isFinite(logRet)) {
        returns.push({ date: prices[i].date, return: logRet })
      }
    }
  }
  return returns
}

/**
 * Forward fill prices for up to maxForwardFillDays business days
 * Aligns two series by date, using forward-fill for missing values
 */
function alignSeries(
  series1: PricePoint[],
  series2: PricePoint[],
  maxForwardFillDays?: number
): { date: string; value1: number; value2: number }[] {
  const maxDays = maxForwardFillDays ?? CORR_CONFIG.method.fill.max_days ?? 3
  const map1 = new Map<string, number>()
  const map2 = new Map<string, number>()

  // Build maps with forward-fill logic
  let last1: number | null = null
  let last1Date: string | null = null
  for (const p of series1) {
    map1.set(p.date, p.value)
    last1 = p.value
    last1Date = p.date
  }

  let last2: number | null = null
  let last2Date: string | null = null
  for (const p of series2) {
    map2.set(p.date, p.value)
    last2 = p.value
    last2Date = p.date
  }

  // Get all unique dates, pero solo incluir fechas donde ambas series tienen datos válidos
  // o pueden ser forward-filled
  const allDates = new Set([...map1.keys(), ...map2.keys()])
  const sortedDates = Array.from(allDates).sort()
  
  // Filtrar fechas futuras (errores de datos)
  const today = new Date().toISOString().slice(0, 10)
  const validDates = sortedDates.filter(d => d <= today)

  const aligned: { date: string; value1: number; value2: number }[] = []

  for (const date of validDates) {
    let v1 = map1.get(date)
    let v2 = map2.get(date)

    // Forward fill if missing (within maxDays)
    if (v1 == null && last1 != null && last1Date != null) {
      const daysDiff = Math.floor(
        (new Date(date).getTime() - new Date(last1Date).getTime()) / (1000 * 60 * 60 * 24)
      )
      if (daysDiff <= maxDays && daysDiff > 0) {
        v1 = last1
      }
    }
    if (v2 == null && last2 != null && last2Date != null) {
      const daysDiff = Math.floor(
        (new Date(date).getTime() - new Date(last2Date).getTime()) / (1000 * 60 * 60 * 24)
      )
      if (daysDiff <= maxDays && daysDiff > 0) {
        v2 = last2
      }
    }

    // Update last values
    if (v1 != null) {
      last1 = v1
      last1Date = date
    }
    if (v2 != null) {
      last2 = v2
      last2Date = date
    }

    // Only include if both values are available
    if (v1 != null && v2 != null) {
      aligned.push({ date, value1: v1, value2: v2 })
    }
  }

  return aligned
}

/**
 * Calculate correlation between two price series
 * @param assetPrices Asset price series (daily)
 * @param basePrices Base price series (DXY, daily)
 * @param windowDays Number of trading days (252 for 12m, 63 for 3m)
 * @returns Correlation value or null if insufficient data
 */
export function calculateCorrelation(
  assetPrices: PricePoint[],
  basePrices: PricePoint[],
  windowDays: number,
  minObs?: number
): {
  correlation: number | null
  n_obs: number
  last_asset_date: string | null
  last_base_date: string | null
} {
  // Align series by date with forward-fill
  const aligned = alignSeries(assetPrices, basePrices)

  const requiredObs = minObs ?? (windowDays >= 200 ? 150 : 40)

  if (aligned.length < windowDays) {
    return {
      correlation: null,
      n_obs: aligned.length,
      last_asset_date: assetPrices.length > 0 ? assetPrices[assetPrices.length - 1].date : null,
      last_base_date: basePrices.length > 0 ? basePrices[basePrices.length - 1].date : null,
    }
  }

  // Get last windowDays observations (más recientes)
  const window = aligned.slice(-windowDays)
  
  // Verificar que la última fecha sea reciente (dentro de los últimos 20 días hábiles)
  // Aumentado a 20 días para ser más permisivo con datos de fin de semana/vacaciones y activos menos líquidos
  const lastDate = window[window.length - 1]?.date
  if (lastDate) {
    const lastDateObj = new Date(lastDate)
    const today = new Date()
    const daysDiff = Math.floor((today.getTime() - lastDateObj.getTime()) / (1000 * 60 * 60 * 24))
    if (daysDiff > 20) {
      // Datos demasiado antiguos, no calcular correlación
      return {
        correlation: null,
        n_obs: window.length,
        last_asset_date: assetPrices.length > 0 ? assetPrices[assetPrices.length - 1].date : null,
        last_base_date: basePrices.length > 0 ? basePrices[basePrices.length - 1].date : null,
      }
    }
  }

  // Calculate log returns
  const assetReturns = calculateLogReturns(
    window.map(p => ({ date: p.date, value: p.value1 }))
  )
  const baseReturns = calculateLogReturns(
    window.map(p => ({ date: p.date, value: p.value2 }))
  )

  // Align returns by date
  const returnMap1 = new Map(assetReturns.map(r => [r.date, r.return]))
  const returnMap2 = new Map(baseReturns.map(r => [r.date, r.return]))
  const commonDates = Array.from(returnMap1.keys()).filter(d => returnMap2.has(d)).sort()

  if (commonDates.length < requiredObs) {
    return {
      correlation: null,
      n_obs: commonDates.length,
      last_asset_date: assetPrices.length > 0 ? assetPrices[assetPrices.length - 1].date : null,
      last_base_date: basePrices.length > 0 ? basePrices[basePrices.length - 1].date : null,
    }
  }

  const x = commonDates.map(d => returnMap1.get(d)!)
  const y = commonDates.map(d => returnMap2.get(d)!)

  // Winsorize to remove outliers
  const xWinsorized = winsorize(x)
  const yWinsorized = winsorize(y)

  // Calculate Pearson correlation
  const corr = pearson(xWinsorized, yWinsorized)

  // Sanitize correlation value: ensure it's a valid number
  // Return null if NaN, Infinity, or not a finite number
  const safeCorr = Number.isFinite(corr) ? corr : null

  return {
    correlation: safeCorr,
    n_obs: commonDates.length,
    last_asset_date: assetPrices.length > 0 ? assetPrices[assetPrices.length - 1].date : null,
    last_base_date: basePrices.length > 0 ? basePrices[basePrices.length - 1].date : null,
  }
}

