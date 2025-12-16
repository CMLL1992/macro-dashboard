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
 * Result type for correlation calculation
 */
export type CorrelationResult = {
  correlation: number | null
  n_obs: number
  last_asset_date: string | null
  last_base_date: string | null
  reasonNull?: 'NO_DATA' | 'STALE_ASSET' | 'STALE_DXY' | 'NO_OVERLAP' | 'TOO_FEW_POINTS' | 'NAN_AFTER_JOIN' | 'EXCEPTION'
  diagnostic?: {
    assetPoints: number
    dxyPoints: number
    alignedPoints: number
    overlapPoints12m: number
    overlapPoints3m: number
    assetLastDate: string | null
    dxyLastDate: string | null
  }
}

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
 * FIX: Forward-fill cronológico correcto (no inicializa lastDate al final)
 */
function alignSeries(
  series1: PricePoint[],
  series2: PricePoint[],
  maxForwardFillDays?: number
): { date: string; value1: number; value2: number }[] {
  const maxDays = maxForwardFillDays ?? CORR_CONFIG.method.fill.max_days ?? 3
  
  // Normalize series first
  const s1 = normalizeSeries(series1)
  const s2 = normalizeSeries(series2)

  // Build maps
  const map1 = new Map(s1.map(p => [p.date, p.value]))
  const map2 = new Map(s2.map(p => [p.date, p.value]))

  // Get all unique dates
  const allDates = new Set([...map1.keys(), ...map2.keys()])
  const sortedDates = Array.from(allDates).sort()
  
  // Filter future dates (data errors)
  const today = new Date().toISOString().slice(0, 10)
  const validDates = sortedDates.filter(d => d <= today)

  // Forward-fill cronológico: last1/last2 se actualizan mientras recorremos fechas
  let last1: number | null = null
  let last1Date: string | null = null
  let last2: number | null = null
  let last2Date: string | null = null

  const aligned: { date: string; value1: number; value2: number }[] = []

  for (const date of validDates) {
    let v1 = map1.get(date)
    let v2 = map2.get(date)

    // Update last values if we have data
    if (v1 != null) {
      last1 = v1
      last1Date = date
    }
    if (v2 != null) {
      last2 = v2
      last2Date = date
    }

    // Forward fill if missing (within maxDays)
    if (v1 == null && last1 != null && last1Date != null) {
      const daysDiff = Math.floor(
        (new Date(date).getTime() - new Date(last1Date).getTime()) / 86400000
      )
      if (daysDiff > 0 && daysDiff <= maxDays) {
        v1 = last1
      }
    }

    if (v2 == null && last2 != null && last2Date != null) {
      const daysDiff = Math.floor(
        (new Date(date).getTime() - new Date(last2Date).getTime()) / 86400000
      )
      if (daysDiff > 0 && daysDiff <= maxDays) {
        v2 = last2
      }
    }

    // Only include if both values are available
    if (v1 != null && v2 != null) {
      aligned.push({ date, value1: v1, value2: v2 })
    }
  }

  return aligned
}

/**
 * Normalize date to YYYY-MM-DD format (UTC, no time)
 * Handles various date formats and timezones
 */
function normalizeDate(dateStr: string): string {
  return dateStr.length >= 10 ? dateStr.slice(0, 10) : dateStr
}

/**
 * Normalize and clean a price series
 */
