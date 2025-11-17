import { stooqSeries, STOOQ, type OHLC } from './stooq'
import { binanceKlinesMonthly, BinanceRestrictionError } from './binance'

export { OHLC, stooqSeries, STOOQ, binanceKlinesMonthly, BinanceRestrictionError }

export type ClosePoint = { date: string; value: number }

export function toClose(series: OHLC[]): ClosePoint[] {
  return series.map(s => ({ date: s.date, value: s.close }))
}

export function resampleToMonthly(series: ClosePoint[]): ClosePoint[] {
  const map = new Map<string, ClosePoint>()
  for (const p of series) {
    const ym = p.date.slice(0, 7)
    const prev = map.get(ym)
    if (!prev || prev.date < p.date) map.set(ym, p)
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([, v]) => v)
}

export function alignByMonth(a: ClosePoint[], b: ClosePoint[]) {
  const mb = new Map(b.map(p => [p.date.slice(0, 7), p.value]))
  const xs: number[] = [], ys: number[] = []
  for (const p of a) {
    const ym = p.date.slice(0, 7)
    const v = mb.get(ym)
    if (v != null && p.value != null) { xs.push(p.value); ys.push(v) }
  }
  return { x: xs, y: ys }
}


