'use client'

import { useMemo, useState } from 'react'
import { getAssetCategorySafe } from '@/lib/assets'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

// Allowlist defensiva: solo estos símbolos pueden aparecer en el dashboard
// Esta es la última línea de defensa en caso de que el backend no filtre correctamente
// IMPORTANT: Actualizado para reflejar la whitelist de Forex (12 pares) + otros activos permitidos
const ALLOWED_SYMBOLS = new Set([
  // Crypto
  'BTCUSD', 'ETHUSD',
  // Forex - Majors (7)
  'EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'NZDUSD', 'USDCAD',
  // Forex - Crosses (5)
  'EURGBP', 'EURJPY', 'GBPJPY', 'EURCHF', 'AUDJPY',
  // Indices
  'SPX', 'NDX',
  // Commodities/Metals
  'XAUUSD',
])

// Normalizar símbolo para comparación (uppercase, sin slashes)
function normalizeSymbol(symbol: string | null | undefined): string {
  if (!symbol) return ''
  return symbol.toUpperCase().replace('/', '').replace('-', '')
}

// Verificar si un símbolo está permitido
function isAllowedSymbol(symbol: string | null | undefined): boolean {
  const normalized = normalizeSymbol(symbol)
  return ALLOWED_SYMBOLS.has(normalized)
}

