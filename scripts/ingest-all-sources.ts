/**
 * Script maestro para ingerir datos de TODAS las fuentes automáticamente
 * 
 * Ejecuta todos los scripts de ingesta en paralelo o secuencialmente
 * 
 * Uso:
 *   APP_URL=https://tu-app.vercel.app \
 *   INGEST_KEY=tu_key \
 *   FRED_API_KEY=tu_fred_key \
 *   FMP_API_KEY=tu_fmp_key (opcional) \
 *   FINNHUB_API_KEY=tu_finnhub_key (opcional) \
 *   NEWSAPI_KEY=tu_newsapi_key (opcional) \
 *   TRADING_ECONOMICS_API_KEY=tu_te_key (opcional) \
 *   pnpm tsx scripts/ingest-all-sources.ts
 */

const BASE_URL = process.env.APP_URL || 'http://localhost:3000'
const INGEST_KEY = process.env.INGEST_KEY

if (!INGEST_KEY) {
  console.error('[ingest-all-sources] ❌ INGEST_KEY not set, aborting')
  process.exit(1)
}

interface IngestResult {
  source: string
  success: boolean
  calendar?: { inserted: number; skipped: number }
  news?: { inserted: number; skipped: number }
  error?: string
}

async function runIngest(source: string, fn: () => Promise<any>): Promise<IngestResult> {
  try {
    console.log(`\n🔄 [${source}] Starting ingestion...`)
    const result = await fn()
    console.log(`✅ [${source}] Completed successfully`)
    return {
      source,
      success: true,
      ...result,
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error(`❌ [${source}] Failed:`, errorMsg)
    return {
      source,
      success: false,
      error: errorMsg,
    }
  }
}

async function main() {
  console.log('🚀 Starting ingestion from ALL sources...')
  console.log(`📍 BASE_URL: ${BASE_URL}`)
  console.log(`📅 Date: ${new Date().toLocaleDateString('es-ES')}\n`)

  const results: IngestResult[] = []

  // 1. RSS News (Bloomberg, Reuters, Financial Times)
  try {
    const { ingestNewsFromRSS } = await import('./ingest-news-rss.js')
    results.push(await runIngest('RSS News', ingestNewsFromRSS))
  } catch (error) {
    console.warn('⚠️  RSS News ingestion not available:', error)
  }

  // 2. FRED Calendar
  if (process.env.FRED_API_KEY) {
    try {
      const { ingestCalendarFromFRED } = await import('./ingest-calendar-fred.js')
      results.push(await runIngest('FRED Calendar', ingestCalendarFromFRED))
    } catch (error) {
      console.warn('⚠️  FRED Calendar ingestion not available:', error)
    }
  }

  // 3. Forex Factory Calendar
  try {
    const { ingestCalendarFromForexFactory } = await import('./ingest-calendar-forexfactory.js')
    results.push(await runIngest('Forex Factory Calendar', ingestCalendarFromForexFactory))
  } catch (error) {
    console.warn('⚠️  Forex Factory Calendar ingestion not available:', error)
  }

  // 4. Financial Modeling Prep
  if (process.env.FMP_API_KEY) {
    try {
      const { ingestFromFMP } = await import('./ingest-fmp.js')
      results.push(await runIngest('Financial Modeling Prep', ingestFromFMP))
    } catch (error) {
      console.warn('⚠️  FMP ingestion not available:', error)
    }
  }

  // 5. Finnhub
  if (process.env.FINNHUB_API_KEY) {
    try {
      const { ingestFromFinnhub } = await import('./ingest-finnhub.js')
      results.push(await runIngest('Finnhub', ingestFromFinnhub))
    } catch (error) {
      console.warn('⚠️  Finnhub ingestion not available:', error)
    }
  }

  // 6. Trading Economics
  try {
    const { ingestFromTradingEconomics } = await import('./ingest-tradingeconomics.js')
    results.push(await runIngest('Trading Economics', ingestFromTradingEconomics))
  } catch (error) {
    console.warn('⚠️  Trading Economics ingestion not available:', error)
  }

  // 7. NewsAPI
  if (process.env.NEWSAPI_KEY) {
    try {
      const { ingestFromNewsAPI } = await import('./ingest-newsapi.js')
      results.push(await runIngest('NewsAPI', ingestFromNewsAPI))
    } catch (error) {
      console.warn('⚠️  NewsAPI ingestion not available:', error)
    }
  }

  // 8. Auto-ingest PMI from calendar events (after calendar ingestion)
  try {
    console.log('\n🔄 [PMI Auto-Ingest] Attempting automatic PMI ingestion from calendar...')
    const CRON_TOKEN = process.env.CRON_TOKEN || process.env.INGEST_KEY
    if (CRON_TOKEN) {
      const response = await fetch(`${BASE_URL}/api/jobs/ingest/pmi`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CRON_TOKEN}`,
          'Content-Type': 'application/json',
        },
      })
      
      if (response.ok) {
        const data = await response.json()
        console.log(`✅ [PMI Auto-Ingest] Completed: ${data.ingested || 0} ingested, ${data.skipped || 0} skipped`)
        results.push({
          source: 'PMI Auto-Ingest',
          success: true,
          calendar: { inserted: data.ingested || 0, skipped: data.skipped || 0 },
        })
      } else {
        const errorText = await response.text()
        console.warn(`⚠️  [PMI Auto-Ingest] Failed: ${errorText}`)
        results.push({
          source: 'PMI Auto-Ingest',
          success: false,
          error: errorText,
        })
      }
    } else {
      console.warn('⚠️  [PMI Auto-Ingest] CRON_TOKEN not available, skipping')
    }
  } catch (error) {
    console.warn('⚠️  PMI Auto-Ingest not available:', error)
  }

  // Summary
  console.log('\n' + '='.repeat(60))
  console.log('📊 RESUMEN DE INGESTA')
  console.log('='.repeat(60))
  
  let totalCalendarInserted = 0
  let totalCalendarSkipped = 0
  let totalNewsInserted = 0
  let totalNewsSkipped = 0
  let successCount = 0
  let failCount = 0

  for (const result of results) {
    if (result.success) {
      successCount++
      if (result.calendar) {
        totalCalendarInserted += result.calendar.inserted
        totalCalendarSkipped += result.calendar.skipped
        console.log(`✅ ${result.source}:`)
        console.log(`   📅 Calendar: ${result.calendar.inserted} inserted, ${result.calendar.skipped} skipped`)
      }
      if (result.news) {
        totalNewsInserted += result.news.inserted
        totalNewsSkipped += result.news.skipped
        console.log(`   📰 News: ${result.news.inserted} inserted, ${result.news.skipped} skipped`)
      }
    } else {
      failCount++
      console.log(`❌ ${result.source}: ${result.error || 'Unknown error'}`)
    }
  }

  console.log('='.repeat(60))
  console.log(`✅ Exitosos: ${successCount}`)
  console.log(`❌ Fallidos: ${failCount}`)
  console.log(`📅 Total Calendar: ${totalCalendarInserted} inserted, ${totalCalendarSkipped} skipped`)
  console.log(`📰 Total News: ${totalNewsInserted} inserted, ${totalNewsSkipped} skipped`)
  console.log('='.repeat(60))
  console.log('\n✅ Ingesta completada!')
}

main().catch(error => {
  console.error('\n❌ Error fatal:', error)
  process.exit(1)
})




export {}
