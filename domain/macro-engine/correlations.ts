import { getCorrelations } from '@/domain/corr-dashboard'
import { getCorrMap } from '@/domain/corr-bridge'
import type { BiasState } from '@/domain/macro-engine/bias'
import { logger } from '@/lib/obs/logger'

export type CorrelationWindow = '3m' | '6m' | '12m' | '24m'

export type CorrelationPoint = {
  symbol: string
  benchmark: string
  window: CorrelationWindow
  value: number | null
  sampleSize: number | null
  updatedAt: Date | null
}

export type CorrelationShiftRegime =
  | 'Break'
  | 'Reinforcing'
  | 'Stable'
  | 'Weak'

export type CorrelationShift = {
  symbol: string
  benchmark: string
  corr12m: number | null
  corr3m: number | null
  delta: number | null
  regime: CorrelationShiftRegime
}

export type CorrelationTrend =
  | 'Strengthening'
  | 'Weakening'
  | 'Stable'
  | 'Inconclusive'

export type CorrelationSummary = {
  symbol: string
  benchmark: string
  strongestWindow: CorrelationWindow | null
  correlationNow: number | null
  trend: CorrelationTrend
  macroRelevanceScore: number
}

export type CorrelationState = {
  updatedAt: Date
  benchmark: string
  windows: CorrelationWindow[]
  points: CorrelationPoint[]
  shifts: CorrelationShift[]
  summary: CorrelationSummary[]
}

type RawCorrelationRecord = {
  symbol: string
  benchmark: string
  window: CorrelationWindow | string
  value: number | null
  sampleSize?: number | null
  updatedAt?: Date | string | null
}

const DEFAULT_BENCHMARK = 'DXY'
const SUPPORTED_WINDOWS: CorrelationWindow[] = ['3m', '6m', '12m', '24m']

const clamp = (value: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, value))

async function getRawCorrelations(): Promise<RawCorrelationRecord[]> {
  const records: RawCorrelationRecord[] = []

  // Prefer cached DB correlations (domain/corr-dashboard)
  try {
    const rows = await getCorrelations()
    for (const row of rows) {
      const symbol = row.activo
      if (!symbol) continue
      records.push(
        {
          symbol,
          benchmark: DEFAULT_BENCHMARK,
          window: '3m',
          value: (row as any).corr3 ?? null,
          sampleSize: null,
          updatedAt: null,
        },
        {
          symbol,
          benchmark: DEFAULT_BENCHMARK,
          window: '6m',
          value: (row as any).corr6 ?? null,
          sampleSize: null,
          updatedAt: null,
        },
        {
          symbol,
          benchmark: DEFAULT_BENCHMARK,
          window: '12m',
          value: row.corr12 ?? null,
          sampleSize: null,
          updatedAt: null,
        },
        {
          symbol,
          benchmark: DEFAULT_BENCHMARK,
          window: '24m',
          value: row.corr24 ?? null,
          sampleSize: null,
          updatedAt: null,
        }
      )
    }
  } catch (error) {
    logger.warn('[macro-engine/correlations] getCorrelations failed, falling back to corrMap', { error })
  }

  // Fallback to corrMap if needed (ensures we at least have 3m/6m/12m)
  if (!records.length) {
    const corrMap = await getCorrMap()
    corrMap.forEach((value, key) => {
      records.push(
        {
          symbol: key,
          benchmark: value.ref ?? DEFAULT_BENCHMARK,
          window: '3m',
          value: value.c3 ?? null,
        },
        {
          symbol: key,
          benchmark: value.ref ?? DEFAULT_BENCHMARK,
          window: '6m',
          value: value.c6 ?? null,
        },
        {
          symbol: key,
          benchmark: value.ref ?? DEFAULT_BENCHMARK,
          window: '12m',
          value: value.c12 ?? null,
        }
      )
    })
  }

  return records
}

function normalizeWindow(window: string): CorrelationWindow | null {
  const normalized = window.toLowerCase()
  if (normalized === '3m' || normalized === '90d') return '3m'
  if (normalized === '6m' || normalized === '180d') return '6m'
  if (normalized === '12m' || normalized === '1y') return '12m'
  if (normalized === '24m' || normalized === '2y') return '24m'
  return null
}

function buildCorrelationPoints(raw: RawCorrelationRecord[]): CorrelationPoint[] {
  const points: CorrelationPoint[] = []

  for (const record of raw) {
    const window = normalizeWindow(record.window)
    if (!window) continue
    points.push({
      symbol: record.symbol,
      benchmark: record.benchmark || DEFAULT_BENCHMARK,
      window,
      value: typeof record.value === 'number' ? record.value : record.value ?? null,
      sampleSize:
        typeof record.sampleSize === 'number' ? record.sampleSize : record.sampleSize ?? null,
      updatedAt: record.updatedAt
        ? record.updatedAt instanceof Date
          ? record.updatedAt
          : new Date(record.updatedAt)
        : null,
    })
  }

  return points
}

