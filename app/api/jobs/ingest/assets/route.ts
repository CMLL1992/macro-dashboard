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
import { fetchAssetDaily, fetchDXYDaily } from '@/lib/correlations/fetch'
import { fetchTopCryptocurrencies, fetchCoinMarketCapLatest } from '@/lib/datasources/coinmarketcap'
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
 * Fetch Yahoo Finance daily OHLCV data
 */
async function fetchYahooOHLCV(symbol: string, period: string = '1mo'): Promise<Array<{
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}>> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=${encodeURIComponent(period)}&includePrePost=false`
  
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
      cache: 'no-store',
    })
    
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
  } catch (error) {
    logger.error(`Error fetching Yahoo OHLCV for ${symbol}`, { error })
    return []
  }
}

export async function POST(request: NextRequest) {
  if (!validateCronToken(request)) {
    return unauthorizedResponse()
  }

  const jobId = 'ingest_assets'
  const startedAt = new Date().toISOString()

  try {
    logger.info('Starting asset prices ingestion', { job: jobId })

    const config = loadAssetsConfig()
    let ingested = 0
    let errors = 0
    const ingestErrors: Array<{ symbol?: string; error: string }> = []

    // PRIORITY: Ingest DXY first (needed for correlations)
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

        // Upsert DXY prices
        for (const price of dxyPrices) {
          await upsertAssetPrice({
            symbol: 'DXY',
            date: price.date,
            close: price.value,
            source: 'FRED',
          })
        }

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

    // Process forex pairs
    for (const asset of config.forex || []) {
      try {
        const yahooSymbol = asset.yahoo_symbol || `${asset.symbol}=X`
        // Obtener 5 años de datos históricos para poder calcular correlaciones con más precisión
        const prices = await fetchYahooOHLCV(yahooSymbol, '5y')
        
        if (prices.length === 0) {
          logger.warn(`No prices for ${asset.symbol}`, { job: jobId })
          errors++
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

        // Upsert prices
        for (const price of prices) {
          await upsertAssetPrice({
            symbol: asset.symbol,
            date: price.date,
            open: price.open,
            high: price.high,
            low: price.low,
            close: price.close,
            volume: price.volume,
            source: 'YAHOO',
          })
        }

        ingested++
        logger.info(`Ingested ${asset.symbol}`, {
          job: jobId,
          symbol: asset.symbol,
          points: prices.length,
        })
      } catch (error) {
        errors++
        const errorMsg = error instanceof Error ? error.message : String(error)
        ingestErrors.push({ symbol: asset.symbol, error: errorMsg })
        logger.error(`Failed to ingest ${asset.symbol}`, {
          job: jobId,
          symbol: asset.symbol,
          error: errorMsg,
        })
      }
    }

    // Process indices (including NASDAQ)
    for (const asset of config.indices || []) {
      try {
        const yahooSymbol = asset.yahoo_symbol || `^${asset.symbol}`
        // Obtener 5 años de datos históricos para poder calcular correlaciones con más precisión
        const prices = await fetchYahooOHLCV(yahooSymbol, '5y')
        
        if (prices.length === 0) {
          logger.warn(`No prices for ${asset.symbol}`, { job: jobId })
          errors++
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

        // Upsert prices
        for (const price of prices) {
          await upsertAssetPrice({
            symbol: asset.symbol,
            date: price.date,
            open: price.open,
            high: price.high,
            low: price.low,
            close: price.close,
            volume: price.volume,
            source: 'YAHOO',
          })
        }

        ingested++
        logger.info(`Ingested ${asset.symbol}`, {
          job: jobId,
          symbol: asset.symbol,
          points: prices.length,
        })
      } catch (error) {
        errors++
        const errorMsg = error instanceof Error ? error.message : String(error)
        ingestErrors.push({ symbol: asset.symbol, error: errorMsg })
        logger.error(`Failed to ingest ${asset.symbol}`, {
          job: jobId,
          symbol: asset.symbol,
          error: errorMsg,
        })
      }
    }

    // Process metals
    for (const asset of config.metals || []) {
      try {
        const yahooSymbol = asset.yahoo_symbol
        if (!yahooSymbol) {
          logger.warn(`No Yahoo symbol for ${asset.symbol}`, { job: jobId })
          errors++
          continue
        }

        // Obtener 5 años de datos históricos para poder calcular correlaciones con más precisión
        const prices = await fetchYahooOHLCV(yahooSymbol, '5y')
        
        if (prices.length === 0) {
          logger.warn(`No prices for ${asset.symbol}`, { job: jobId })
          errors++
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

        // Upsert prices
        for (const price of prices) {
          await upsertAssetPrice({
            symbol: asset.symbol,
            date: price.date,
            open: price.open,
            high: price.high,
            low: price.low,
            close: price.close,
            volume: price.volume,
            source: 'YAHOO',
          })
        }

        ingested++
        logger.info(`Ingested ${asset.symbol}`, {
          job: jobId,
          symbol: asset.symbol,
          points: prices.length,
        })
      } catch (error) {
        errors++
        const errorMsg = error instanceof Error ? error.message : String(error)
        ingestErrors.push({ symbol: asset.symbol, error: errorMsg })
        logger.error(`Failed to ingest ${asset.symbol}`, {
          job: jobId,
          symbol: asset.symbol,
          error: errorMsg,
        })
      }
    }

    // Process cryptocurrencies
    const cmcApiKey = process.env.COINMARKETCAP_API_KEY
    if (cmcApiKey) {
      try {
        // Get top 25 cryptocurrencies from CoinMarketCap
        const topCrypto = await fetchTopCryptocurrencies(25, cmcApiKey)
        
        // Map to our config symbols
        const cryptoMap = new Map(
          (config.crypto || []).map((c: any) => [c.coinmarketcap_id, c])
        )

        for (const crypto of topCrypto) {
          try {
            const configCrypto = cryptoMap.get(crypto.id) as { symbol?: string } | undefined
            const symbol = configCrypto?.symbol || `${crypto.symbol}USDT`
            
            // Try to get latest price from CoinMarketCap
            const latest = await fetchCoinMarketCapLatest(crypto.id, cmcApiKey)
            
            // Fallback to Yahoo Finance for historical data
            const yahooSymbol = `${crypto.symbol}-USD`
            // Obtener 5 años de datos históricos para poder calcular correlaciones con más precisión
        const prices = await fetchYahooOHLCV(yahooSymbol, '5y')
            
            if (latest) {
              // Add latest price if not in historical data
              const today = new Date().toISOString().slice(0, 10)
              const hasToday = prices.some(p => p.date === today)
              
              if (!hasToday) {
                prices.push({
                  date: today,
                  open: latest.price,
                  high: latest.price,
                  low: latest.price,
                  close: latest.price,
                  volume: latest.volume24h,
                })
              }
            }

            if (prices.length === 0) {
              logger.warn(`No prices for ${symbol}`, { job: jobId })
              errors++
              continue
            }

            // Upsert metadata
            await upsertAssetMetadata({
              symbol,
              name: crypto.name,
              category: 'crypto',
              source: 'COINMARKETCAP',
              yahoo_symbol: yahooSymbol,
            })

            // Upsert prices
            for (const price of prices) {
              await upsertAssetPrice({
                symbol,
                date: price.date,
                open: price.open,
                high: price.high,
                low: price.low,
                close: price.close,
                volume: price.volume,
                source: latest ? 'COINMARKETCAP' : 'YAHOO',
              })
            }

            ingested++
            logger.info(`Ingested ${symbol}`, {
              job: jobId,
              symbol,
              points: prices.length,
            })
          } catch (error) {
            errors++
            const errorMsg = error instanceof Error ? error.message : String(error)
            ingestErrors.push({ symbol: crypto.symbol, error: errorMsg })
            logger.error(`Failed to ingest ${crypto.symbol}`, {
              job: jobId,
              symbol: crypto.symbol,
              error: errorMsg,
            })
          }
        }
      } catch (error) {
        logger.error('Failed to fetch top cryptocurrencies', {
          job: jobId,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    } else {
      // Fallback: use config crypto list with Yahoo Finance
      for (const asset of config.crypto || []) {
        try {
          const yahooSymbol = `${asset.symbol.replace('USDT', '')}-USD`
          // Obtener 5 años de datos históricos para poder calcular correlaciones con más precisión
        const prices = await fetchYahooOHLCV(yahooSymbol, '5y')
          
          if (prices.length === 0) {
            logger.warn(`No prices for ${asset.symbol}`, { job: jobId })
            errors++
            continue
          }

          // Upsert metadata
          await upsertAssetMetadata({
            symbol: asset.symbol,
            name: asset.name,
            category: 'crypto',
            source: 'YAHOO',
            yahoo_symbol: yahooSymbol,
          })

          // Upsert prices
          for (const price of prices) {
            await upsertAssetPrice({
              symbol: asset.symbol,
              date: price.date,
              open: price.open,
              high: price.high,
              low: price.low,
              close: price.close,
              volume: price.volume,
              source: 'YAHOO',
            })
          }

          ingested++
          logger.info(`Ingested ${asset.symbol}`, {
            job: jobId,
            symbol: asset.symbol,
            points: prices.length,
          })
        } catch (error) {
          errors++
          const errorMsg = error instanceof Error ? error.message : String(error)
          ingestErrors.push({ symbol: asset.symbol, error: errorMsg })
          logger.error(`Failed to ingest ${asset.symbol}`, {
            job: jobId,
            symbol: asset.symbol,
            error: errorMsg,
          })
        }
      }
    }

    const finishedAt = new Date().toISOString()
    const durationMs = new Date(finishedAt).getTime() - new Date(startedAt).getTime()

    logger.info('Asset prices ingestion completed', {
      job: jobId,
      ingested,
      errors,
      durationMs,
    })

    return NextResponse.json({
      success: true,
      ingested,
      errors,
      duration_ms: durationMs,
      finishedAt,
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
