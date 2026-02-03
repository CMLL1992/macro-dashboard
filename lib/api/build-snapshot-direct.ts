/**
 * Build Snapshot Directly (Server-side)
 * 
 * Helper para construir snapshot directamente sin hacer fetch HTTP.
 * Evita duplicar llamadas a getDashboardData() y mejora rendimiento.
 */

import type { MacroSnapshot } from '@/domain/macro-snapshot/schema'
import type { InvariantResult, Snapshot } from '@/lib/quality/invariants'
import { dashboardToSnapshot } from '@/domain/macro-snapshot/adapters/dashboard'
import { MacroSnapshotSchema } from '@/domain/macro-snapshot/schema'
import { getDashboardData, type DashboardData } from '@/lib/dashboard-data'
import { runInvariants } from '@/lib/quality/invariants'
import { getPreviousSnapshot } from '@/lib/db/snapshot-cache'
import { logger } from '@/lib/obs/logger'
import { generateRequestId } from '@/lib/obs/request-id'
import { extractSnapshotMetrics } from '@/lib/api/telemetry'
import { measureAsync } from '@/lib/utils/performance-logger'

export interface BuildSnapshotResult {
  ok: true
  snapshot: MacroSnapshot
  requestId: string
  invariants?: InvariantResult[]
  previousSnapshot?: MacroSnapshot | null
  metrics: {
    items_count: number
    rows_corr: number
    upcoming_count: number
    has_narrative: boolean
    regime: string
    usdBias: string
    score: number
  }
}

export interface BuildSnapshotError {
  ok: false
  error: string
  message: string
  requestId: string
  issues?: Array<{ path: string; message: string }>
}

export type BuildSnapshotResponse = BuildSnapshotResult | BuildSnapshotError

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

/**
 * Build snapshot directly (no HTTP fetch)
 * 
 * @param includeInvariants - If true, includes invariant results
 * @param includePrevious - If true, includes previous snapshot
 * @param requestId - Optional request ID (generated if not provided)
 * @param dashboardData - Optional dashboard data (if provided, skips calling getDashboardData)
 * @returns BuildSnapshotResponse
 */
export async function buildSnapshotDirect(
  includeInvariants: boolean = false,
  includePrevious: boolean = false,
  requestId?: string,
  dashboardData?: DashboardData
): Promise<BuildSnapshotResponse> {
  const reqId = requestId || generateRequestId()
  const startTime = Date.now()

  try {
    logger.info('snapshot.build.start', {
      requestId: reqId,
      route: 'buildSnapshotDirect',
      hasDashboardData: !!dashboardData,
    })

    // Get dashboard data (only if not provided)
    // OPTIMIZACIÓN: Si dashboardData ya está disponible, no lo llamamos de nuevo
    const finalDashboardData = dashboardData || await measureAsync(
      'buildSnapshotDirect.getDashboardData',
      () => getDashboardData(),
      reqId
    )

    if (!finalDashboardData) {
      logger.error('snapshot.build.dashboard_data_missing', {
        requestId: reqId,
      })

      return {
        ok: false,
        error: 'snapshot_invalid',
        message: 'Dashboard data not available',
        requestId: reqId,
      }
    }

    // Convert DashboardData to MacroSnapshot
    // MEDIR TIEMPO: dashboardToSnapshot puede ser lento si llama a getBiasState/getCorrelationState
    const snapshot = await measureAsync(
      'buildSnapshotDirect.dashboardToSnapshot',
      () => dashboardToSnapshot(finalDashboardData),
      reqId
    )

    if (!snapshot) {
      logger.error('snapshot.build.conversion_failed', {
        requestId: reqId,
      })

      return {
        ok: false,
        error: 'snapshot_invalid',
        message: 'Failed to convert dashboard data to snapshot',
        requestId: reqId,
      }
    }

    // Validate snapshot with MacroSnapshotSchema
    const validation = MacroSnapshotSchema.safeParse(snapshot)

    if (!validation.success) {
      logger.error('snapshot.build.validation_failed', {
        requestId: reqId,
        issues: validation.error.errors.map(e => ({
          path: e.path.join('.'),
          message: e.message,
          code: e.code,
        })),
      })

      return {
        ok: false,
        error: 'snapshot_invalid',
        message: 'Snapshot validation failed',
        requestId: reqId,
        issues: validation.error.errors.map(e => ({
          path: e.path.join('.'),
          message: e.message,
        })),
      }
    }

    const validatedSnapshot = validation.data
    const metricsRaw = extractSnapshotMetrics(validatedSnapshot)
    const metrics = {
      items_count: (metricsRaw.items_count as number) ?? 0,
      rows_corr: (metricsRaw.rows_corr as number) ?? 0,
      upcoming_count: (metricsRaw.upcoming_count as number) ?? 0,
      has_narrative: (metricsRaw.has_narrative as boolean) ?? false,
      regime: (metricsRaw.regime as string) ?? 'unknown',
      usdBias: (metricsRaw.usdBias as string) ?? 'unknown',
      score: (metricsRaw.score as number) ?? 0,
    }

    // Get previous snapshot if requested
    let previousSnapshot: typeof validatedSnapshot | null = null
    if (includePrevious) {
      previousSnapshot = await getPreviousSnapshot()
    }

    // Run invariants if requested (normalize correlations to Record for domain Snapshot type)
    let invariants: InvariantResult[] | undefined
    if (includeInvariants) {
      const snapshotForInvariants = {
        ...validatedSnapshot,
        correlations: correlationsToRecord(validatedSnapshot.correlations),
      } as unknown as Snapshot

      const invariantResults = runInvariants(snapshotForInvariants)
      invariants = invariantResults.issues.map((r) => ({
        name: r.code,
        level: r.severity,
        message: r.message,
      }))

      logger.info('snapshot.build.invariants_computed', {
        requestId: reqId,
        count: invariants.length,
        countError: invariants.filter((i) => i.level === 'FAIL').length,
        countWarn: invariants.filter((i) => i.level === 'WARN').length,
      })
    }

    const durationMs = Date.now() - startTime

    logger.info('snapshot.build.done', {
      requestId: reqId,
      route: 'buildSnapshotDirect',
      durationMs,
      ...metrics,
    })

    const result: BuildSnapshotResult = {
      ok: true,
      snapshot: validatedSnapshot,
      requestId: reqId,
      metrics,
    }

    if (invariants) {
      result.invariants = invariants
    }

    if (includePrevious && previousSnapshot !== null) {
      result.previousSnapshot = previousSnapshot
    }

    return result
  } catch (error) {
    const durationMs = Date.now() - startTime

    logger.error('snapshot.build.error', {
      requestId: reqId,
      route: 'buildSnapshotDirect',
      error: error instanceof Error ? error.message : String(error),
      durationMs,
    })

    return {
      ok: false,
      error: 'snapshot_build_error',
      message: error instanceof Error ? error.message : 'Unknown error',
      requestId: reqId,
    }
  }
}

