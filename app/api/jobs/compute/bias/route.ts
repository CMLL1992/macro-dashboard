/**
 * Job: Compute macro bias for all assets
 * POST /api/jobs/compute/bias
 * Protected by CRON_TOKEN
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateCronToken, unauthorizedResponse } from '@/lib/security/token'
import { upsertMacroBias } from '@/lib/db/upsert'
import { logger } from '@/lib/obs/logger'
import { computeMacroBias } from '@/lib/bias/score'
import { buildBiasNarrative } from '@/lib/bias/explain'
import type { AssetMeta } from '@/lib/bias/types'
import fs from 'node:fs/promises'
import path from 'node:path'
import { revalidatePath } from 'next/cache'
import { setLastBiasUpdateTimestamp } from '@/lib/runtime/state'
import { getMacroDiagnosis } from '@/domain/diagnostic'
import { usdBias } from '@/domain/bias'
import { getLatestObservationDate } from '@/lib/db/read-macro'
import { checkUSDChange } from '@/lib/alerts/triggers'
import { CATEGORY_ORDER } from '@/domain/categories'
import { getBiasState } from '@/domain/macro-engine/bias'
import { getUnifiedDB, isUsingTurso } from '@/lib/db/unified-db'
import { detectConfidenceChanges, notifyConfidenceChanges } from '@/lib/notifications/confidence'
import { detectScenarioChanges, notifyScenarioChanges } from '@/lib/notifications/scenarios'
import { getInstitutionalScenarios } from '@/domain/scenarios'
import getCorrelationState from '@/domain/macro-engine/correlations'
import { recordJobSuccess } from '@/lib/db/job-status'
import { isAllowedPair } from '@/config/tactical-pairs'
import { getJobState, saveJobState } from '@/lib/db/job-state'

export async function POST(request: NextRequest) {
  // In development on localhost, allow without token if CRON_TOKEN is not set
  const host = request.headers.get('host') || ''
  const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1') || host.includes('3000')
  const hasCronToken = process.env.CRON_TOKEN && process.env.CRON_TOKEN.length > 0
  const isVercel = !!process.env.VERCEL
  
  if (isLocalhost && (!hasCronToken || !isVercel)) {
    console.log('[bias/route] Allowing request from localhost without token')
  } else {
    if (!validateCronToken(request)) {
      return unauthorizedResponse()
    }
  }

  const jobId = 'compute_bias'
  const startedAt = Date.now()
  const HARD_LIMIT_MS = 240_000 // 4 minutes (leave margin before 300s timeout)

  // Parse batch parameters
  const { searchParams } = new URL(request.url)
  const batchSize = parseInt(searchParams.get('batch') || '5', 10)
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

    logger.info('Starting bias computation', {
      job: jobId,
      batchSize,
      cursor,
      reset: resetParam,
    })

    // Load tactical pairs (reduced list) - Priority 1
    let assets: AssetMeta[] = []
    try {
      const tacticalPath = path.join(process.cwd(), 'config', 'tactical-pairs.json')
      const tacticalRaw = await fs.readFile(tacticalPath, 'utf8')
      const tacticalPairs = JSON.parse(tacticalRaw) as Array<{ symbol: string; type?: string }>
      
      // Convert tactical-pairs to AssetMeta format
      assets = tacticalPairs.map(pair => ({
        symbol: pair.symbol.toUpperCase(),
        class: pair.type === 'crypto' ? 'crypto' : 
               pair.type === 'index' ? 'index' : 
               pair.type === 'commodity' ? (pair.symbol.startsWith('XAU') || pair.symbol.startsWith('XAG') ? 'metal' : 'commodity') :
               'fx',
        base: pair.symbol.includes('/') ? pair.symbol.split('/')[0] : 
              pair.symbol.length === 6 && pair.type === 'fx' ? pair.symbol.substring(0, 3) :
              pair.symbol.endsWith('USDT') || pair.symbol.endsWith('USD') ? pair.symbol.replace(/USDT?$/, '') : null,
        quote: pair.symbol.includes('/') ? pair.symbol.split('/')[1] :
               pair.symbol.length === 6 && pair.type === 'fx' ? pair.symbol.substring(3, 6) :
               pair.symbol.endsWith('USDT') || pair.symbol.endsWith('USD') ? 'USD' : null,
        risk_sensitivity: pair.type === 'crypto' ? 'risk_on' : undefined,
      })) as AssetMeta[]
      
      logger.info('Loaded tactical pairs for bias computation', { job: jobId, count: assets.length })
    } catch (error) {
      logger.warn('Failed to load tactical-pairs.json, falling back to universe.assets.json', { 
        job: jobId, 
        error: error instanceof Error ? error.message : String(error) 
      })
      
      // Fallback to universe.assets.json
      try {
        const universeAssets = await import('@/config/universe.assets.json')
        assets = universeAssets.default as AssetMeta[]
      } catch (fallbackError) {
        logger.error('Failed to load universe.assets.json, using empty list', {
          job: jobId,
          error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
        })
        assets = []
      }
    }

    let computed = 0
    let errors = 0

    // FILTER: Only process assets that are in tactical-pairs.json
    const filteredAssets = assets.filter(asset => isAllowedPair(asset.symbol))
    
    const uniquePairsToProcess = Array.from(new Set(filteredAssets.map(a => a.symbol))).sort()
    
    // Find starting index from cursor
    // IMPORTANT: If cursor exists, start AFTER it (cursorIndex + 1), not at it
    let startIndex = 0
    if (cursor) {
      const cursorIndex = filteredAssets.findIndex(a => a.symbol === cursor)
      if (cursorIndex >= 0) {
        startIndex = cursorIndex + 1 // Start AFTER the cursor, not at it
      } else {
        logger.warn(`Cursor ${cursor} not found in filteredAssets, starting from beginning`, { job: jobId })
        startIndex = 0
      }
    }

    const endIndex = Math.min(startIndex + batchSize, filteredAssets.length)
    const assetsToProcess = filteredAssets.slice(startIndex, endIndex)
    
    // Calculate nextCursor: should point to the NEXT item after the batch, not the last processed
    const nextCursor = endIndex < filteredAssets.length ? filteredAssets[endIndex].symbol : null
    const done = endIndex >= filteredAssets.length

    logger.info('Filtered assets for bias computation', {
      job: jobId,
      originalCount: assets.length,
      filteredCount: filteredAssets.length,
      totalPairs: uniquePairsToProcess,
      startIndex,
      endIndex,
      batchSize,
      cursor,
      nextCursor,
      done,
      pairsInBatch: assetsToProcess.map(a => a.symbol),
    })

    let processedCount = 0
    let actualNextCursor: string | null = nextCursor // Will be updated if we hit hard limit

    for (const asset of assetsToProcess) {
      // Check hard limit before processing each asset
      const elapsed = Date.now() - startedAt
      if (elapsed > HARD_LIMIT_MS) {
        // If we hit hard limit, nextCursor should be the CURRENT asset (we'll continue from here)
        const currentIndex = filteredAssets.findIndex(a => a.symbol === asset.symbol)
        if (currentIndex >= 0 && currentIndex + 1 < filteredAssets.length) {
          actualNextCursor = filteredAssets[currentIndex].symbol // Continue from this asset next time
        } else {
          actualNextCursor = null // We're at the end
        }
        logger.warn(`Hard limit reached, stopping batch processing`, {
          job: jobId,
          elapsedMs: elapsed,
          processedCount,
          currentAsset: asset.symbol,
          nextCursor: actualNextCursor,
        })
        break
      }

      processedCount++
      try {
        const bias = await computeMacroBias(asset)
        const narrative = buildBiasNarrative(bias, asset)

        // Double-check before inserting (defensive programming)
        if (!isAllowedPair(asset.symbol)) {
          logger.warn('Skipping bias insertion for non-allowed pair', {
            job: jobId,
            symbol: asset.symbol,
          })
          continue
        }

        await upsertMacroBias(bias, narrative)
        computed++

        logger.info(`Computed bias for ${asset.symbol}`, {
          job: jobId,
          symbol: asset.symbol,
          score: bias.score,
          direction: bias.direction,
          confidence: bias.confidence,
        })
      } catch (error) {
        errors++
        logger.error(`Failed to compute bias for ${asset.symbol}`, {
          job: jobId,
          symbol: asset.symbol,
          error: error instanceof Error ? error.message : String(error),
        })
      }
      // Note: nextCursor is already calculated before the loop (points to item AFTER batch)
      // We only update it if we hit hard limit mid-batch
    }

    // Use actualNextCursor (may have been updated if we hit hard limit)
    const finalNextCursor = actualNextCursor !== null ? actualNextCursor : nextCursor

    // Check if we've processed all assets
    const isComplete = endIndex >= filteredAssets.length
    const finalDone = isComplete && finalNextCursor === null

    // Log final cursor state
    logger.info(`Bias computation batch complete`, {
      job: jobId,
      startIndex,
      endIndex,
      processedCount,
      totalAssets: filteredAssets.length,
      cursor,
      nextCursor: finalNextCursor,
      done: finalDone,
    })

    // Save job state
    const durationMs = Date.now() - startedAt
    await saveJobState(
      jobId,
      done ? null : nextCursor,
      done ? 'success' : 'partial',
      durationMs
    )

    const finishedAt = new Date().toISOString()

    // Update last bias computation timestamp
    setLastBiasUpdateTimestamp(finishedAt)
    
    // Record job success
    try {
      await recordJobSuccess('compute/bias')
    } catch (recordError) {
      logger.warn('Failed to record job success', {
        job: jobId,
        error: recordError instanceof Error ? recordError.message : String(recordError),
      })
    }

    logger.info('Bias computation batch completed', {
      job: jobId,
      computed,
      errors,
      done,
      nextCursor,
      processedCount,
      totalAssets: filteredAssets.length,
      durationMs,
    })

    // Only run post-processing (alerts, snapshots) if this is the last batch
    // This avoids timeout and ensures alerts only fire once per full computation
    const isLastBatch = finalDone

    // Check USD regime change alert (Trigger A) - only if last batch
    let diagnosis: Awaited<ReturnType<typeof getMacroDiagnosis>> | null = null
    let biasState: Awaited<ReturnType<typeof getBiasState>> | null = null
    
    if (isLastBatch && durationMs < HARD_LIMIT_MS) {
      try {
      diagnosis = await getMacroDiagnosis()
      if (!diagnosis) {
        throw new Error('Failed to get macro diagnosis')
      }
      const usd = usdBias(diagnosis.items)
      const latestDataDate = await getLatestObservationDate()
      
      // Build category chips string
      const categoryCounts = CATEGORY_ORDER.map(cat => {
        const count = diagnosis!.items.filter(i => i.category === cat).length
        return count > 0 ? `${cat}: ${count}` : null
      }).filter(Boolean).join(' · ')
      
      await checkUSDChange(
        usd,
        diagnosis.regime,
        diagnosis.score,
        latestDataDate,
        categoryCounts
      )
      
      logger.info('USD change check completed', { job: jobId, usd })
    } catch (error) {
      logger.error('Failed to check USD change alert', {
        job: jobId,
        error: error instanceof Error ? error.message : String(error),
      })
    }

    // Guardar snapshots para backtest y detectar cambios (Paso 4)
    try {
      if (diagnosis) {
        const usd = usdBias(diagnosis.items)
        const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD
        
        // Obtener biasState para tener confianza de pares
        if (!biasState) {
          biasState = await getBiasState()
        }
        
        const db = getUnifiedDB()
        const isTurso = isUsingTurso()
        
        // Guardar señal macro (USD)
        const usdConfidence = diagnosis.score >= 0.5 ? 'alta' : diagnosis.score >= 0.3 ? 'media' : 'baja'
        if (isTurso) {
          await db.prepare(`
            INSERT OR REPLACE INTO macro_signals (date, usd_score, usd_bias, usd_confidence)
            VALUES (?, ?, ?, ?)
          `).run(today, diagnosis.score, usd, usdConfidence)
        } else {
          db.prepare(`
            INSERT OR REPLACE INTO macro_signals (date, usd_score, usd_bias, usd_confidence)
            VALUES (?, ?, ?, ?)
          `).run(today, diagnosis.score, usd, usdConfidence)
        }
        
        // Guardar señales por par y detectar cambios de confianza
        // FILTER: Only save signals for pairs in tactical-pairs.json
        if (biasState && biasState.tableTactical && biasState.tableTactical.length > 0) {
          // Load allowed symbols from tactical-pairs.json
          let allowedSymbols = new Set<string>()
          try {
            const tacticalPath = path.join(process.cwd(), 'config', 'tactical-pairs.json')
            const tacticalRaw = await fs.readFile(tacticalPath, 'utf8')
            const tacticalPairs = JSON.parse(tacticalRaw) as Array<{ symbol: string; type?: string }>
            allowedSymbols = new Set(
              tacticalPairs.map(p => p.symbol.toUpperCase().replace('/', ''))
            )
          } catch (error) {
            logger.warn('Failed to load tactical-pairs.json for filtering pair_signals', {
              job: jobId,
              error: error instanceof Error ? error.message : String(error),
            })
            // If we can't load config, don't save any signals (fail-safe)
            allowedSymbols = new Set()
          }
          
          const pairSignals = biasState.tableTactical
            .filter((row: any) => {
              // First filter: only allowed symbols
              const symbol = (row.pair ?? row.symbol ?? '').replace('/', '').toUpperCase()
              if (!allowedSymbols.has(symbol)) {
                return false
              }
              // Second filter: only actionable signals
              const action = (row.action ?? row.accion ?? '').toLowerCase()
              return action.includes('compr') || action.includes('venta') || action.includes('buy') || action.includes('sell')
            })
            .map((row: any) => {
              const symbol = (row.pair ?? row.symbol ?? '').replace('/', '').toUpperCase()
              const action = (row.action ?? row.accion ?? '').toLowerCase()
              const confidence = (row.confidence ?? row.confianza ?? 'media').toLowerCase()
              
              let actionType = 'range'
              if (action.includes('compr') || action.includes('buy')) actionType = 'buy'
              else if (action.includes('venta') || action.includes('sell')) actionType = 'sell'
              
              return {
                date: today,
                symbol,
                action: actionType,
                confidence: confidence === 'alta' ? 'alta' : confidence === 'media' ? 'media' : 'baja',
              }
            })
          
          if (pairSignals.length > 0) {
            if (isTurso) {
              const stmt = await db.prepare(`
                INSERT OR REPLACE INTO pair_signals (date, symbol, action, confidence)
                VALUES (?, ?, ?, ?)
              `)
              for (const signal of pairSignals) {
                await stmt.run(signal.date, signal.symbol, signal.action, signal.confidence)
              }
            } else {
              const stmt = db.prepare(`
                INSERT OR REPLACE INTO pair_signals (date, symbol, action, confidence)
                VALUES (?, ?, ?, ?)
              `)
              for (const signal of pairSignals) {
                stmt.run(signal.date, signal.symbol, signal.action, signal.confidence)
              }
            }
          }

          // Detectar cambios de confianza
          try {
            const currentPairs = biasState.tableTactical.map((row: any) => ({
              pair: row.pair ?? row.symbol ?? '',
              confidence: row.confidence ?? row.confianza ?? 'Media',
              action: row.action ?? row.accion ?? '',
              trend: row.trend ?? row.tactico ?? '',
            }))
            
            const confidenceChanges = await detectConfidenceChanges(currentPairs)
            if (confidenceChanges.length > 0) {
              await notifyConfidenceChanges(confidenceChanges)
              logger.info('Confidence changes notified', { job: jobId, count: confidenceChanges.length })
            }
          } catch (error) {
            logger.error('Failed to detect/notify confidence changes', {
              job: jobId,
              error: error instanceof Error ? error.message : String(error),
            })
          }

          // Detectar cambios de escenarios
          try {
            const correlationState = await getCorrelationState()
            const tacticalRowsForScenarios = biasState.tableTactical.map((row: any) => ({
              par: row.pair ?? row.symbol ?? '',
              pair: row.pair ?? row.symbol ?? '',
              sesgoMacro: row.sesgoMacro ?? row.macroBias ?? row.bias ?? '',
              accion: row.accion ?? row.action ?? '',
              action: row.action ?? row.accion ?? '',
              motivo: row.motivo ?? row.reason ?? '',
              confianza: row.confianza ?? row.confidence ?? 'Media',
              confidence: row.confidence ?? row.confianza ?? 'Media',
              trend: row.trend ?? row.tactico ?? null,
            }))
            
            const usdBiasLabel = (biasState.regime.usd_direction || 'Neutral') as 'Neutral' | 'Fuerte' | 'Débil'
            const institutionalScenariosGrouped = getInstitutionalScenarios(
              tacticalRowsForScenarios,
              usdBiasLabel,
              biasState.regime.overall
            )
            
            const currentActive = institutionalScenariosGrouped.active
            const currentWatchlist = institutionalScenariosGrouped.watchlist

            // Por ahora, solo notificamos escenarios nuevos (comparación simplificada)
            // En producción podrías guardar snapshots de escenarios en BD
            const previousActive: any[] = []
            const previousWatchlist: any[] = []

            const scenarioChanges = detectScenarioChanges(
              currentActive,
              currentWatchlist,
              previousActive,
              previousWatchlist
            )

            // Solo notificar si hay escenarios nuevos (no todos los cambios)
            const newScenarios = scenarioChanges.filter(c => c.type === 'new')
            if (newScenarios.length > 0) {
              await notifyScenarioChanges(newScenarios)
              logger.info('New scenarios notified', { job: jobId, count: newScenarios.length })
            }
          } catch (error) {
            logger.error('Failed to detect/notify scenario changes', {
              job: jobId,
              error: error instanceof Error ? error.message : String(error),
            })
          }
          
          logger.info('Backtest snapshots saved', {
            job: jobId,
            macroSignals: 1,
            pairSignals: pairSignals.length,
          })
        }
      }
    } catch (error) {
      logger.error('Failed to save backtest snapshots', {
        job: jobId,
        error: error instanceof Error ? error.message : String(error),
      })
      // No fallar el job completo si falla el backtest
    }

      // Revalidate dashboard (only if last batch)
      try { revalidatePath('/') } catch {}
    } else {
      logger.info('Skipping post-processing (alerts, snapshots) - not last batch or time limit reached', {
        job: jobId,
        isLastBatch,
        durationMs,
        hardLimit: HARD_LIMIT_MS,
      })
    }

    return NextResponse.json({
      success: true,
      job: jobId,
      computed,
      errors,
      processed: processedCount,
      nextCursor: finalNextCursor,
      done: finalDone,
      durationMs: Date.now() - startedAt,
      finishedAt,
    })
  } catch (error) {
    const finishedAt = new Date().toISOString()
    const errorMessage = error instanceof Error ? error.message : String(error)

    logger.error('Bias computation failed', {
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



