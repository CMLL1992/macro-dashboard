/**
 * Job: Ingest asset prices (forex, indices, crypto)
 * POST /api/jobs/ingest/assets
 * Protected by CRON_TOKEN
 * 
 * Fetches and stores daily prices for:
 * - All forex pairs
 * - Major indices (including NASDAQ)
 * - Top 25 cryptocurrencies from CoinMarketCap
 */

export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { validateCronToken, unauthorizedResponse } from '@/lib/security/token'
import { logger } from '@/lib/obs/logger'
import { upsertAssetPrice, upsertAssetMetadata } from '@/lib/db/upsert'
import { upsertAssetPricesBatch } from '@/lib/db/upsert-asset-prices-batch'
import { fetchAssetDaily, fetchDXYDaily } from '@/lib/correlations/fetch'
import { fetchTopCryptocurrencies, fetchCoinMarketCapLatest } from '@/lib/datasources/coinmarketcap'
import { getJobState, saveJobState } from '@/lib/db/job-state'
import fs from 'fs'
import path from 'path'

// Load assets configuration
function loadAssetsConfig() {
  try {
    const configPath = path.join(process.cwd(), 'config', 'assets.config.json')
    const raw = fs.readFileSync(configPath, 'utf8')
    return JSON.parse(raw)
  } catch (error) {
    logger.error('Failed to load assets config', { error })
    return { forex: [], indices: [], metals: [], crypto: [] }
  }
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

/**
 * Fetch Yahoo Finance daily OHLCV data with retry and timeout
 * Handles SSL errors, network timeouts, and connection resets gracefully
 */
async function fetchYahooOHLCV(
  symbol: string, 
  period: string = '1mo',
  maxRetries: number = 3
): Promise<Array<{
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}>> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=${encodeURIComponent(period)}&includePrePost=false`
  const REQUEST_TIMEOUT_MS = 20000 // 20 seconds per request
  
  let lastError: Error | null = null
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
      
      try {
        const r = await fetch(url, {
          headers: { 'User-Agent': UA, Accept: 'application/json' },
          cache: 'no-store',
          signal: controller.signal,
        })
        clearTimeout(timeoutId)
        
        if (!r.ok) throw new Error(`Yahoo ${symbol} ${r.status}`)
        
        const j = await r.json()
        const res = j?.chart?.result?.[0]
        if (!res?.timestamp || !res?.indicators?.quote?.[0]) return []
        
        const ts: number[] = res.timestamp
        const quote = res.indicators.quote[0]
        const opens: (number | null)[] = quote.open || []
        const highs: (number | null)[] = quote.high || []
        const lows: (number | null)[] = quote.low || []
        const closes: (number | null)[] = quote.close || []
        const volumes: (number | null)[] = quote.volume || []
        
        const out: Array<{
          date: string
          open: number
          high: number
          low: number
          close: number
          volume: number
        }> = []
        
        for (let i = 0; i < ts.length; i++) {
          const t = ts[i]
          const open = opens[i]
          const high = highs[i]
          const low = lows[i]
          const close = closes[i]
          const volume = volumes[i] || 0
          
          if (close == null || Number.isNaN(close)) continue
          
          const d = new Date(t * 1000)
          const date = d.toISOString().slice(0, 10)
          
          out.push({
            date,
            open: open ?? close,
            high: high ?? close,
            low: low ?? close,
            close,
            volume: volume || 0,
          })
        }
        
        return out.sort((a, b) => a.date.localeCompare(b.date))
      } catch (fetchError: any) {
        clearTimeout(timeoutId)
        if (fetchError.name === 'AbortError') {
          lastError = new Error(`Yahoo ${symbol} timeout after ${REQUEST_TIMEOUT_MS}ms`)
        } else {
          lastError = fetchError instanceof Error ? fetchError : new Error(String(fetchError))
        }
        throw lastError
      }
    } catch (error: any) {
      lastError = error instanceof Error ? error : new Error(String(error))
      
      // Check if it's an SSL/network error that we should retry
      const isRetryable = 
        error.message?.includes('SSL') ||
        error.message?.includes('ECONNRESET') ||
        error.message?.includes('ETIMEDOUT') ||
        error.message?.includes('ENOTFOUND') ||
        error.message?.includes('ECONNREFUSED') ||
        error.name === 'AbortError' ||
        error.code === 'ECONNRESET' ||
        error.code === 'ETIMEDOUT' ||
        error.code === 'ENOTFOUND'
      
      if (attempt < maxRetries && isRetryable) {
        const backoffMs = attempt * 500 // 500ms, 1000ms, 1500ms
        logger.warn(`Yahoo fetch failed for ${symbol}, retrying (${attempt}/${maxRetries})`, {
          error: error.message,
          backoffMs,
        })
        await new Promise(resolve => setTimeout(resolve, backoffMs))
        continue
      }
      
      // If not retryable or max retries reached, throw
      throw lastError
    }
  }
  
  // Should never reach here, but TypeScript needs it
  throw lastError || new Error(`Yahoo ${symbol} failed after ${maxRetries} attempts`)
}

export async function POST(request: NextRequest) {
  if (!validateCronToken(request)) {
    return unauthorizedResponse()
  }

  const jobId = 'ingest_assets'
  const startedAt = Date.now()
  const HARD_LIMIT_MS = 240_000 // 4 minutes (leave margin before 300s timeout)

  // Parse batch parameters
  const { searchParams } = new URL(request.url)
  const batchSize = parseInt(searchParams.get('batch') || '2', 10) // Default: 2 (reduced from 5 to avoid timeout)
  const cursorParam = searchParams.get('cursor')
  const resetParam = searchParams.get('reset') === 'true'

  try {
    // Get or reset job state
    let cursor: string | null = null
    if (resetParam) {
      await saveJobState(jobId, null, 'success')
      logger.info('Job state reset requested', { job: jobId })
    } else {
      const state = cursorParam ? null : await getJobState(jobId)
      cursor = cursorParam || state?.cursor || null
    }

    logger.info('Starting asset prices ingestion', {
      job: jobId,
      batchSize,
      cursor,
      reset: resetParam,
    })

    const config = loadAssetsConfig()
    let ingested = 0
    let errors = 0
    const ingestErrors: Array<{ symbol?: string; error: string }> = []
    const failedSymbols: string[] = [] // Track symbols that failed after retries

    // Collect all assets to process (DXY is always first, then forex, indices, metals, crypto)
    const allAssets: Array<{ symbol: string; category: 'dxy' | 'forex' | 'index' | 'metal' | 'crypto'; config?: any }> = []
    
    // DXY is always first
    allAssets.push({ symbol: 'DXY', category: 'dxy' })
    
    // Add forex
    for (const asset of config.forex || []) {
      allAssets.push({ symbol: asset.symbol, category: 'forex', config: asset })
    }
    
    // Add indices
    for (const asset of config.indices || []) {
      allAssets.push({ symbol: asset.symbol, category: 'index', config: asset })
    }
    
    // Add metals
    for (const asset of config.metals || []) {
      allAssets.push({ symbol: asset.symbol, category: 'metal', config: asset })
    }
    
    // Add crypto (will be processed separately, but add placeholder)
    if (config.crypto && config.crypto.length > 0) {
      for (const asset of config.crypto) {
        allAssets.push({ symbol: asset.symbol, category: 'crypto', config: asset })
      }
    }

    // Find starting index from cursor
    let startIndex = 0
    if (cursor) {
      const cursorIndex = allAssets.findIndex(a => a.symbol === cursor)
      if (cursorIndex >= 0) {
        startIndex = cursorIndex
      }
    }

    const assetsToProcess = allAssets.slice(startIndex, startIndex + batchSize)
    logger.info(`Processing batch: ${assetsToProcess.length} assets starting from index ${startIndex}`, {
      job: jobId,
      totalAssets: allAssets.length,
      startIndex,
      batchSize,
      symbols: assetsToProcess.map(a => a.symbol),
    })

    let nextCursor: string | null = null
    let processedCount = 0

    // Process assets in batch
    for (const assetItem of assetsToProcess) {
      // Check hard limit before processing each asset
      const elapsed = Date.now() - startedAt
      if (elapsed > HARD_LIMIT_MS) {
        logger.warn(`Hard limit reached, stopping batch processing`, {
          job: jobId,
          elapsedMs: elapsed,
          processedCount,
          nextAsset: assetItem.symbol,
        })
        nextCursor = assetItem.symbol
        break
      }

      processedCount++

      // PRIORITY: Ingest DXY first (needed for correlations)
      if (assetItem.category === 'dxy') {
        try {
          logger.info('Ingesting DXY from FRED', { job: jobId })
          const dxyPrices = await fetchDXYDaily()
          
          if (dxyPrices.length > 0) {
            // Upsert DXY metadata
            await upsertAssetMetadata({
              symbol: 'DXY',
              name: 'US Dollar Index (DXY)',
              category: 'index',
              source: 'FRED',
            })

            // Upsert DXY prices (batch insert for performance)
            await upsertAssetPricesBatch(
              'DXY',
              dxyPrices.map(p => ({
                date: p.date,
                close: p.value,
                source: 'FRED',
              }))
            )

            ingested++
            logger.info('Ingested DXY', {
              job: jobId,
              symbol: 'DXY',
              points: dxyPrices.length,
            })
          } else {
            logger.warn('No DXY data fetched from FRED', { job: jobId })
            errors++
          }
        } catch (error) {
          errors++
          const errorMsg = error instanceof Error ? error.message : String(error)
          ingestErrors.push({ symbol: 'DXY', error: errorMsg })
          logger.error('Failed to ingest DXY', {
            job: jobId,
            symbol: 'DXY',
            error: errorMsg,
          })
        }
        nextCursor = assetItem.symbol
        continue
      }

      // Process forex pairs
      if (assetItem.category === 'forex' && assetItem.config) {
        const asset = assetItem.config
        try {
          const yahooSymbol = asset.yahoo_symbol || `${asset.symbol}=X`
        // Obtener 5 años de datos históricos para poder calcular correlaciones con más precisión
        const prices = await fetchYahooOHLCV(yahooSymbol, '5y')
        
          if (prices.length === 0) {
            logger.warn(`No prices for ${asset.symbol}`, { job: jobId })
            errors++
            nextCursor = assetItem.symbol
            continue
          }

          // Upsert metadata
          await upsertAssetMetadata({
            symbol: asset.symbol,
            name: asset.name,
            category: 'forex',
            source: 'YAHOO',
            yahoo_symbol: yahooSymbol,
          })

          // Check deadline before batch upsert
          const elapsedBeforeUpsert = Date.now() - startedAt
          if (elapsedBeforeUpsert > HARD_LIMIT_MS) {
            logger.warn(`Hard limit reached before upsert for ${asset.symbol}`, {
              job: jobId,
              elapsedMs: elapsedBeforeUpsert,
            })
            nextCursor = assetItem.symbol
            break
          }

          // Upsert prices (batch insert for performance)
          await upsertAssetPricesBatch(
            asset.symbol,
            prices.map(p => ({
              date: p.date,
              open: p.open,
              high: p.high,
              low: p.low,
              close: p.close,
              volume: p.volume,
              source: 'YAHOO',
            }))
          )

          ingested++
          logger.info(`Ingested ${asset.symbol}`, {
            job: jobId,
            symbol: asset.symbol,
            points: prices.length,
          })
        } catch (error) {
          errors++
          const errorMsg = error instanceof Error ? error.message : String(error)
          failedSymbols.push(asset.symbol)
          ingestErrors.push({ symbol: asset.symbol, error: errorMsg })
          logger.error(`Failed to ingest ${asset.symbol} after retries`, {
            job: jobId,
            symbol: asset.symbol,
            error: errorMsg,
            failedSymbols: failedSymbols.length,
          })
          // NO throw - continue to next symbol
        }
        // Cursor MUST advance even if symbol failed
        nextCursor = assetItem.symbol
        continue
      }

      // Process indices (including NASDAQ)
      if (assetItem.category === 'index' && assetItem.config) {
        const asset = assetItem.config
        try {
          const yahooSymbol = asset.yahoo_symbol || `^${asset.symbol}`
        // Obtener 5 años de datos históricos para poder calcular correlaciones con más precisión
        const prices = await fetchYahooOHLCV(yahooSymbol, '5y')
        
          if (prices.length === 0) {
            logger.warn(`No prices for ${asset.symbol}`, { job: jobId })
            errors++
            nextCursor = assetItem.symbol
            continue
          }

          // Upsert metadata
          await upsertAssetMetadata({
            symbol: asset.symbol,
            name: asset.name,
            category: 'index',
            source: 'YAHOO',
            yahoo_symbol: yahooSymbol,
          })

          // Check deadline before batch upsert
          const elapsedBeforeUpsert = Date.now() - startedAt
          if (elapsedBeforeUpsert > HARD_LIMIT_MS) {
            logger.warn(`Hard limit reached before upsert for ${asset.symbol}`, {
              job: jobId,
              elapsedMs: elapsedBeforeUpsert,
            })
            nextCursor = assetItem.symbol
            break
          }

          // Upsert prices (batch insert for performance)
          await upsertAssetPricesBatch(
            asset.symbol,
            prices.map(p => ({
              date: p.date,
              open: p.open,
              high: p.high,
              low: p.low,
              close: p.close,
              volume: p.volume,
              source: 'YAHOO',
            }))
          )

          ingested++
          logger.info(`Ingested ${asset.symbol}`, {
            job: jobId,
            symbol: asset.symbol,
            points: prices.length,
          })
        } catch (error) {
          errors++
          const errorMsg = error instanceof Error ? error.message : String(error)
          failedSymbols.push(asset.symbol)
          ingestErrors.push({ symbol: asset.symbol, error: errorMsg })
          logger.error(`Failed to ingest ${asset.symbol} after retries`, {
            job: jobId,
            symbol: asset.symbol,
            error: errorMsg,
            failedSymbols: failedSymbols.length,
          })
          // NO throw - continue to next symbol
        }
        // Cursor MUST advance even if symbol failed
        nextCursor = assetItem.symbol
        continue
      }

      // Process metals
      if (assetItem.category === 'metal' && assetItem.config) {
        const asset = assetItem.config
        try {
          const yahooSymbol = asset.yahoo_symbol
          if (!yahooSymbol) {
            logger.warn(`No Yahoo symbol for ${asset.symbol}`, { job: jobId })
            errors++
            nextCursor = assetItem.symbol
            continue
          }

          // Obtener 5 años de datos históricos para poder calcular correlaciones con más precisión
          const prices = await fetchYahooOHLCV(yahooSymbol, '5y')
          
          if (prices.length === 0) {
            logger.warn(`No prices for ${asset.symbol}`, { job: jobId })
            errors++
            nextCursor = assetItem.symbol
            continue
          }

          // Upsert metadata
          await upsertAssetMetadata({
            symbol: asset.symbol,
            name: asset.name,
            category: 'metal',
            source: 'YAHOO',
            yahoo_symbol: yahooSymbol,
          })

          // Check deadline before batch upsert
          const elapsedBeforeUpsert = Date.now() - startedAt
          if (elapsedBeforeUpsert > HARD_LIMIT_MS) {
            logger.warn(`Hard limit reached before upsert for ${asset.symbol}`, {
              job: jobId,
              elapsedMs: elapsedBeforeUpsert,
            })
            nextCursor = assetItem.symbol
            break
          }

          // Upsert prices (batch insert for performance)
          await upsertAssetPricesBatch(
            asset.symbol,
            prices.map(p => ({
              date: p.date,
              open: p.open,
              high: p.high,
              low: p.low,
              close: p.close,
              volume: p.volume,
              source: 'YAHOO',
            }))
          )

          ingested++
          logger.info(`Ingested ${asset.symbol}`, {
            job: jobId,
            symbol: asset.symbol,
            points: prices.length,
          })
        } catch (error) {
          errors++
          const errorMsg = error instanceof Error ? error.message : String(error)
          failedSymbols.push(asset.symbol)
          ingestErrors.push({ symbol: asset.symbol, error: errorMsg })
          logger.error(`Failed to ingest ${asset.symbol} after retries`, {
            job: jobId,
            symbol: asset.symbol,
            error: errorMsg,
            failedSymbols: failedSymbols.length,
          })
          // NO throw - continue to next symbol
        }
        // Cursor MUST advance even if symbol failed
        nextCursor = assetItem.symbol
        continue
      }

      // Process cryptocurrencies (only if we have time and this is in the batch)
      if (assetItem.category === 'crypto' && assetItem.config) {
        const asset = assetItem.config
        try {
          // Simplified: always use Yahoo Finance for crypto (CoinMarketCap processing is complex and can timeout)
          const yahooSymbol = `${asset.symbol.replace('USDT', '').replace('USD', '')}-USD`
          const prices = await fetchYahooOHLCV(yahooSymbol, '5y')
          
          if (prices.length === 0) {
            logger.warn(`No prices for ${asset.symbol}`, { job: jobId })
            errors++
          } else {
            // Upsert metadata
            await upsertAssetMetadata({
              symbol: asset.symbol,
              name: asset.name,
              category: 'crypto',
              source: 'YAHOO',
              yahoo_symbol: yahooSymbol,
            })

            // Check deadline before batch upsert
            const elapsedBeforeUpsert = Date.now() - startedAt
            if (elapsedBeforeUpsert > HARD_LIMIT_MS) {
              logger.warn(`Hard limit reached before upsert for ${asset.symbol}`, {
                job: jobId,
                elapsedMs: elapsedBeforeUpsert,
              })
              nextCursor = assetItem.symbol
              break
            }

            // Upsert prices (batch insert for performance)
            await upsertAssetPricesBatch(
              asset.symbol,
              prices.map(p => ({
                date: p.date,
                open: p.open,
                high: p.high,
                low: p.low,
                close: p.close,
                volume: p.volume,
                source: 'YAHOO',
              }))
            )

            ingested++
            logger.info(`Ingested ${asset.symbol}`, {
              job: jobId,
              symbol: asset.symbol,
              points: prices.length,
            })
          }
        } catch (error) {
          errors++
          const errorMsg = error instanceof Error ? error.message : String(error)
          failedSymbols.push(asset.symbol)
          ingestErrors.push({ symbol: asset.symbol, error: errorMsg })
          logger.error(`Failed to ingest ${asset.symbol} after retries`, {
            job: jobId,
            symbol: asset.symbol,
            error: errorMsg,
            failedSymbols: failedSymbols.length,
          })
          // NO throw - continue to next symbol
        }
        // Cursor MUST advance even if symbol failed
        nextCursor = assetItem.symbol
        continue
      }
    } // End of for loop

    // Check if we've processed all assets
    const isComplete = startIndex + processedCount >= allAssets.length
    const done = isComplete && nextCursor === null

    // Save job state
    const totalDurationMs = Date.now() - startedAt
    await saveJobState(
      jobId,
      done ? null : nextCursor,
      done ? 'success' : 'partial',
      totalDurationMs
    )

    const finishedAt = new Date().toISOString()

    logger.info('Asset prices ingestion batch completed', {
      job: jobId,
      ingested,
      errors,
      durationMs: totalDurationMs,
      done,
      nextCursor,
      processedCount,
      totalAssets: allAssets.length,
      failedSymbols: failedSymbols.length,
    })

    return NextResponse.json({
      success: true,
      job: jobId,
      ingested,
      errors,
      processed: processedCount,
      nextCursor,
      done,
      durationMs: totalDurationMs,
      finishedAt,
      failedSymbols: failedSymbols.slice(0, 20), // Include failed symbols in response
      ingestErrors: ingestErrors.slice(0, 10), // Limit to first 10 errors
    })
  } catch (error) {
    const finishedAt = new Date().toISOString()
    const errorMessage = error instanceof Error ? error.message : String(error)

    logger.error('Asset prices ingestion failed', {
      job: jobId,
      error: errorMessage,
    })

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    )
  }
}

// Permitir GET además de POST para compatibilidad con cron jobs de Vercel
export async function GET(request: NextRequest) {
  return POST(request)
}
