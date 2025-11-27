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

export async function POST(request: NextRequest) {
  if (!validateCronToken(request)) {
    return unauthorizedResponse()
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

        upsertMacroBias(bias, narrative)
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

    logger.info('Bias computation completed', {
      job: jobId,
      computed,
      errors,
    })

    // Check USD regime change alert (Trigger A)
    try {
      const diagnosis = await getMacroDiagnosis()
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



