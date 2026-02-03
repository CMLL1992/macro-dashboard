/**
 * Indicators Table Core Component
 * 
 * Tabla reducida "macro core" (10-15 indicadores) basada en snapshot.
 * Muestra solo los drivers principales y métricas clave del régimen.
 */

import React from 'react'
import type { MacroSnapshot } from '@/domain/macro-snapshot/schema'
import { formatIndicatorValueSimple } from '@/lib/utils/format-indicator-value'

interface IndicatorsTableCoreProps {
  snapshot: MacroSnapshot
  className?: string
}

/**
 * Map driver key to indicator metadata (for display)
 */
function getIndicatorMetadata(key: string) {
  const metadata: Record<string, { label: string; category: string; unit?: string }> = {
    usd_bias: { label: 'USD Bias', category: 'Moneda' },
    cpi_yoy: { label: 'CPI YoY', category: 'Inflación', unit: '%' },
    gdp_growth: { label: 'GDP Growth', category: 'Crecimiento', unit: '%' },
    unemployment: { label: 'Unemployment', category: 'Empleo', unit: '%' },
    fed_funds: { label: 'Fed Funds Rate', category: 'Política Monetaria', unit: '%' },
    pmi: { label: 'PMI', category: 'Actividad' },
    retail_sales: { label: 'Retail Sales', category: 'Consumo', unit: '%' },
    industrial_production: { label: 'Industrial Production', category: 'Producción', unit: '%' },
  }

  return metadata[key] || { label: key, category: 'Otros' }
}

/**
 * Derive trend from driver direction
 */
function getTrendFromDirection(direction: 'long' | 'short' | 'neutral'): 'Mejora' | 'Empeora' | 'Estable' | null {
  switch (direction) {
    case 'long':
      return 'Mejora'
    case 'short':
      return 'Empeora'
    default:
      return 'Estable'
  }
}

/**
 * Derive posture from driver direction and weight
 */
function getPostureFromDriver(driver: { direction: 'long' | 'short' | 'neutral'; weight: number }): 'Hawkish' | 'Dovish' | 'Neutral' {
  if (driver.weight < 0.1) return 'Neutral'
  
  // Simplified: long = hawkish (fortalece moneda), short = dovish (debilita moneda)
  // This is a simplification - actual posture depends on the indicator type
  if (driver.direction === 'long') return 'Hawkish'
  if (driver.direction === 'short') return 'Dovish'
  return 'Neutral'
}

export default function IndicatorsTableCore({
  snapshot,
  className = '',
}: IndicatorsTableCoreProps) {
  // Get top drivers by weight (macro core indicators)
  const coreDrivers = [...snapshot.drivers]
    .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))
    .slice(0, 15) // Top 15 indicators

  if (coreDrivers.length === 0) {
    return (
      <section className={`rounded-lg border bg-card p-6 ${className}`}>
        <h2 className="text-lg font-semibold mb-3">Indicadores Macro Core</h2>
        <div className="text-sm text-muted-foreground">
          Sin indicadores disponibles
        </div>
      </section>
    )
  }

  return (
    <section className={`rounded-lg border bg-card p-6 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">Indicadores Macro Core</h2>
        <span className="text-xs text-muted-foreground">
          {coreDrivers.length} indicadores principales
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="px-3 py-2 text-left">Variable</th>
              <th className="px-3 py-2 text-left">Dirección</th>
              <th className="px-3 py-2 text-left">Evolución</th>
              <th className="px-3 py-2 text-left">Postura</th>
              <th className="px-3 py-2 text-left">Peso</th>
              <th className="px-3 py-2 text-left">Nota</th>
            </tr>
          </thead>
          <tbody>
            {coreDrivers.map((driver, idx) => {
              const metadata = getIndicatorMetadata(driver.key)
              const trend = getTrendFromDirection(driver.direction)
              const posture = getPostureFromDriver(driver)

              const trendBadge =
                trend === 'Mejora'
                  ? 'bg-green-600/10 dark:bg-green-500/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800'
                  : trend === 'Empeora'
                  ? 'bg-red-600/10 dark:bg-red-500/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
                  : 'bg-gray-500/10 dark:bg-gray-500/30 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700'

              const directionBadge =
                driver.direction === 'long'
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 border-green-300 dark:border-green-700'
                  : driver.direction === 'short'
                  ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 border-red-300 dark:border-red-700'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-700'

              return (
                <tr key={`${driver.key}-${idx}`} className="border-t">
                  <td className="px-4 py-2">
                    <div className="font-medium">{metadata.label}</div>
                    <div className="text-xs text-muted-foreground">{metadata.category}</div>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs border ${directionBadge}`}>
                      {driver.direction.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {trend ? (
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs ${trendBadge}`}>
                        {trend}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">{posture}</td>
                  <td className="px-3 py-2">
                    {driver.weight != null ? `${(driver.weight * 100).toFixed(0)}%` : '—'}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {driver.note || '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-3 text-xs text-muted-foreground">
        <p>
          Tabla reducida basada en drivers principales del snapshot macro.
          Para la tabla completa de indicadores, ver sección legacy (si está habilitada).
        </p>
      </div>
    </section>
  )
}

