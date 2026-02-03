/**
 * Macro Snapshot API Endpoint
 * 
 * GET /api/snapshot
 * 
 * Returns a validated MacroSnapshot with all macro state:
 * - Regime, USD bias, score
 * - Drivers
 * - Upcoming dates
 * - Correlations
 * - Narrative
 * 
 * This is the canonical "source of truth" endpoint for macro state.
 * All UI components and jobs should consume this endpoint for consistency.
 */

import { NextRequest, NextResponse } from 'next/server'
import { withApiTelemetry, extractSnapshotMetrics } from '@/lib/api/telemetry'
import { dashboardToSnapshot } from '@/domain/macro-snapshot/adapters/dashboard'
import { MacroSnapshotSchema } from '@/domain/macro-snapshot/schema'
import { getDashboardData } from '@/lib/dashboard-data'
import { runInvariants } from '@/lib/quality/invariants'
import { saveSnapshotToCache, getPreviousSnapshot } from '@/lib/db/snapshot-cache'
import { logger } from '@/lib/obs/logger'
import { macroSignalEngine } from '@/domain/macro-signals/engine'
import { checkSignalAlerts } from '@/lib/notifications/signal-alerts'
import type { Snapshot } from '@/lib/quality/invariants'

function correlationsToRecord(
  correlations: Array<{
    symbol: string
    corr12m: number | null
    corr6m: number | null
    corr3m: number | null
    benchmark: string
  }> | undefined
): Record<string, number> {
  const out: Record<string, number> = {}
  if (!correlations) return out
  for (const c of correlations) {
    const v = c.corr12m ?? c.corr6m ?? c.corr3m
    if (typeof v === 'number' && Number.isFinite(v)) {
      out[`${c.benchmark}:${c.symbol}`] = v
    }
  }
  return out
}

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  return withApiTelemetry(
    request,
    { route: '/api/snapshot' },
    async (ctx) => {
      // Check query parameters
      const url = new URL(request.url)
      const includeInvariants = url.searchParams.get('includeInvariants') === 'true'
      const includePrevious = url.searchParams.get('includePrevious') === 'true'
      // Build snapshot from dashboard data
      const dashboardData = await getDashboardData()
      
      if (!dashboardData) {
        logger.error('api.snapshot.dashboard_data_missing', {
          requestId: ctx.requestId,
          route: '/api/snapshot',
        })
        
        return NextResponse.json(
          {
            ok: false,
            error: 'snapshot_invalid',
            message: 'Dashboard data not available',
            requestId: ctx.requestId,
          },
          {
            status: 500,
            headers: {
              'x-request-id': ctx.requestId,
            },
          }
        )
      }

      // Convert DashboardData to MacroSnapshot
      const snapshot = await dashboardToSnapshot(dashboardData)

      if (!snapshot) {
        logger.error('api.snapshot.conversion_failed', {
          requestId: ctx.requestId,
          route: '/api/snapshot',
        })
        
        return NextResponse.json(
          {
            ok: false,
            error: 'snapshot_invalid',
            message: 'Failed to convert dashboard data to snapshot',
            requestId: ctx.requestId,
          },
          {
            status: 500,
            headers: {
              'x-request-id': ctx.requestId,
            },
          }
        )
      }

      // Validate snapshot with MacroSnapshotSchema
      const validation = MacroSnapshotSchema.safeParse(snapshot)

      if (!validation.success) {
        logger.error('api.snapshot.validation_failed', {
          requestId: ctx.requestId,
          route: '/api/snapshot',
          issues: validation.error.errors.map(e => ({
            path: e.path.join('.'),
            message: e.message,
            code: e.code,
          })),
        })

        return NextResponse.json(
          {
            ok: false,
            error: 'snapshot_invalid',
            message: 'Snapshot validation failed',
            requestId: ctx.requestId,
            issues: validation.error.errors.map(e => ({
              path: e.path.join('.'),
              message: e.message,
            })),
          },
          {
            status: 500,
            headers: {
              'x-request-id': ctx.requestId,
            },
          }
        )
      }

      // Extract metrics for logging (will be added to api.done by withApiTelemetry)
      const metrics = extractSnapshotMetrics(validation.data)

      const validatedSnapshot = validation.data

      // Save to cache (non-blocking)
      saveSnapshotToCache(validatedSnapshot).catch((err) => {
        logger.warn('api.snapshot.cache_failed', {
          requestId: ctx.requestId,
          error: err instanceof Error ? err.message : String(err),
        })
      })

      // Get previous snapshot if requested
      let previousSnapshot: typeof validatedSnapshot | null = null
      if (includePrevious) {
        previousSnapshot = await getPreviousSnapshot()
      }

      // Run invariants if requested (normalize correlations to Record for domain Snapshot type)
      let invariants: Array<{ id: string; level: string; message: string; ctx?: Record<string, unknown> }> | undefined
      if (includeInvariants) {
        const snapshotForInvariants = {
          ...validatedSnapshot,
          correlations: correlationsToRecord(validatedSnapshot.correlations),
        } as unknown as Snapshot

        const invariantResults = runInvariants(snapshotForInvariants)
        const levelToApi = (s: string) => (s === 'FAIL' ? 'error' : s === 'WARN' ? 'warn' : 'info')
        invariants = invariantResults.issues.map((r) => ({
          id: r.code,
          level: levelToApi(r.severity),
          message: r.message,
        }))

        logger.info('api.snapshot.invariants_computed', {
          requestId: ctx.requestId,
          route: '/api/snapshot',
          count: invariants.length,
          countError: invariants.filter((i) => i.level === 'error').length,
          countWarn: invariants.filter((i) => i.level === 'warn').length,
        })
      }

      // Calculate signals for alerts (macroSignalEngine expects InvariantResult: name, level 'PASS'|'WARN'|'FAIL', message)
      const apiLevelToQuality = (l: string): 'PASS' | 'WARN' | 'FAIL' => (l === 'error' ? 'FAIL' : l === 'warn' ? 'WARN' : 'PASS')
      const invariantResultsForSignal = invariants?.map((i) => ({ name: i.id, level: apiLevelToQuality(i.level), message: i.message })) || []
      const currentSignal = macroSignalEngine(validatedSnapshot, invariantResultsForSignal)
      const previousSignal = previousSnapshot
        ? macroSignalEngine(previousSnapshot, []) // No invariants for previous
        : null

      // Check for signal alerts (non-blocking)
      checkSignalAlerts(currentSignal, previousSignal, validatedSnapshot).catch((err) => {
        logger.warn('api.snapshot.alerts_failed', {
          requestId: ctx.requestId,
          error: err instanceof Error ? err.message : String(err),
        })
      })

      // Build response payload
      const responsePayload: {
        ok: true
        snapshot: typeof validatedSnapshot
        requestId: string
        invariants?: typeof invariants
        previousSnapshot?: typeof validatedSnapshot | null
        metrics: typeof metrics
      } = {
        ok: true,
        snapshot: validatedSnapshot,
        requestId: ctx.requestId,
        metrics,
      }

      if (invariants) {
        responsePayload.invariants = invariants
      }

      if (includePrevious && previousSnapshot !== null) {
        responsePayload.previousSnapshot = previousSnapshot
      }

      // Return validated snapshot with optional invariants
      // Note: withApiTelemetry will add x-request-id and log api.done with metrics
      return NextResponse.json(
        responsePayload,
        {
          status: 200,
          headers: {
            'x-request-id': ctx.requestId,
            'Cache-Control': 'no-store', // Snapshot is dynamic, don't cache
          },
        }
      )
    }
  )
}

