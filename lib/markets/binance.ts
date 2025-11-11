import type { OHLC } from './stooq'

export async function binanceKlinesMonthly(symbol: 'BTCUSDT' | 'ETHUSDT', limit = 120): Promise<OHLC[]> {
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1M&limit=${limit}`
  const r = await fetch(url, { cache: 'no-store' })
  if (!r.ok) throw new Error(`Binance ${symbol} ${r.status}`)
  const data = await r.json()
  return data.map((k: any) => ({
    date: new Date(k[0]).toISOString().slice(0, 10),
    open: +k[1],
    high: +k[2],
    low: +k[3],
    close: +k[4],
    volume: +k[5],
  }))
}


