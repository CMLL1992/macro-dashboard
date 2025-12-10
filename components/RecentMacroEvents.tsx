/**
 * Componente: Últimos eventos macro
 * 
 * Muestra los últimos eventos económicos relevantes con sorpresas e impacto
 */

'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

export type RecentEvent = {
  event_id: number
  release_id: number
  currency: string
  name: string
  category: string | null
  importance: 'low' | 'medium' | 'high' | null
  release_time_utc: string
  actual: number | null
  consensus: number | null
  previous: number | null
  surprise_raw: number | null
  surprise_pct: number | null
  surprise_score: number | null
  surprise_direction: 'positive' | 'negative' | null
  linked_series_id: string | null
  linked_indicator_key: string | null
  currency_score_before: number | null
  currency_score_after: number | null
  regime_before: string | null
  regime_after: string | null
}

type RecentMacroEventsProps = {
  events: RecentEvent[]
  biasUpdatedAt?: string | null
  lastEventAppliedAt?: string | null
}

const CURRENCY_COLORS: Record<string, string> = {
  USD: 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-800',
  EUR: 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-200 border-yellow-200 dark:border-yellow-800',
  GBP: 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800',
  JPY: 'bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-200 border-purple-200 dark:border-purple-800',
  AUD: 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200 border-green-200 dark:border-green-800',
}

const IMPORTANCE_COLORS: Record<string, string> = {
  high: 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 border-red-300 dark:border-red-800',
  medium: 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800',
  low: 'bg-muted text-muted-foreground border-border',
}

function formatValue(value: number | null, decimals: number = 2): string {
  if (value === null || value === undefined) return '—'
  return value.toFixed(decimals)
}

function formatSurpriseScore(score: number | null): string {
  if (score === null || score === undefined) return '—'
  const abs = Math.abs(score)
  if (abs > 0.7) return 'Muy fuerte'
  if (abs > 0.4) return 'Fuerte'
  if (abs > 0.2) return 'Moderada'
  return 'Ligera'
}

function getSurpriseColor(direction: 'positive' | 'negative' | null, score: number | null): string {
  if (!direction || score === null) return 'bg-muted text-muted-foreground'
  const abs = Math.abs(score)
  if (direction === 'positive') {
    return abs > 0.5 ? 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300' : 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400'
  } else {
    return abs > 0.5 ? 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300' : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400'
  }
}