type TacticalRow = {
  pair: string
  trend: string
  action: string
  confidence: string
  corr12m?: number | null
  corr3m?: number | null
  last_relevant_event?: {
    currency: string
    name: string
    surprise_direction: string
    surprise_score: number
    release_time_utc: string
  } | null
  updated_after_last_event?: boolean
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
      .filter((row) => {
        // Filtro defensivo: solo mostrar símbolos permitidos
        const symbol = normalizeSymbol(row.pair)
        if (!isAllowedSymbol(symbol)) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('[TacticalTablesClient] Filtered out non-allowed symbol:', row.pair, '→ normalized:', symbol)
          }
          return false
        }
        return true
      })
      .map((row) => {
        const category = getAssetCategorySafe(row.pair)
        return { ...row, category }
      })
      .filter((row) => row.category)
  }, [rows])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return rowsWithCategory
    return rowsWithCategory.filter(
      (row) =>
        (row.pair || '').toLowerCase().includes(term) ||
        (row.action || '').toLowerCase().includes(term) ||
        (row.trend || '').toLowerCase().includes(term)
    )
  }, [rowsWithCategory, search])

  // Forex Majors (7 pares principales)
  const FOREX_MAJORS = new Set([
    'EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'USDCAD', 'NZDUSD'
  ])
  
  // Forex Crosses (5 pares cruzados)
  const FOREX_CROSSES = new Set([
    'EURGBP', 'EURJPY', 'GBPJPY', 'EURCHF', 'AUDJPY'
  ])
  
  // Función para normalizar símbolo de par
  const normalizePairSymbol = (pair: string | null | undefined): string => {
    if (!pair) return ''
    return pair.toUpperCase().replace('/', '').replace('-', '')
  }
  
  // Función para verificar si es un Major
  const isForexMajor = (pair: string): boolean => {
    return FOREX_MAJORS.has(normalizePairSymbol(pair))
  }
  
  // Función para verificar si es un Cross
  const isForexCross = (pair: string): boolean => {
    return FOREX_CROSSES.has(normalizePairSymbol(pair))
  }

  const byCategory = useMemo(() => {
    const groups: Record<string, TacticalRow[]> = {}
    for (const row of filtered) {
      const cat = (row as any).category as string
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(row)
    }
    
    // Para forex, ordenar: primero Majors, luego Crosses
    if (groups['forex']) {
      const forexRows = groups['forex']
      
      // Separar en Majors y Crosses
      const majors: TacticalRow[] = []
      const crosses: TacticalRow[] = []
      const others: TacticalRow[] = []
      
      for (const row of forexRows) {
        if (isForexMajor(row.pair)) {
          majors.push(row)
        } else if (isForexCross(row.pair)) {
          crosses.push(row)
        } else {
          others.push(row)
        }
      }
      
      // Ordenar Majors según el orden definido
      const majorsOrder = ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'USDCAD', 'NZDUSD']
      majors.sort((a, b) => {
        const aNorm = normalizePairSymbol(a.pair)
        const bNorm = normalizePairSymbol(b.pair)
        const aIndex = majorsOrder.indexOf(aNorm)
        const bIndex = majorsOrder.indexOf(bNorm)
        if (aIndex === -1 && bIndex === -1) return 0
        if (aIndex === -1) return 1
        if (bIndex === -1) return -1
        return aIndex - bIndex
      })
      
      // Ordenar Crosses según el orden definido
      const crossesOrder = ['EURGBP', 'EURJPY', 'GBPJPY', 'EURCHF', 'AUDJPY']
      crosses.sort((a, b) => {
        const aNorm = normalizePairSymbol(a.pair)
        const bNorm = normalizePairSymbol(b.pair)
        const aIndex = crossesOrder.indexOf(aNorm)
        const bIndex = crossesOrder.indexOf(bNorm)
        if (aIndex === -1 && bIndex === -1) return 0
        if (aIndex === -1) return 1
        if (bIndex === -1) return -1
        return aIndex - bIndex
      })
      
      // Combinar: primero Majors, luego Crosses, luego otros
      groups['forex'] = [...majors, ...crosses, ...others]
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
    <section className="rounded-lg border bg-card p-6 space-y-6">
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

        // Para Forex, mostrar subtítulos de Majors y Crosses
        const forexMajorsCount = cat === 'forex' ? rowsCat.filter(r => isForexMajor(r.pair)).length : 0
        const forexCrossesCount = cat === 'forex' ? rowsCat.filter(r => isForexCross(r.pair)).length : 0
        
        return (
          <details key={cat} className="rounded-md border bg-muted/30" open>
            <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm font-medium">
              <span>
                {categoryLabel(cat)}
                {cat === 'forex' && forexMajorsCount > 0 && forexCrossesCount > 0 && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    ({forexMajorsCount} mayores, {forexCrossesCount} cruzados)
                  </span>
                )}
              </span>
              <span className="text-xs text-muted-foreground">
                {rowsCat.length} activos
              </span>
            </summary>
            <div className="border-t bg-card">
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
                  {rowsCat.flatMap((row, index) => {
                    const confidence = (row.confidence || '').toLowerCase()
                    const isHighConfidence = confidence === 'alta' || confidence === 'high'
                    const isMediumConfidence = confidence === 'media' || confidence === 'medium'
                    
                    // Solo remarcar si tiene acción clara (no "Rango/táctico")
                    const action = (row.action || '').toLowerCase()
                    const hasClearAction = action.includes('compr') || action.includes('venta') || action.includes('buy') || action.includes('sell')
                    const shouldHighlight = hasClearAction && (isHighConfidence || isMediumConfidence)
                    
                    // Para Forex: mostrar separador entre Majors y Crosses
                    let showSeparator = false
                    if (cat === 'forex' && index > 0) {
                      const currentIsMajor = isForexMajor(row.pair)
                      const prevIsMajor = isForexMajor(rowsCat[index - 1].pair)
                      const currentIsCross = isForexCross(row.pair)
                      const prevIsCross = isForexCross(rowsCat[index - 1].pair)
                      
                      // Separador cuando pasamos de Majors a Crosses
                      if (prevIsMajor && currentIsCross) {
                        showSeparator = true
                      }
                    }
                    
                    const elements = []
                    
                    if (showSeparator) {
                      elements.push(
                        <tr key={`separator-${row.pair}`} className="border-t-2 border-border">
                          <td colSpan={6} className="px-4 py-2 bg-muted/50">
                            <span className="text-xs font-medium text-muted-foreground">Pares cruzados</span>
                          </td>
                        </tr>
                      )
                    }
                    
                    const lastEvent = row.last_relevant_event
                    const isUpdated = row.updated_after_last_event
                    const timeAgo = lastEvent
                      ? formatDistanceToNow(new Date(lastEvent.release_time_utc), {
                          addSuffix: true,
                          locale: es,
                        })
                      : null

                    elements.push(
                      <tr 
                        key={row.pair} 
                        className={cn(
                          'border-t',
                          // Verde: Confianza Alta con acción clara
                          isHighConfidence && hasClearAction && 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800',
                          // Azul: Confianza Media con acción clara
                          isMediumConfidence && hasClearAction && !isHighConfidence && 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800'
                        )}
                      >
                        <td className={cn(
                          'px-4 py-2',
                          isHighConfidence && hasClearAction && 'font-semibold',
                          isMediumConfidence && hasClearAction && !isHighConfidence && 'font-medium'
                        )}>
                          {row.pair}
                        </td>
                        <td className="px-4 py-2">{row.trend}</td>
                        <td className="px-4 py-2">
                          <span
                            className={
                              (row.action || '').toLowerCase().includes('compr')
                                ? 'text-green-600 dark:text-green-400'
                                : (row.action || '').toLowerCase().includes('venta')
                                  ? 'text-red-600 dark:text-red-400'
                                  : ''
                            }
                          >
                            {row.action}
                          </span>
                        </td>
                        <td className={cn(
                          'px-4 py-2',
                          isHighConfidence && hasClearAction && 'font-semibold text-emerald-700 dark:text-emerald-400',
                          isMediumConfidence && hasClearAction && !isHighConfidence && 'font-medium text-blue-700 dark:text-blue-400'
                        )}>
                          {row.confidence}
                        </td>
                        <td className="px-4 py-2 text-right">
                          {formatCorr(row.corr12m as any)}
                        </td>
                        <td className="px-4 py-2 text-right">
                          {formatCorr(row.corr3m as any)}
                        </td>
                      </tr>
                    )
                    
                    if (lastEvent) {
                      elements.push(
                        <tr key={`${row.pair}-event`} className="border-t bg-muted/50">
                          <td colSpan={6} className="px-4 py-2 text-xs text-foreground">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium">Último evento relevante:</span>
                              <span className="font-mono text-foreground">
                                [{lastEvent.currency}] {lastEvent.name}
                              </span>
                              <span
                                className={cn(
                                  'px-1.5 py-0.5 rounded text-xs font-medium',
                                  lastEvent.surprise_direction === 'positive'
                                    ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300'
                                    : lastEvent.surprise_direction === 'negative'
                                    ? 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300'
                                    : 'bg-muted text-muted-foreground'
                                )}
                              >
                                Sorpresa{' '}
                                {lastEvent.surprise_direction === 'positive'
                                  ? 'POSITIVA'
                                  : lastEvent.surprise_direction === 'negative'
                                  ? 'NEGATIVA'
                                  : 'NEUTRAL'}{' '}
                                (score: {lastEvent.surprise_score.toFixed(2)})
                              </span>
                              {timeAgo && <span className="text-muted-foreground">· {timeAgo}</span>}
                              {isUpdated ? (
                                <span className="text-green-600 font-medium">
                                  · Sesgo actualizado ✓
                                </span>
                              ) : (
                                <span className="text-amber-600 font-medium">
                                  · Sesgo SIN actualizar ⚠
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    }
                    
                    return elements
                  })}
                </tbody>
              </table>
            </div>
          </details>
        )
      })}
    </section>
  )
}

