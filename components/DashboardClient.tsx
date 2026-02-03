/**
 * Dashboard Client Component
 * 
 * Client component que recibe snapshot + invariants y renderiza MacroOverlay.
 * También puede incluir un botón de refresh para debugging.
 */

'use client'

import React, { useState } from 'react'
import type { MacroSnapshot } from '@/domain/macro-snapshot/schema'
import type { InvariantResult } from '@/lib/quality/invariants'
import { macroSignalEngine, type CooldownState } from '@/domain/macro-signals/engine'
import { calculateSnapshotDeltas } from '@/domain/macro-signals/deltas'
import { fetchSnapshot } from '@/lib/api/snapshot-client'
import { clientLogger } from '@/lib/obs/client-logger'
import MacroOverlay from './MacroOverlay'

interface DashboardClientProps {
  snapshot: MacroSnapshot
  invariants?: InvariantResult[]
  requestId: string
  previousSnapshot?: MacroSnapshot | null
  previousSignal?: ReturnType<typeof macroSignalEngine> | null
  onRefresh?: () => void
}

export default function DashboardClient({
  snapshot: initialSnapshot,
  invariants: initialInvariants = [],
  requestId: initialRequestId,
  previousSnapshot: initialPreviousSnapshot,
  previousSignal: initialPreviousSignal,
  onRefresh: externalOnRefresh,
}: DashboardClientProps) {
  const [snapshot, setSnapshot] = React.useState(initialSnapshot)
  const [invariants, setInvariants] = React.useState(initialInvariants)
  const [requestId, setRequestId] = React.useState(initialRequestId)
  const [previousSnapshot, setPreviousSnapshot] = React.useState(initialPreviousSnapshot)
  const [previousSignal, setPreviousSignal] = React.useState(initialPreviousSignal)
  const [refreshing, setRefreshing] = useState(false)

  // Calculate signal from snapshot
  const baseSignal = macroSignalEngine(snapshot, invariants)

  // Calculate deltas if previous snapshot exists
  const deltas = previousSnapshot && previousSignal
    ? calculateSnapshotDeltas(snapshot, previousSnapshot, baseSignal, previousSignal)
    : undefined

  // Calculate cooldown state from deltas (Fase 3.3)
  const cooldownState: CooldownState | undefined = deltas
    ? (() => {
        if (!deltas || deltas.length === 0) {
          return undefined
        }

        // Buscar hard_stop en deltas
        const hardStop = deltas.find(d => d.severity === 'hard_stop')
        if (!hardStop) {
          return undefined
        }

        // Cooldown activo por 1 hora después de hard_stop
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()

        let reason = 'Hard stop detectado'
        if (hardStop.context && typeof hardStop.context.action === 'string') {
          reason += `: ${hardStop.context.action}`
        }

        const revalidationConditions: string[] = [
          'Esperar nuevo snapshot sin hard_stop',
          'Verificar que condiciones de bloqueo se hayan resuelto',
        ]

        // Condiciones específicas según el tipo de hard_stop
        if (hardStop.id === 'regime_change') {
          revalidationConditions.push('Confirmar nuevo régimen estable')
        } else if (hardStop.id === 'top_driver_direction_change') {
          revalidationConditions.push('Verificar que nuevo driver #1 esté alineado')
        } else if (hardStop.id === 'anchor_correlation_lost') {
          revalidationConditions.push('Esperar nueva correlación ancla estable')
        }

        return {
          isActive: true,
          reason,
          expiresAt,
          revalidationConditions,
        }
      })()
    : undefined

  const signal = {
    ...baseSignal,
    deltas,
    cooldownState,
  }

  // Refresh snapshot (only in development)
  const handleRefresh = async () => {
    if (process.env.NODE_ENV !== 'development') {
      return
    }

    setRefreshing(true)
    try {
      // Fetch with previous snapshot for deltas
      const url = new URL('/api/snapshot', typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000')
      url.searchParams.set('includeInvariants', 'true')
      url.searchParams.set('includePrevious', 'true')

      const response = await fetch(url.toString(), {
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()
      if (data.ok) {
        // Store current as previous before updating
        setPreviousSnapshot(snapshot)
        setPreviousSignal(baseSignal)
        
        setSnapshot(data.snapshot)
        setInvariants(data.invariants || [])
        setRequestId(data.requestId)
        
        // Update previous snapshot if provided
        if (data.previousSnapshot) {
          setPreviousSnapshot(data.previousSnapshot)
        }
      }
    } catch (error) {
      clientLogger.error('Failed to refresh snapshot', error, { component: 'DashboardClient' })
    } finally {
      setRefreshing(false)
    }
  }

  // Use external refresh handler if provided, otherwise use internal
  const onRefresh = externalOnRefresh || handleRefresh
  const showRefreshButton = process.env.NODE_ENV === 'development'

  return (
    <div className="space-y-4">
      {/* Macro Overlay - Single Source of Truth */}
      <MacroOverlay signal={signal} requestId={requestId} />

      {/* Refresh button (dev only) */}
      {showRefreshButton && (
        <div className="flex justify-end">
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className="text-xs text-muted-foreground hover:text-foreground underline disabled:opacity-50"
          >
            {refreshing ? 'Refrescando...' : 'Refresh snapshot'}
          </button>
        </div>
      )}
    </div>
  )
}

