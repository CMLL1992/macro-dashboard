'use client'

import { useMemo, useState } from 'react'
import { ASSET_CATEGORIES } from '@/lib/assets'

type TacticalRow = {
  pair: string
  trend: string
  action: string
  confidence: string
  corr12m?: number | null
  corr3m?: number | null
}

type Props = {
  rows: TacticalRow[]
}

function formatCorr(value: number | null | undefined) {
  if (value === null || value === undefined) return '—'
  return value.toFixed(2)
}

function categoryLabel(cat: 'forex' | 'crypto' | 'metal' | 'index') {
  switch (cat) {
    case 'forex':
      return 'Forex – Pares principales'
    case 'metal':
      return 'Metales'
    case 'crypto':
      return 'Criptomonedas'
    case 'index':
      return 'Índices'
  }
}

export default function TacticalTablesClient({ rows }: Props) {
  const [search, setSearch] = useState('')

  const rowsWithCategory = useMemo(() => {
    return rows
      .map((row) => {
        const symbol = row.pair.replace('/', '').toUpperCase()
        const category = ASSET_CATEGORIES[symbol]
        return { ...row, category }
      })
      .filter((row) => row.category)
  }, [rows])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return rowsWithCategory
    return rowsWithCategory.filter(
      (row) =>
        row.pair.toLowerCase().includes(term) ||
        row.action.toLowerCase().includes(term) ||
        row.trend.toLowerCase().includes(term)
    )
  }, [rowsWithCategory, search])

  const byCategory = useMemo(() => {
    const groups: Record<string, TacticalRow[]> = {}
    for (const row of filtered) {
      const cat = (row as any).category as string
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(row)
    }
    return groups
  }, [filtered])

  const orderedCategories: Array<'forex' | 'metal' | 'crypto' | 'index'> = [
    'forex',
    'metal',
    'crypto',
    'index',
  ]

  const hasAny = filtered.length > 0

  return (
    <section className="rounded-lg border bg-white p-6 space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h2 className="text-lg font-semibold">Vista rápida de pares tácticos</h2>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar activo (por ejemplo: EUR/USD, BTC, SPX...)"
            className="w-full md:w-80 rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {!hasAny && (
        <p className="text-sm text-muted-foreground">
          No hay activos que coincidan con el filtro.
        </p>
      )}

      {orderedCategories.map((cat) => {
        const rowsCat = byCategory[cat]
        if (!rowsCat || rowsCat.length === 0) return null

        return (
          <details key={cat} className="rounded-md border bg-muted/30" open>
            <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm font-medium">
              <span>{categoryLabel(cat)}</span>
              <span className="text-xs text-muted-foreground">
                {rowsCat.length} activos
              </span>
            </summary>
            <div className="border-t bg-white">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-muted/40">
                    <th className="px-4 py-2 text-left font-medium">Par</th>
                    <th className="px-4 py-2 text-left font-medium">Tendencia</th>
                    <th className="px-4 py-2 text-left font-medium">Acción</th>
                    <th className="px-4 py-2 text-left font-medium">Confianza</th>
                    <th className="px-4 py-2 text-right font-medium">Corr. 12m (DXY)</th>
                    <th className="px-4 py-2 text-right font-medium">Corr. 3m (DXY)</th>
                  </tr>
                </thead>
                <tbody>
                  {rowsCat.map((row) => (
                    <tr key={row.pair} className="border-t">
                      <td className="px-4 py-2">{row.pair}</td>
                      <td className="px-4 py-2">{row.trend}</td>
                      <td className="px-4 py-2">
                        <span
                          className={
                            row.action.toLowerCase().includes('compr')
                              ? 'text-green-600'
                              : row.action.toLowerCase().includes('venta')
                                ? 'text-red-600'
                                : ''
                          }
                        >
                          {row.action}
                        </span>
                      </td>
                      <td className="px-4 py-2">{row.confidence}</td>
                      <td className="px-4 py-2 text-right">
                        {formatCorr(row.corr12m as any)}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {formatCorr(row.corr3m as any)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )
      })}
    </section>
  )
}