export default function RecentMacroEvents({
  events,
  biasUpdatedAt,
  lastEventAppliedAt,
}: RecentMacroEventsProps) {
  if (!events || events.length === 0) {
    return null
  }

  // Mostrar solo los últimos 5-10 eventos más relevantes
  const displayEvents = events.slice(0, 10)

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Últimos eventos macro</CardTitle>
        <CardDescription>
          Eventos económicos recientes con sorpresas e impacto en sesgos macro
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {displayEvents.map((event) => {
          const timeAgo = formatDistanceToNow(new Date(event.release_time_utc), {
            addSuffix: true,
            locale: es,
          })

          const isUpdated =
            biasUpdatedAt &&
            new Date(biasUpdatedAt) >= new Date(event.release_time_utc)

          const scoreChange =
            event.currency_score_before !== null &&
            event.currency_score_after !== null
              ? event.currency_score_after - event.currency_score_before
              : null

          const regimeChanged =
            event.regime_before && event.regime_after && event.regime_before !== event.regime_after

          return (
            <div
              key={event.release_id}
              className="border rounded-lg p-4 bg-card hover:bg-muted/50 transition-colors"
            >
              {/* Header: Currency + Name + Importance */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge
                    className={cn(
                      'text-xs font-semibold',
                      CURRENCY_COLORS[event.currency] || 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200'
                    )}
                  >
                    {event.currency}
                  </Badge>
                  <span className="font-semibold text-sm">{event.name}</span>
                  {event.importance && (
                    <Badge
                      variant="outline"
                      className={cn('text-xs', IMPORTANCE_COLORS[event.importance])}
                    >
                      {event.importance === 'high'
                        ? 'Alta'
                        : event.importance === 'medium'
                        ? 'Media'
                        : 'Baja'}
                    </Badge>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">{timeAgo}</span>
              </div>

              {/* Actual vs Consensus */}
              {event.actual !== null && event.consensus !== null && (
                <div className="mb-2 text-sm">
                  <span className="text-muted-foreground">Actual: </span>
                  <span className="font-semibold">{formatValue(event.actual)}</span>
                  <span className="text-muted-foreground/70 mx-2">vs</span>
                  <span className="text-muted-foreground">Consenso: </span>
                  <span className="font-medium">{formatValue(event.consensus)}</span>
                  {event.surprise_raw !== null && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      (Δ {event.surprise_raw > 0 ? '+' : ''}
                      {formatValue(event.surprise_raw)})
                    </span>
                  )}
                </div>
              )}

              {/* Surprise */}
              {event.surprise_direction && event.surprise_score !== null && (
                <div className="mb-2 flex items-center gap-2">
                  <Badge
                    className={cn(
                      'text-xs font-medium',
                      getSurpriseColor(event.surprise_direction, event.surprise_score)
                    )}
                  >
                    Sorpresa{' '}
                    {event.surprise_direction === 'positive' ? 'POSITIVA' : 'NEGATIVA'}{' '}
                    ({formatSurpriseScore(event.surprise_score)})
                  </Badge>
                  {event.surprise_score !== null && (
                    <span className="text-xs text-foreground">
                      Score: {formatValue(event.surprise_score, 2)}
                    </span>
                  )}
                </div>
              )}

              {/* Impact */}
              {(scoreChange !== null || regimeChanged) && (
                <div className="mt-2 pt-2 border-t border-border text-xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-foreground">Impacto:</span>
                    {scoreChange !== null && (
                      <span className="font-medium">
                        {event.currency} totalScore{' '}
                        {event.currency_score_before !== null
                          ? formatValue(event.currency_score_before, 2)
                          : '—'}{' '}
                        →{' '}
                        {event.currency_score_after !== null
                          ? formatValue(event.currency_score_after, 2)
                          : '—'}
                        {scoreChange !== 0 && (
                          <span
                            className={cn(
                              'ml-1',
                              scoreChange > 0 ? 'text-green-600' : 'text-red-600'
                            )}
                          >
                            ({scoreChange > 0 ? '+' : ''}
                            {formatValue(scoreChange, 2)})
                          </span>
                        )}
                      </span>
                    )}
                    {regimeChanged && (
                      <span className="text-foreground">
                        | Régimen: {event.regime_before} → {event.regime_after}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Update Status */}
              <div className="mt-2 pt-2 border-t border-border flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs">
                  {isUpdated ? (
                    <>
                      <span className="text-green-600 dark:text-green-400">✓</span>
                      <span className="text-muted-foreground">Sesgos actualizados</span>
                    </>
                  ) : (
                    <>
                      <span className="text-amber-600 dark:text-amber-400">⚠</span>
                      <span className="text-muted-foreground">Sesgos sin actualizar</span>
                    </>
                  )}
                </div>
                {event.linked_series_id && (
                  <span className="text-xs text-muted-foreground/70 font-mono">
                    {event.linked_series_id}
                  </span>
                )}
              </div>
            </div>
          )
        })}

        {/* Meta info */}
        {(biasUpdatedAt || lastEventAppliedAt) && (
          <div className="mt-4 pt-3 border-t border-border text-xs text-muted-foreground space-y-1">
            {biasUpdatedAt && (
              <div>
                Último cálculo de bias:{' '}
                <span className="font-medium">
                  {new Date(biasUpdatedAt).toLocaleString('es-ES', {
                    timeZone: 'Europe/Madrid',
                  })}
                </span>
              </div>
            )}
            {lastEventAppliedAt && (
              <div>
                Último evento aplicado:{' '}
                <span className="font-medium">
                  {new Date(lastEventAppliedAt).toLocaleString('es-ES', {
                    timeZone: 'Europe/Madrid',
                  })}
                </span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

