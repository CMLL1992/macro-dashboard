/**
 * API Telemetry Helper
 * 
 * Provides consistent request/response handling with:
 * - Request ID extraction/generation
 * - Structured logging (api.request, api.done, api.error)
 * - Response headers (x-request-id)
 * - Duration measurement
 * - Error handling
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getOrGenerateRequestId } from '@/lib/obs/request-id'
import { logger } from '@/lib/obs/logger'

export interface ApiTelemetryOptions {
  route: string
  metrics?: Record<string, unknown>
}

export interface ApiHandlerContext {
  requestId: string
  startTime: number
  route: string
}

/**
 * Wrapper for API route handlers with telemetry
 * 
 * Usage:
 *   export async function GET(request: NextRequest) {
 *     return withApiTelemetry(request, { route: '/api/snapshot' }, async (ctx) => {
 *       const snapshot = await buildSnapshot()
 *       return NextResponse.json(snapshot, {
 *         headers: { 'x-request-id': ctx.requestId }
 *       })
 *     })
 *   }
 */
export async function withApiTelemetry<T = unknown>(
  request: NextRequest,
  options: ApiTelemetryOptions,
  handler: (ctx: ApiHandlerContext) => Promise<NextResponse>
): Promise<NextResponse> {
  const requestId = getOrGenerateRequestId(request)
  const startTime = Date.now()
  const { route, metrics = {} } = options

  const ctx: ApiHandlerContext = {
    requestId,
    startTime,
    route,
  }

  logger.debug('api.request', {
    requestId,
    route,
    method: request.method,
    url: request.url,
  })

  try {
    const response = await handler(ctx)
    const durationMs = Date.now() - startTime

    // Ensure x-request-id is in response headers
    if (!response.headers.get('x-request-id')) {
      response.headers.set('x-request-id', requestId)
    }

    // Log success with metrics
    logger.info('api.done', {
      requestId,
      route,
      method: request.method,
      status: response.status,
      durationMs,
      ...metrics,
    })

    return response
  } catch (error) {
    const durationMs = Date.now() - startTime

    logger.error('api.error', {
      requestId,
      route,
      method: request.method,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      durationMs,
      ...metrics,
    })

    // Return error response with requestId
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        requestId,
      },
      {
        status: 500,
        headers: {
          'x-request-id': requestId,
        },
      }
    )
  }
}

/**
 * Extract snapshot metrics from MacroSnapshot
 */
export function extractSnapshotMetrics(snapshot: {
  drivers?: unknown[]
  correlations?: unknown[]
  upcomingDates?: unknown[]
  narrative?: unknown
  regime?: { overall?: string }
  usdBias?: string
  score?: number
}): Record<string, unknown> {
  return {
    items_count: snapshot.drivers?.length ?? 0,
    rows_corr: Array.isArray(snapshot.correlations) ? snapshot.correlations.length : 0,
    upcoming_count: snapshot.upcomingDates?.length ?? 0,
    has_narrative: !!snapshot.narrative,
    regime: snapshot.regime?.overall ?? 'unknown',
    usdBias: snapshot.usdBias ?? 'unknown',
    score: snapshot.score ?? 0,
  }
}

