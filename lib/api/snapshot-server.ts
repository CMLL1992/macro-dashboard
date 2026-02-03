/**
 * Snapshot API Client (Server-side)
 * 
 * Helper para consumir /api/snapshot desde server components.
 * Usa fetch interno (no window.location) y tipos seguros.
 */

import type { MacroSnapshot } from '@/domain/macro-snapshot/schema'
import type { InvariantResult } from '@/lib/quality/invariants'

export interface SnapshotResponse {
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

export interface SnapshotErrorResponse {
  ok: false
  error: string
  message: string
  requestId: string
  issues?: Array<{ path: string; message: string }>
}

export type SnapshotApiResponse = SnapshotResponse | SnapshotErrorResponse

/**
 * Fetch snapshot from /api/snapshot (server-side)
 * 
 * @param includeInvariants - If true, includes invariant results in response
 * @param baseUrl - Base URL for API (defaults to process.env.APP_URL or localhost)
 * @returns SnapshotResponse or SnapshotErrorResponse
 */
export async function fetchSnapshotServer(
  includeInvariants: boolean = false,
  includePrevious: boolean = false,
  baseUrl?: string
): Promise<SnapshotApiResponse> {
  // Determine base URL for internal fetch
  const base = baseUrl || process.env.APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
  const url = new URL('/api/snapshot', base)
  
  if (includeInvariants) {
    url.searchParams.set('includeInvariants', 'true')
  }

  try {
    // For server-side, use internal fetch (no external HTTP call)
    // In Next.js, this will use the internal route handler
    const response = await fetch(url.toString(), {
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    const requestId = response.headers.get('x-request-id') || 'unknown'

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return {
        ok: false,
        error: errorData.error || 'snapshot_fetch_failed',
        message: errorData.message || `HTTP ${response.status}`,
        requestId,
        issues: errorData.issues,
      }
    }

    const data = await response.json()

    // Handle both old format (direct snapshot) and new format (wrapped)
    if (data.ok === false) {
      return data as SnapshotErrorResponse
    }

    // If data is a snapshot directly (backward compatibility)
    if (data.nowTs && data.regime && !data.snapshot) {
      return {
        ok: true,
        snapshot: data as MacroSnapshot,
        requestId,
        metrics: {
          items_count: data.drivers?.length ?? 0,
          rows_corr: data.correlations?.length ?? 0,
          upcoming_count: data.upcomingDates?.length ?? 0,
          has_narrative: !!data.narrative,
          regime: data.regime?.overall ?? 'unknown',
          usdBias: data.usdBias ?? 'unknown',
          score: data.metrics?.score ?? data.score ?? 0,
        },
      }
    }

    // New format (wrapped)
    return {
      ...data,
      requestId: data.requestId || requestId,
      previousSnapshot: data.previousSnapshot ?? null,
    } as SnapshotResponse
  } catch (error) {
    return {
      ok: false,
      error: 'snapshot_fetch_error',
      message: error instanceof Error ? error.message : 'Unknown error',
      requestId: 'unknown',
    }
  }
}

