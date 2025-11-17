export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { getMacroDiagnosis } from '@/domain/diagnostic'
import { usdBias, macroQuadrant, getBiasTable } from '@/domain/bias'
import { checkMacroDataHealth, getLatestObservationDate } from '@/lib/db/read-macro'
import { getDB } from '@/lib/db/schema'
import { getCorrelationsForSymbol } from '@/lib/db/read'
import { setDbReady, acquireBootstrapLock, releaseBootstrapLock, getBootstrapStartedAt, incrementFallbackCount, getFallbackCount, getLastBiasUpdateTimestamp, setLastBiasUpdateTimestamp } from '@/lib/runtime/state'

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
  const db = getDB()
  
  // Health check and logging
  let health = checkMacroDataHealth()
  const rowsBias = db.prepare('SELECT COUNT(1) as c FROM macro_bias').get() as { c: number }
  const rowsCorr = db.prepare('SELECT COUNT(1) as c FROM correlations WHERE value IS NOT NULL').get() as { c: number }
  const rowsObs = db.prepare('SELECT COUNT(1) as c FROM macro_observations').get() as { c: number }
  
  const mustBootstrap = !(health.hasObservations && health.hasBias) || rowsCorr.c === 0
  let bootstrapResult = null
  if (mustBootstrap) {
    bootstrapResult = await runBootstrap()
    health = checkMacroDataHealth()
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
  const rows = getBiasTable(regime, usd, quad)
  
  // Enrich with correlations from DB
  const enrichedRows = rows.map(row => {
    const symbol = row.par.replace('/', '').toUpperCase()
    const corr = getCorrelationsForSymbol(symbol, 'DXY')
    return {
      ...row,
      corr12m: corr.corr12m,
      corr3m: corr.corr3m,
      n_obs12m: corr.n_obs12m,
      n_obs3m: corr.n_obs3m,
    }
  })
  
  // Enhanced logging for observability
  const bootstrapStartedAt = getBootstrapStartedAt()
  const fallbackCount = getFallbackCount()
  let lastBiasUpdate = getLastBiasUpdateTimestamp()
  // Fallback: si no hay timestamp en memoria, usar el máximo computed_at de macro_bias
  if (!lastBiasUpdate) {
    try {
      const row = db.prepare('SELECT MAX(computed_at) as ts FROM macro_bias').get() as { ts: string | null }
      if (row?.ts) {
        lastBiasUpdate = new Date(row.ts).toISOString()
        setLastBiasUpdateTimestamp(lastBiasUpdate)
      }
    } catch (e) {
      console.warn('[api/bias] fallback lastBiasUpdate failed:', e)
    }
  }
  const latestDataDate = getLatestObservationDate()
  
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


