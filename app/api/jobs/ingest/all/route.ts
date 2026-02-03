/**
 * Ingest all countries
 * POST /api/jobs/ingest/all
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateCronToken, unauthorizedResponse } from '@/lib/security/token'
import { logger } from '@/lib/obs/logger'
import { generateRunId } from '@/lib/obs/request-id'

export const runtime = 'nodejs'

const COUNTRIES = ['ca', 'nz', 'ch', 'jp', 'uk', 'cn'] as const

export async function POST(request: NextRequest) {
  // Use validateCronToken which handles localhost automatically
  if (!validateCronToken(request)) {
    return unauthorizedResponse()
  }

  // Get token for logging/forwarding (optional in dev)
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : 'dev_local'

  const runId = generateRunId()
  const startTime = Date.now()

  // Store run status as running
  try {
    const { storeRunStatus } = await import('@/lib/betaRunStore')
    storeRunStatus({
      runId,
      job: 'ingest/all',
      status: 'running',
      startTime,
    })
  } catch (e) {
    // Ignore if storeRunStatus not available
  }

  logger.info('job.start', {
    job: 'ingest/all',
    runId,
    route: '/api/jobs/ingest/all',
    countries: COUNTRIES,
  })

  try {
    const results = []
    const summary = {
      ingested: 0,
      failed: 0,
      notMigrated: 0,
      notAvailable: 0,
      total: 0,
    }

    // Execute each country sequentially to avoid overwhelming the system
    for (const country of COUNTRIES) {
      try {
        const countryUrl = `${request.nextUrl.origin}/api/jobs/ingest/${country}`
        const headers: HeadersInit = {
          'Content-Type': 'application/json',
        }
        
        // Only add Authorization if we have a real token (not needed in localhost dev)
        if (token && token !== 'dev_local') {
          headers['Authorization'] = `Bearer ${token}`
        }
        
        const response = await fetch(countryUrl, {
          method: 'POST',
          headers,
        })

        const countryResult = await response.json()

        if (countryResult.success) {
          summary.ingested += countryResult.ingested || 0
          summary.failed += countryResult.failed || 0
          summary.notMigrated += countryResult.notMigrated || 0
          summary.notAvailable += countryResult.notAvailable || 0
          summary.total += countryResult.total || 0

          results.push({
            country: country.toUpperCase(),
            ...countryResult,
          })
        } else {
          summary.failed += 1
          results.push({
            country: country.toUpperCase(),
            success: false,
            error: countryResult.error || 'Unknown error',
          })
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        logger.error(`job.country.failed`, {
          job: 'ingest/all',
          runId,
          country,
          error: errorMsg,
        })

        summary.failed += 1
        results.push({
          country: country.toUpperCase(),
          success: false,
          error: errorMsg,
        })
      }
    }

    const durationMs = Date.now() - startTime

    logger.info('job.complete', {
      job: 'ingest/all',
      runId,
      durationMs,
      summary,
      countriesProcessed: results.length,
    })

    // Store run status as complete
    try {
      const { storeRunStatus } = await import('@/lib/betaRunStore')
      storeRunStatus({
        runId,
        job: 'ingest/all',
        status: 'complete',
        startTime,
        durationMs,
        summary,
      })
    } catch (e) {
      // Ignore if storeRunStatus not available
    }

    return NextResponse.json({
      success: true,
      runId,
      durationMs,
      summary,
      countries: results,
    })
  } catch (error) {
    const durationMs = Date.now() - startTime
    const errorMsg = error instanceof Error ? error.message : String(error)

    // Store run status as error
    try {
      const { storeRunStatus } = await import('@/lib/betaRunStore')
      storeRunStatus({
        runId,
        job: 'ingest/all',
        status: 'error',
        startTime,
        durationMs,
        error: errorMsg,
      })
    } catch (e) {
      // Ignore if storeRunStatus not available
    }

    logger.error('job.failed', {
      job: 'ingest/all',
      runId,
      durationMs,
      error: errorMsg,
    })

    return NextResponse.json(
      {
        success: false,
        runId,
        durationMs,
        error: errorMsg,
      },
      { status: 500 }
    )
  }
}
