"use client"

import { useState, useMemo } from 'react'
import { getAssetCategorySafe } from '@/lib/assets'
import InfoTooltip from '@/components/InfoTooltip'
import { CorrelationsFilter } from './CorrelationsFilter'
import { safeArray } from '@/lib/utils/guards'

type Category = 'all' | 'forex' | 'index' | 'commodity' | 'crypto'

interface CorrelationRow {
  key: string
  symbol: string
  label: string
  value: number | undefined
  trend: string
  strongestWindow: string | null
  corrWindow: string | null
  intensity: string
  relevancePct: number | null
  category: string
  baseCurrency: string | null
}

interface CorrelationsTableProps {
  rows: CorrelationRow[]
  benchmark: string
}

export function CorrelationsTable({ rows, benchmark }: CorrelationsTableProps) {
  const [activeCategory, setActiveCategory] = useState<Category>('all')

  // FIX 5.3: Validar rows antes de filter con tipo explícito
  const rowsSafe = safeArray<CorrelationRow>(rows)

  // Mapeo de categorías de asset a categorías del filtro
  const categoryMap: Record<string, Category> = {
    forex: 'forex',
    index: 'index',
    metal: 'commodity',
    commodity: 'commodity',
    crypto: 'crypto',
  }

  // Filtrar filas según categoría activa
  const filteredRows = useMemo(() => {
    if (activeCategory === 'all') return rowsSafe
    
    return rowsSafe.filter((row) => {
      // FIX 5.3: Validar row.symbol antes de usar
      if (!row || typeof row.symbol !== 'string') return false
      const assetCategory = getAssetCategorySafe(row.symbol)
      const mappedCategory = categoryMap[assetCategory] || 'all'
      return mappedCategory === activeCategory
    })
  }, [rowsSafe, activeCategory])

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <h2 className="text-lg font-medium flex items-center gap-2">
          Tabla de correlaciones
          <InfoTooltip text="Correlación de Pearson entre rendimientos diarios del activo y DXY. Tendencia: Strengthening (fortaleciendo), Weakening (debilitando), Stable (estable)." />
        </h2>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>Rango -1 (inversa) · 0 (sin relación) · +1 (directa)</span>
          <span className="hidden sm:inline">/ Ventana, tendencia, intensidad y relevancia macro</span>
        </div>
      </div>

      {/* Filtro por categoría */}
      <CorrelationsFilter 
        onFilterChange={setActiveCategory} 
        activeCategory={activeCategory}
      />

      <div className="overflow-x-auto rounded-md border bg-card">
        <table className="min-w-full text-sm">
          <thead className="border-b bg-muted/40 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Par vs {benchmark}</th>
              <th className="px-4 py-2 font-medium">Ventana corr.</th>
              <th className="px-4 py-2 font-medium">Ventana más fuerte</th>
              <th className="px-4 py-2 font-medium flex items-center gap-1">
                Tendencia
                <InfoTooltip text="Strengthening: correlación se fortalece. Weakening: se debilita. Stable: se mantiene estable." />
              </th>
              <th className="px-4 py-2 font-medium">Intensidad</th>
              <th className="px-4 py-2 font-medium flex items-center gap-1">
                Relevancia macro
                <InfoTooltip text="Indica qué tan útil es esta correlación para entender el comportamiento del par frente al DXY (0-100%)." />
              </th>
              <th className="px-4 py-2 text-right font-medium">Correlación actual</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No hay correlaciones disponibles para esta categoría.
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => (
                <tr key={row.key} className="border-b last:border-0">
                  <td className="px-4 py-2">{row.label}</td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {row.corrWindow ? String(row.corrWindow) : "—"}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {row.strongestWindow ? String(row.strongestWindow) : "—"}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs"
                      style={{
                        borderColor:
                          row.trend === "Strengthening"
                            ? "rgba(16,185,129,0.6)"
                            : row.trend === "Weakening"
                            ? "rgba(248,113,113,0.6)"
                            : row.trend === "Stable"
                            ? "rgba(148,163,184,0.6)"
                            : "rgba(148,163,184,0.4)",
                        color:
                          row.trend === "Strengthening"
                            ? "rgb(16,185,129)"
                            : row.trend === "Weakening"
                            ? "rgb(248,113,113)"
                            : "rgb(148,163,184)",
                      }}
                    >
                      {row.trend}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs"
                      style={{
                        borderColor:
                          row.intensity === "Fuerte"
                            ? "rgba(16,185,129,0.6)"
                            : row.intensity === "Moderada"
                            ? "rgba(245,158,11,0.6)"
                            : "rgba(148,163,184,0.6)",
                        color:
                          row.intensity === "Fuerte"
                            ? "rgb(16,185,129)"
                            : row.intensity === "Moderada"
                            ? "rgb(245,158,11)"
                            : "rgb(148,163,184)",
                      }}
                    >
                      {row.intensity}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    {typeof row.relevancePct === "number" ? (
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${row.relevancePct}%` }}
                          />
                        </div>
                        <span className="tabular-nums text-xs text-muted-foreground">
                          {row.relevancePct}%
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right font-mono">
                    {typeof row.value === "number" && Number.isFinite(row.value)
                      ? row.value.toFixed(2)
                      : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