function normalizeSeries(series: PricePoint[]): PricePoint[] {
  return series
    .map(p => ({ date: normalizeDate(p.date), value: p.value }))
    .filter(p => p.date && Number.isFinite(p.value))
    .sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Calculate correlation between two price series
 * @param assetPrices Asset price series (daily)
 * @param basePrices Base price series (DXY, daily)
 * @param windowDays Number of trading days (252 for 12m, 63 for 3m)
 * @returns Correlation value or null if insufficient data, with diagnostic info
 */
export function calculateCorrelation(
  assetPrices: PricePoint[],
  basePrices: PricePoint[],
  windowDays: number,
  minObs?: number
): CorrelationResult {
  // Normalize series (fechas a YYYY-MM-DD, filtrar inválidos, ordenar)
  const asset = normalizeSeries(assetPrices)
  const base = normalizeSeries(basePrices)

  // Diagnostic info
  const assetLastDate = asset.length > 0 ? asset[asset.length - 1].date : null
  const dxyLastDate = base.length > 0 ? base[base.length - 1].date : null

  // Check for stale data (30 calendar days threshold)
  const today = new Date().toISOString().slice(0, 10)
  const staleThresholdDays = 30 // Calendar days, not business days
  
  if (assetLastDate) {
    const daysDiff = Math.floor(
      (new Date(today).getTime() - new Date(assetLastDate).getTime()) / (1000 * 60 * 60 * 24)
    )
    if (daysDiff > staleThresholdDays) {
      return {
        correlation: null,
        n_obs: 0,
        last_asset_date: assetLastDate,
        last_base_date: dxyLastDate,
        reasonNull: 'STALE_ASSET',
        diagnostic: {
          assetPoints: asset.length,
          dxyPoints: base.length,
          alignedPoints: 0,
          overlapPoints12m: 0,
          overlapPoints3m: 0,
          assetLastDate,
          dxyLastDate,
        },
      }
    }
  }

  if (dxyLastDate) {
    const daysDiff = Math.floor(
      (new Date(today).getTime() - new Date(dxyLastDate).getTime()) / (1000 * 60 * 60 * 24)
    )
    if (daysDiff > staleThresholdDays) {
      return {
        correlation: null,
        n_obs: 0,
        last_asset_date: assetLastDate,
        last_base_date: dxyLastDate,
        reasonNull: 'STALE_DXY',
        diagnostic: {
          assetPoints: asset.length,
          dxyPoints: base.length,
          alignedPoints: 0,
          overlapPoints12m: 0,
          overlapPoints3m: 0,
          assetLastDate,
          dxyLastDate,
        },
      }
    }
  }

  // Check for no data
  if (asset.length === 0) {
    return {
      correlation: null,
      n_obs: 0,
      last_asset_date: assetLastDate,
      last_base_date: dxyLastDate,
      reasonNull: 'NO_DATA',
      diagnostic: {
        assetPoints: 0,
        dxyPoints: base.length,
        alignedPoints: 0,
        overlapPoints12m: 0,
        overlapPoints3m: 0,
        assetLastDate,
        dxyLastDate,
      },
    }
  }

  if (base.length === 0) {
    return {
      correlation: null,
      n_obs: 0,
      last_asset_date: assetLastDate,
      last_base_date: dxyLastDate,
      reasonNull: 'NO_DATA',
      diagnostic: {
        assetPoints: asset.length,
        dxyPoints: 0,
        alignedPoints: 0,
        overlapPoints12m: 0,
        overlapPoints3m: 0,
        assetLastDate,
        dxyLastDate,
      },
    }
  }

  // Align series by date with forward-fill
  const aligned = alignSeries(asset, base)

  // FIX BUG 1: Quitar el "gate" de aligned.length < windowDays
  // Tomar window (si hay menos que windowDays, coge lo que haya)
  const window = aligned.slice(-windowDays)

  // Exigir solo min_obs después del slice
  const requiredObs = minObs ?? (windowDays >= 200 ? 150 : 40)
  
  if (window.length < requiredObs) {
    return {
      correlation: null,
      n_obs: window.length,
      last_asset_date: asset.length > 0 ? asset[asset.length - 1].date : null,
      last_base_date: base.length > 0 ? base[base.length - 1].date : null,
      reasonNull: 'TOO_FEW_POINTS',
      diagnostic: {
        assetPoints: asset.length,
        dxyPoints: base.length,
        alignedPoints: aligned.length,
        overlapPoints12m: window.length,
        overlapPoints3m: window.length,
        assetLastDate,
        dxyLastDate,
      },
    }
  }

  // Calculate log returns
  const assetReturns = calculateLogReturns(
    window.map(p => ({ date: p.date, value: p.value1 }))
  )
  const baseReturns = calculateLogReturns(
    window.map(p => ({ date: p.date, value: p.value2 }))
  )

  // Align returns by date (normalized dates)
  const returnMap1 = new Map(assetReturns.map(r => [normalizeDate(r.date), r.return]))
  const returnMap2 = new Map(baseReturns.map(r => [normalizeDate(r.date), r.return]))
  const commonDates = Array.from(returnMap1.keys())
    .filter(d => returnMap2.has(d))
    .sort()

  // Calculate overlap points for 12m and 3m windows (for diagnostic)
  // Use the actual window size, not hardcoded values
  const window12m = aligned.slice(-Math.min(252, aligned.length)) // 12 months (252 trading days)
  const window3m = aligned.slice(-Math.min(63, aligned.length))  // 3 months (63 trading days)
  
  const returns12m = calculateLogReturns(window12m.map(p => ({ date: p.date, value: p.value1 })))
  const returns3m = calculateLogReturns(window3m.map(p => ({ date: p.date, value: p.value1 })))
  const baseReturns12m = calculateLogReturns(window12m.map(p => ({ date: p.date, value: p.value2 })))
  const baseReturns3m = calculateLogReturns(window3m.map(p => ({ date: p.date, value: p.value2 })))
  
  // Count common dates in returns (after log returns calculation)
  const returns12mDates = new Set(returns12m.map(r => normalizeDate(r.date)))
  const baseReturns12mDates = new Set(baseReturns12m.map(r => normalizeDate(r.date)))
  const overlap12m = Array.from(returns12mDates).filter(d => baseReturns12mDates.has(d)).length

  const returns3mDates = new Set(returns3m.map(r => normalizeDate(r.date)))
  const baseReturns3mDates = new Set(baseReturns3m.map(r => normalizeDate(r.date)))
  const overlap3m = Array.from(returns3mDates).filter(d => baseReturns3mDates.has(d)).length

  if (commonDates.length < requiredObs) {
    return {
      correlation: null,
      n_obs: commonDates.length,
      last_asset_date: assetLastDate,
      last_base_date: dxyLastDate,
      reasonNull: 'TOO_FEW_POINTS',
      diagnostic: {
        assetPoints: asset.length,
        dxyPoints: base.length,
        alignedPoints: aligned.length,
        overlapPoints12m: overlap12m,
        overlapPoints3m: overlap3m,
        assetLastDate,
        dxyLastDate,
      },
    }
  }

  const x = commonDates.map(d => returnMap1.get(d)!)
  const y = commonDates.map(d => returnMap2.get(d)!)

  // Check for NaN/Infinity after join
  const xValid = x.filter(v => Number.isFinite(v))
  const yValid = y.filter((v, i) => Number.isFinite(v) && Number.isFinite(x[i]))
  const xFiltered = x.filter((v, i) => Number.isFinite(v) && Number.isFinite(y[i]))
  const yFiltered = y.filter((v, i) => Number.isFinite(v) && Number.isFinite(x[i]))

  if (xFiltered.length < requiredObs || xFiltered.length !== yFiltered.length) {
    return {
      correlation: null,
      n_obs: xFiltered.length,
      last_asset_date: assetLastDate,
      last_base_date: dxyLastDate,
      reasonNull: 'NAN_AFTER_JOIN',
      diagnostic: {
        assetPoints: asset.length,
        dxyPoints: base.length,
        alignedPoints: aligned.length,
        overlapPoints12m: overlap12m,
        overlapPoints3m: overlap3m,
        assetLastDate,
        dxyLastDate,
      },
    }
  }

  // Winsorize to remove outliers
  const xWinsorized = winsorize(xFiltered)
  const yWinsorized = winsorize(yFiltered)

  // Calculate Pearson correlation
  let corr: number | null
  try {
    corr = pearson(xWinsorized, yWinsorized)
  } catch (error) {
    return {
      correlation: null,
      n_obs: xFiltered.length,
      last_asset_date: assetLastDate,
      last_base_date: dxyLastDate,
      reasonNull: 'EXCEPTION',
      diagnostic: {
        assetPoints: asset.length,
        dxyPoints: base.length,
        alignedPoints: aligned.length,
        overlapPoints12m: overlap12m,
        overlapPoints3m: overlap3m,
        assetLastDate,
        dxyLastDate,
      },
    }
  }

  // Sanitize correlation value: ensure it's a valid number
  // Return null if NaN, Infinity, or not a finite number
  const safeCorr = Number.isFinite(corr) ? corr : null

  return {
    correlation: safeCorr,
    n_obs: xFiltered.length,
    last_asset_date: assetLastDate,
    last_base_date: dxyLastDate,
    reasonNull: safeCorr === null ? 'NAN_AFTER_JOIN' : undefined,
    diagnostic: {
      assetPoints: asset.length,
      dxyPoints: base.length,
      alignedPoints: aligned.length,
      overlapPoints12m: overlap12m,
      overlapPoints3m: overlap3m,
      assetLastDate,
      dxyLastDate,
    },
  }
}

