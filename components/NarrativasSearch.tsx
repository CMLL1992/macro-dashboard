'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { validateBiasRowFinal } from '@/lib/types/bias-final'
import { formatSignedTwoDecimals } from '@/lib/utils/format'
import { logger } from '@/lib/obs/logger'

type NarrativeRow = {
  par: string
  tactico: string
  accion: string
  confianza: string
  motivo: string
  corrRef: string
  corr12m: number | null
  corr3m: number | null
}

interface NarrativasSearchProps {
  rows: NarrativeRow[]
}

export function NarrativasSearch({ rows }: NarrativasSearchProps) {
  const [searchQuery, setSearchQuery] = useState('')

  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) {
      return rows
    }

    const query = searchQuery.toLowerCase().trim()
    return rows.filter((row) => {
      const par = row.par?.toLowerCase() || ''
      const accion = row.accion?.toLowerCase() || ''
      const tactico = row.tactico?.toLowerCase() || ''
      const confianza = row.confianza?.toLowerCase() || ''
      const motivo = row.motivo?.toLowerCase() || ''
      
      return (
        par.includes(query) ||
        accion.includes(query) ||
        tactico.includes(query) ||
        confianza.includes(query) ||
        motivo.includes(query)
      )
    })
  }, [rows, searchQuery])

  return (
    <div className="space-y-4">
      {/* Buscador */}
      <div className="relative mb-4">
        <input
          type="text"
          placeholder="🔍 Buscar por par (ej: EURUSD, XAUUSD, GBPUSD...)"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-10 py-3 text-base border border-input rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent shadow-sm"
        />
        <svg
          className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Limpiar búsqueda"
            type="button"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Contador de resultados */}
      {searchQuery && (
        <div className="text-sm text-muted-foreground mb-4">
          {filteredRows.length === 0 ? (
            <span className="text-red-600 dark:text-red-400 font-medium">
              ❌ No se encontraron narrativas que coincidan con "{searchQuery}"
            </span>
          ) : (
            <span className="font-medium">
              ✅ Mostrando {filteredRows.length} de {rows.length} narrativa{filteredRows.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}

      {/* Grid de narrativas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredRows.map((r) => {
          // Construir contrato final y validarlo (hardening)
          const contractInput = {
            symbol: r?.par,
            trend_final: r?.tactico === 'Neutral' ? 'Neutral' : r?.tactico,
            action_final: r?.accion,
            confidence_level: r?.confianza,
            motivo_macro: r?.motivo,
            corr_ref: r?.corrRef || 'DXY',
            corr_12m: r?.corr12m,
            corr_3m: r?.corr3m,
          }
          const validated = validateBiasRowFinal(contractInput)
          const isInvalid = !validated.ok
          if (isInvalid) {
            const meta: Record<string, unknown> = { symbol: r?.par, error: (validated as any).error }
            logger.warn('[Narrativas] BiasRowFinal inválido', meta)
          }

          // Datos ya validados (o fallback si inválido)
          const trend_final = validated.ok ? validated.data.trend_final : contractInput.trend_final
          const action_final = validated.ok ? validated.data.action_final : contractInput.action_final
          const confidence_level = validated.ok ? validated.data.confidence_level : contractInput.confidence_level
          const motivo_macro = validated.ok ? validated.data.motivo_macro : contractInput.motivo_macro
          const corr_ref = validated.ok ? validated.data.corr_ref : contractInput.corr_ref
          // Normalizar correlaciones: null -> 0, NaN -> 0
          const corr_12m_normalized = validated.ok 
            ? (validated.data.corr_12m ?? 0)
            : (contractInput.corr_12m != null && !Number.isNaN(contractInput.corr_12m) ? contractInput.corr_12m : 0)
          const corr_3m_normalized = validated.ok
            ? (validated.data.corr_3m ?? 0)
            : (contractInput.corr_3m != null && !Number.isNaN(contractInput.corr_3m) ? contractInput.corr_3m : 0)
          
          const corr_12m = corr_12m_normalized
          const corr_3m = corr_3m_normalized

          const trendBadge =
            trend_final === 'Alcista'
              ? 'bg-emerald-600/10 dark:bg-emerald-600/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
              : trend_final === 'Bajista'
              ? 'bg-rose-600/10 dark:bg-rose-600/20 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800'
              : 'bg-muted text-muted-foreground border-border' // Rango/Neutral

          const confBadge =
            confidence_level === 'Alta'
              ? 'bg-green-600/10 dark:bg-green-600/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800'
              : confidence_level === 'Media'
              ? 'bg-amber-600/10 dark:bg-amber-600/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800'
              : 'bg-gray-500/10 dark:bg-gray-500/30 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700'

          const symbol = r.par
          const href = `/narrativas/${symbol.replace('/', '')}` as const

          // Solo mostrar error si falta información crítica (symbol, trend, action, motivo)
          if (isInvalid && (!trend_final || !action_final || !motivo_macro || motivo_macro.length === 0)) {
            return (
              <div key={symbol} className="rounded-lg border bg-card p-4">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="font-semibold text-lg">{symbol}</h2>
                </div>
                <div className="text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded px-3 py-2">
                  Error: datos incompletos para Narrativas (revisar motor de sesgos).
                </div>
              </div>
            )
          }

          return (
            <Link
              key={symbol}
              href={href}
              className="rounded-lg border bg-card p-5 hover:border-primary hover:shadow-md transition-all block"
            >
              {/* Header con símbolo y badge */}
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-xl">{symbol}</h2>
                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium border ${trendBadge}`}>
                  {trend_final === 'Neutral' ? 'Rango' : trend_final}
                </span>
              </div>

              {/* Narrativa principal */}
              <div className="mb-4">
                <div className="text-sm font-medium text-foreground mb-2">Narrativa Macro:</div>
                <div className="text-sm text-foreground leading-relaxed whitespace-pre-line bg-muted/30 rounded p-3">
                  {motivo_macro}
                </div>
              </div>

              {/* Acción recomendada */}
              <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="text-xs text-blue-900 dark:text-blue-300 font-medium mb-1">Acción Recomendada:</div>
                <div className="text-sm font-semibold text-blue-900 dark:text-blue-200">{action_final}</div>
              </div>

              {/* Métricas */}
              <div className="space-y-2 border-t pt-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Confianza:</span>
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium border ${confBadge}`}>
                    {confidence_level}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Corr. 12m:</span>
                    <span className="ml-1 font-medium">{formatSignedTwoDecimals(corr_12m)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Corr. 3m:</span>
                    <span className="ml-1 font-medium">{formatSignedTwoDecimals(corr_3m)}</span>
                  </div>
                </div>
                
                <div className="text-xs text-muted-foreground">
                  Referencia: {corr_ref}
                </div>
              </div>

              {/* Link para más detalles */}
              <div className="mt-4 pt-3 border-t text-xs text-primary text-center">
                Ver análisis detallado →
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

