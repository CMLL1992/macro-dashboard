/**
 * Batch upsert for asset prices (optimized for performance)
 * Inserts prices in chunks to avoid timeout and improve performance
 */

import { getUnifiedDB, isUsingTurso } from './unified-db'

const CHUNK_SIZE = 250 // Insert 250 rows at a time

/**
 * Upsert asset prices in batches (chunked)
 * More efficient than one-by-one inserts
 */
export async function upsertAssetPricesBatch(
  symbol: string,
  prices: Array<{
    date: string
    open?: number | null
    high?: number | null
    low?: number | null
    close: number
    volume?: number | null
    source?: string
  }>
): Promise<void> {
  if (prices.length === 0) return

  const db = getUnifiedDB()
  const symbolUpper = symbol.toUpperCase()

  // Process in chunks to avoid timeout and improve performance
  for (let i = 0; i < prices.length; i += CHUNK_SIZE) {
    const chunk = prices.slice(i, i + CHUNK_SIZE)
    
    // Build batch insert statement
    const placeholders = chunk.map(() => '(?, ?, ?, ?, ?, ?, ?, ?)').join(', ')
    const values: any[] = []
    
    for (const price of chunk) {
      values.push(
        symbolUpper,
        price.date,
        price.open ?? null,
        price.high ?? null,
        price.low ?? null,
        price.close,
        price.volume ?? null,
        price.source || 'YAHOO'
      )
    }

    try {
      await db.prepare(`
        INSERT INTO asset_prices (symbol, date, open, high, low, close, volume, source)
        VALUES ${placeholders}
        ON CONFLICT(symbol, date) DO UPDATE SET
          open = excluded.open,
          high = excluded.high,
          low = excluded.low,
          close = excluded.close,
          volume = excluded.volume,
          source = excluded.source
      `).run(...values)
    } catch (error: any) {
      // If batch insert fails (e.g., too many parameters), fall back to individual inserts
      // This can happen if chunk size is too large for SQLite parameter limits
      if (error?.message?.includes('too many') || error?.message?.includes('parameter')) {
        // Fall back to smaller chunks or individual inserts
        const FALLBACK_CHUNK = 100
        for (let j = 0; j < chunk.length; j += FALLBACK_CHUNK) {
          const fallbackChunk = chunk.slice(j, j + FALLBACK_CHUNK)
          const fallbackPlaceholders = fallbackChunk.map(() => '(?, ?, ?, ?, ?, ?, ?, ?)').join(', ')
          const fallbackValues: any[] = []
          
          for (const price of fallbackChunk) {
            fallbackValues.push(
              symbolUpper,
              price.date,
              price.open ?? null,
              price.high ?? null,
              price.low ?? null,
              price.close,
              price.volume ?? null,
              price.source || 'YAHOO'
            )
          }

          await db.prepare(`
            INSERT INTO asset_prices (symbol, date, open, high, low, close, volume, source)
            VALUES ${fallbackPlaceholders}
            ON CONFLICT(symbol, date) DO UPDATE SET
              open = excluded.open,
              high = excluded.high,
              low = excluded.low,
              close = excluded.close,
              volume = excluded.volume,
              source = excluded.source
          `).run(...fallbackValues)
        }
      } else {
        throw error
      }
    }
  }
}
