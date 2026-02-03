/**
 * Drivers Section Component
 * 
 * Muestra los drivers principales del snapshot (top 3-5 por impacto).
 * Fallback a legacy si snapshot.drivers está vacío.
 */

import React from 'react'
import type { BiasDriver } from '@/domain/macro-snapshot/schema'
import type { InvariantResult } from '@/lib/quality/invariants'

interface DriversSectionProps {
  drivers: BiasDriver[]
  invariants?: InvariantResult[]
  requestId?: string
  className?: string
}

export default function DriversSection({
  drivers,
  invariants = [],
  requestId,
  className = '',
}: DriversSectionProps) {
  // Check for invariant errors (tolerante a distintos enums / strings)
  const level = (v: any) => String(v ?? '').toLowerCase()

  const hasErrors = invariants.some(i =>
    ['error', 'fail', 'critical'].includes(level((i as any).level)),
  )
  const hasWarnings = invariants.some(i =>
    ['warn', 'warning'].includes(level((i as any).level)),
  )

  // Sort by weight (descending) and take top 5
  const topDrivers = [...drivers]
    .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))
    .slice(0, 5)

  if (topDrivers.length === 0) {
    return (
      <section className={`rounded-lg border bg-card p-6 ${className}`}>
        <h2 className="text-lg font-semibold mb-3">Drivers Principales</h2>
        <div className="text-sm text-muted-foreground">
          Sin drivers disponibles
          {requestId && (
            <span className="ml-2 text-xs font-mono">(ID: {requestId.substring(0, 8)}...)</span>
          )}
        </div>
      </section>
    )
  }

  const getDirectionColor = (direction: BiasDriver['direction']) => {
    switch (direction) {
      case 'long':
        return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 border-green-300 dark:border-green-700'
      case 'short':
        return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 border-red-300 dark:border-red-700'
      default:
        return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-700'
    }
  }

  const getDirectionLabel = (direction: BiasDriver['direction']) => {
    switch (direction) {
      case 'long':
        return 'LONG'
      case 'short':
        return 'SHORT'
      default:
        return 'NEUTRAL'
    }
  }

  return (
    <section className={`rounded-lg border bg-card p-6 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">Drivers Principales</h2>
        {hasErrors && (
          <span className="text-xs px-2 py-1 rounded bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 border border-red-300 dark:border-red-700">
            ⚠️ Drivers pueden estar incompletos
          </span>
        )}
        {hasWarnings && !hasErrors && (
          <span className="text-xs px-2 py-1 rounded bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 border border-yellow-300 dark:border-yellow-700">
            ⚠️ Advertencias de calidad
          </span>
        )}
      </div>

      <div className="space-y-3">
        {topDrivers.map((driver, idx) => (
          <div
            key={`${driver.key}-${idx}`}
            className="rounded-lg border p-3 bg-muted/50"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-sm">{driver.name || driver.key}</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded border ${getDirectionColor(driver.direction)}`}
                  >
                    {getDirectionLabel(driver.direction)}
                  </span>
                  {driver.weight != null && (
                    <span className="text-xs text-muted-foreground">
                      Peso: {(driver.weight * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
                {driver.note && (
                  <p className="text-xs text-muted-foreground mt-1">{driver.note}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {drivers.length > 5 && (
        <p className="text-xs text-muted-foreground mt-3">
          Mostrando top 5 de {drivers.length} drivers totales
        </p>
      )}
    </section>
  )
}

