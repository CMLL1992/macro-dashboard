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
import universeAssets from '@/config/universe.assets.json'
import type { AssetMeta } from '@/lib/bias/types'
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
  const startedAt = new Date().toISOString()

  try {
    logger.info('Starting bias computation', { job: jobId })

    const assets = universeAssets as AssetMeta[]
    let computed = 0
    let errors = 0

    for (const asset of assets) {
      try {
        const bias = await computeMacroBias(asset)
        const narrative = buildBiasNarrative(bias, asset)

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
    }

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

    logger.info('Bias computation completed', {
      job: jobId,
      computed,
      errors,
    })

    // Check USD regime change alert (Trigger A)
    let diagnosis: Awaited<ReturnType<typeof getMacroDiagnosis>> | null = null
    let biasState: Awaited<ReturnType<typeof getBiasState>> | null = null
    
    try {
      diagnosis = await getMacroDiagnosis()
      const usd = usdBias(diagnosis.items)
      const latestDataDate = await getLatestObservationDate()
      
      // Build category chips string
      const categoryCounts = CATEGORY_ORDER.map(cat => {
        const count = diagnosis.items.filter(i => i.category === cat).length
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
        if (biasState && biasState.tableTactical && biasState.tableTactical.length > 0) {
          const pairSignals = biasState.tableTactical
            .filter((row: any) => {
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
            
            const usdBiasLabel = biasState.regime.usd_label || 'Neutral'
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

    // Revalidate dashboard
    try { revalidatePath('/') } catch {}

    return NextResponse.json({
      success: true,
      computed,
      errors,
      duration_ms: new Date(finishedAt).getTime() - new Date(startedAt).getTime(),
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



