export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { getMacroDiagnosis } from '@/domain/diagnostic'
import { usdBias, macroQuadrant, getBiasTableFromUniverse } from '@/domain/bias'
import { checkMacroDataHealth, getLatestObservationDate } from '@/lib/db/read-macro'
import { getDB } from '@/lib/db/schema'
import { getUnifiedDB, isUsingTurso } from '@/lib/db/unified-db'
import { getCorrelationsForSymbol } from '@/lib/db/read'
import { setDbReady, acquireBootstrapLock, releaseBootstrapLock, getBootstrapStartedAt, incrementFallbackCount, getFallbackCount, getLastBiasUpdateTimestamp, setLastBiasUpdateTimestamp } from '@/lib/runtime/state'
import { getRecentEventsWithImpact, getLastRelevantEventForCurrency } from '@/lib/db/recent-events'
import getBiasState from '@/domain/macro-engine/bias'
import { splitSymbol } from '@/domain/diagnostic'

async function runBootstrap(): Promise<{ success: boolean; duration_ms: number }> {
  const startedAt = new Date()
  
  if (!acquireBootstrapLock()) {
    return { success: false, duration_ms: 0 } // Already running
  }
  
  try {
    const token = process.env.CRON_TOKEN || ''
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined as any
    const base = process.env.APP_URL || 'http://localhost:3000'
    
    try { 
      await fetch(`${base}/api/jobs/ingest/fred`, { method: 'POST', headers, cache: 'no-store' }) 
    } catch (e) {
      console.warn('[bootstrap] ingest:fred failed:', e)
    }
    
    try { 
      await fetch(`${base}/api/jobs/correlations`, { method: 'POST', headers, cache: 'no-store' }) 
    } catch (e) {
      console.warn('[bootstrap] correlations failed:', e)
    }
    
    try { 
      await fetch(`${base}/api/jobs/compute/bias`, { method: 'POST', headers, cache: 'no-store' }) 
    } catch (e) {
      console.warn('[bootstrap] bias failed:', e)
    }
    
    const durationMs = new Date().getTime() - startedAt.getTime()
    // Update timestamp after bootstrap completes
    setLastBiasUpdateTimestamp(new Date().toISOString())
    return { success: true, duration_ms: durationMs }
  } finally {
    releaseBootstrapLock()
  }
}