function detectCorrelationShifts(points: CorrelationPoint[]): CorrelationShift[] {
  const shifts: CorrelationShift[] = []
  const grouped = new Map<string, CorrelationPoint[]>()

  for (const point of points) {
    const key = `${point.symbol}__${point.benchmark}`
    const arr = grouped.get(key) ?? []
    arr.push(point)
    grouped.set(key, arr)
  }

  grouped.forEach((values, key) => {
    const [symbol, benchmark] = key.split('__')
    const corr12m = values.find((p) => p.window === '12m')?.value ?? null
    const corr3m = values.find((p) => p.window === '3m')?.value ?? null
    const delta =
      corr3m != null && corr12m != null ? corr3m - corr12m : null
    const deltaAbs = typeof delta === 'number' ? Math.abs(delta) : null

    let regime: CorrelationShiftRegime = 'Weak'

    if (corr3m == null || corr12m == null) {
      regime = 'Weak'
    } else if (corr12m * corr3m < 0) {
      regime = 'Break'
    } else if (deltaAbs != null && deltaAbs > 0.4) {
      regime = 'Break'
    } else if (Math.abs(corr12m) < 0.3 && Math.abs(corr3m) < 0.3) {
      regime = 'Weak'
    } else if (deltaAbs != null && deltaAbs <= 0.1) {
      regime = 'Stable'
    } else if ((delta ?? 0) > 0) {
      regime = 'Reinforcing'
    } else {
      regime = 'Stable'
    }

    if (corr12m != null || corr3m != null) {
      shifts.push({
        symbol,
        benchmark,
        corr12m,
        corr3m,
        delta,
        regime,
      })
    }
  })

  return shifts
}

function buildCorrelationSummary(
  points: CorrelationPoint[],
  shifts: CorrelationShift[],
  biasState?: BiasState
): CorrelationSummary[] {
  const summaries: CorrelationSummary[] = []
  const grouped = new Map<string, CorrelationPoint[]>()

  for (const point of points) {
    const key = `${point.symbol}__${point.benchmark}`
    const arr = grouped.get(key) ?? []
    arr.push(point)
    grouped.set(key, arr)
  }

  grouped.forEach((values, key) => {
    const [symbol, benchmark] = key.split('__')
    const byWindow = new Map<CorrelationWindow, CorrelationPoint>()
    values.forEach((p) => byWindow.set(p.window, p))

    const windowsOrdered: CorrelationWindow[] = ['3m', '6m', '12m', '24m']
    let strongestWindow: CorrelationWindow | null = null
    let strongestValue = 0
    for (const win of windowsOrdered) {
      const val = byWindow.get(win)?.value
      if (val != null && Math.abs(val) > Math.abs(strongestValue)) {
        strongestValue = val
        strongestWindow = win
      }
    }

    let correlationNow: number | null = null
    for (const win of ['3m', '6m', '12m', '24m'] as CorrelationWindow[]) {
      const val = byWindow.get(win)?.value
      if (val != null) {
        correlationNow = val
        break
      }
    }

    const shift = shifts.find(
      (s) => s.symbol === symbol && s.benchmark === benchmark
    )
    let trend: CorrelationTrend = 'Inconclusive'
    if (!shift || shift.corr3m == null || shift.corr12m == null) {
      trend = 'Inconclusive'
    } else if (Math.abs(shift.corr3m - shift.corr12m) <= 0.1) {
      trend = 'Stable'
    } else if (Math.abs(shift.corr3m) > Math.abs(shift.corr12m)) {
      trend = 'Strengthening'
    } else {
      trend = 'Weakening'
    }

    let baseScore = Math.abs(
      shift?.corr12m ?? shift?.corr3m ?? correlationNow ?? 0
    )
    baseScore = clamp(baseScore)

    if (shift) {
      if (shift.regime === 'Break') baseScore = clamp(baseScore + 0.2)
      if (shift.regime === 'Weak') baseScore = clamp(baseScore - 0.2)
    }

    if (biasState && correlationNow != null) {
      const riskRegime = biasState.regime.risk
      if (riskRegime === 'Risk OFF' && correlationNow > 0.6) {
        baseScore = clamp(baseScore + 0.1)
      } else if (riskRegime === 'Risk ON' && correlationNow < -0.6) {
        baseScore = clamp(baseScore + 0.1)
      }
    }

    summaries.push({
      symbol,
      benchmark,
      strongestWindow,
      correlationNow,
      trend,
      macroRelevanceScore: baseScore,
    })
  })

  return summaries
}

export async function getCorrelationState(): Promise<CorrelationState> {
  try {
    const raw = await getRawCorrelations()
    const points = buildCorrelationPoints(raw)
    const shifts = detectCorrelationShifts(points)
    const summary = buildCorrelationSummary(points, shifts)

    const benchmark =
      points[0]?.benchmark ?? DEFAULT_BENCHMARK
    const windows: CorrelationWindow[] = SUPPORTED_WINDOWS

    const updatedAt =
      points.reduce<Date | null>((acc, point) => {
        if (!point.updatedAt) return acc
        if (!acc) return point.updatedAt
        return point.updatedAt > acc ? point.updatedAt : acc
      }, null) ?? new Date()

    return {
      updatedAt,
      benchmark,
      windows,
      points,
      shifts,
      summary,
    }
  } catch (error) {
    logger.error('[macro-engine/correlations] Failed to build CorrelationState', { error })
    throw error
  }
}

export default getCorrelationState

