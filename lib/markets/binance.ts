import type { OHLC } from './stooq'

/**
 * Fetch monthly klines from Binance
 * 
 * CAUSA RAÍZ DEL ERROR 451:
 * Binance devuelve 451 (Unavailable For Legal Reasons) o 403 (Forbidden) cuando
 * el acceso está restringido geográficamente o por otras razones legales.
 * 
 * SOLUCIÓN:
 * En lugar de lanzar excepción que rompe el flujo, lanzamos un error especial
 * que puede ser capturado y manejado elegantemente por el código que llama.
 * El error incluye el código de estado para que el llamador pueda distinguir
 * entre errores transitorios (500) y restricciones legales (451/403).
 */
export class BinanceRestrictionError extends Error {
  constructor(
    public symbol: string,
    public status: number,
    message: string
  ) {
    super(message)
    this.name = 'BinanceRestrictionError'
  }
}

export async function binanceKlinesMonthly(symbol: 'BTCUSDT' | 'ETHUSDT', limit = 120): Promise<OHLC[]> {
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1M&limit=${limit}`
  const r = await fetch(url, { cache: 'no-store' })
  
  if (!r.ok) {
    // 451 = Unavailable For Legal Reasons (restricción geográfica/legal)
    // 403 = Forbidden (puede ser restricción similar)
    if (r.status === 451 || r.status === 403) {
      const errorText = await r.text().catch(() => '')
      console.warn(`[Binance] ${symbol} data unavailable: provider ${r.status} (legal/geo restriction) - ${errorText.substring(0, 100)}`)
      throw new BinanceRestrictionError(
        symbol,
        r.status,
        `Binance ${symbol} ${r.status}: Data unavailable due to legal/geographic restrictions`
      )
    }
    // Otros errores (500, 429, etc.) se lanzan como error normal
    const errorText = await r.text().catch(() => '')
    throw new Error(`Binance ${symbol} ${r.status}: ${errorText.substring(0, 200)}`)
  }
  
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