export async function GET() {
  // Health check and logging
  let health = await checkMacroDataHealth()
  
  // Get counts - always use async for Turso compatibility
  let rowsBias: { c: number }, rowsCorr: { c: number }, rowsObs: { c: number }
  if (isUsingTurso()) {
    const db = getUnifiedDB()
    rowsBias = await db.prepare('SELECT COUNT(1) as c FROM macro_bias').get() as { c: number }
    rowsCorr = await db.prepare('SELECT COUNT(1) as c FROM correlations WHERE value IS NOT NULL').get() as { c: number }
    rowsObs = await db.prepare('SELECT COUNT(1) as c FROM macro_observations').get() as { c: number }
  } else {
    const db = getDB()
    rowsBias = db.prepare('SELECT COUNT(1) as c FROM macro_bias').get() as { c: number }
    rowsCorr = db.prepare('SELECT COUNT(1) as c FROM correlations WHERE value IS NOT NULL').get() as { c: number }
    rowsObs = db.prepare('SELECT COUNT(1) as c FROM macro_observations').get() as { c: number }
  }
  
  const mustBootstrap = !(health.hasObservations && health.hasBias) || rowsCorr.c === 0
  let bootstrapResult = null
  if (mustBootstrap) {
    bootstrapResult = await runBootstrap()
    health = await checkMacroDataHealth()
  }

  // Marcar DB_READY cuando pase el health mínimo
  if (health.hasObservations && health.hasBias) setDbReady(true)
  
  // Check if fallback to FRED was used
  const useFallback = process.env.USE_LIVE_SOURCES === 'true'
  if (useFallback) {
    incrementFallbackCount()
  }

  // Get macro diagnosis (reads from SQLite, no FRED unless USE_LIVE_SOURCES=true)
  let items: any[] = []
  let regime = 'Neutral'
  let score = 0
  
  try {
    const diagnosis = await getMacroDiagnosis()
    items = diagnosis.items
    regime = diagnosis.regime
    score = diagnosis.score
  } catch (error) {
    console.error('[api/bias] Error in getMacroDiagnosis:', error)
  }
  
  const usd = usdBias(items)
  const quad = macroQuadrant(items)
  const rows = await getBiasTableFromUniverse(regime, usd, quad)
  
  // Get bias state for currency scores and regimes
  let biasState: Awaited<ReturnType<typeof getBiasState>> | null = null
  try {
    biasState = await getBiasState()
  } catch (error) {
    console.warn('[api/bias] getBiasState failed, continuing without currency info:', error)
  }
  
  // Get recent events with impact
  const recentEvents = await getRecentEventsWithImpact({
    hours: 48,
    currencies: ['USD', 'EUR', 'GBP', 'JPY', 'AUD'],
    min_importance: 'medium',
    min_surprise_score: 0.3,
  })
  
  // Get last event applied timestamp
  const lastEventAppliedAt = recentEvents.length > 0
    ? recentEvents[0].release_time_utc
    : null
  
  // Enrich with correlations from DB and last relevant events
  const enrichedRows = await Promise.all(rows.map(async row => {
    const symbol = row.par.replace('/', '').toUpperCase()
    const corr = await getCorrelationsForSymbol(symbol, 'DXY')
    
    // Get last relevant event for base and quote currencies
    const { base, quote } = splitSymbol(symbol)
    let lastRelevantEvent: {
      currency: string
      name: string
      surprise_direction: string
      surprise_score: number
      release_time_utc: string
    } | null = null
    
    if (base || quote) {
      // Prefer base currency event, fallback to quote
      const baseEvent = base ? await getLastRelevantEventForCurrency(base, 24) : null
      const quoteEvent = quote ? await getLastRelevantEventForCurrency(quote, 24) : null
      
      const event = baseEvent || quoteEvent
      if (event) {
        lastRelevantEvent = {
          currency: event.currency,
          name: event.name,
          surprise_direction: event.surprise_direction || 'neutral',
          surprise_score: event.surprise_score || 0,
          release_time_utc: event.release_time_utc,
        }
      }
    }
    
    // Check if bias was updated after last event
    const updatedAfterLastEvent = lastRelevantEvent && lastBiasUpdate
      ? new Date(lastBiasUpdate) >= new Date(lastRelevantEvent.release_time_utc)
      : false
    
    return {
      ...row,
      corr12m: corr.corr12m,
      corr3m: corr.corr3m,
      n_obs12m: corr.n_obs12m,
      n_obs3m: corr.n_obs3m,
      last_relevant_event: lastRelevantEvent,
      updated_after_last_event: updatedAfterLastEvent,
    }
  }))
  
  // Enhanced logging for observability
  const bootstrapStartedAt = getBootstrapStartedAt()
  const fallbackCount = getFallbackCount()
  let lastBiasUpdate = getLastBiasUpdateTimestamp()
  // Fallback: si no hay timestamp en memoria, usar el máximo computed_at de macro_bias
  if (!lastBiasUpdate) {
    try {
      if (isUsingTurso()) {
        const db = getUnifiedDB()
        const row = await db.prepare('SELECT MAX(computed_at) as ts FROM macro_bias').get() as { ts: string | null }
        if (row?.ts) {
          lastBiasUpdate = new Date(row.ts).toISOString()
          setLastBiasUpdateTimestamp(lastBiasUpdate)
        }
      } else {
        const db = getDB()
        const row = db.prepare('SELECT MAX(computed_at) as ts FROM macro_bias').get() as { ts: string | null }
        if (row?.ts) {
          lastBiasUpdate = new Date(row.ts).toISOString()
          setLastBiasUpdateTimestamp(lastBiasUpdate)
        }
      }
    } catch (e) {
      console.warn('[api/bias] fallback lastBiasUpdate failed:', e)
    }
  }
  const latestDataDate = await getLatestObservationDate()
  
  console.log('[api/bias]', {
    rows_bias: rowsBias.c,
    rows_corr: rowsCorr.c,
    rows_obs: rowsObs.c,
    use_fallback_fred: process.env.USE_LIVE_SOURCES === 'true',
    db_ready: health.hasObservations && health.hasBias,
    bootstrap_started_at: bootstrapStartedAt,
    bootstrap_duration_ms: bootstrapResult?.duration_ms || null,
    fallback_count: fallbackCount,
    items_count: items.length,
    regime,
    score,
    last_bias_update: lastBiasUpdate,
  })
  
  return Response.json({ 
    items, // Include items for dashboard
    regime, 
    usd, 
    quad,
    score,
    rows: enrichedRows,
    recentEvents: recentEvents.map(event => ({
      event_id: event.event_id,
      release_id: event.release_id,
      currency: event.currency,
      name: event.name,
      category: event.category,
      importance: event.importance,
      release_time_utc: event.release_time_utc,
      actual: event.actual,
      consensus: event.consensus,
      previous: event.previous,
      surprise_raw: event.surprise_raw,
      surprise_pct: event.surprise_pct,
      surprise_score: event.surprise_score,
      surprise_direction: event.surprise_direction,
      linked_series_id: event.linked_series_id,
      linked_indicator_key: event.linked_indicator_key,
      currency_score_before: event.currency_score_before,
      currency_score_after: event.currency_score_after,
      regime_before: event.regime_before,
      regime_after: event.regime_after,
    })),
    meta: {
      bias_updated_at: lastBiasUpdate,
      last_event_applied_at: lastEventAppliedAt,
    },
    health: {
      hasData: health.hasObservations && health.hasBias,
      observationCount: health.observationCount,
      biasCount: health.biasCount,
      correlationCount: health.correlationCount,
    },
    updatedAt: lastBiasUpdate, // Timestamp del último cálculo de bias
    latestDataDate: latestDataDate, // Fecha máxima de datos macro (opcional, para chip adicional)
  })
}


