/**
 * Macro Events (MVP)
 *
 * Fuente única: GET /api/events
 * Reglas:
 * - No calcular sorpresa (mostrar `surprise` del backend)
 * - No inferir señales
 * - No reordenar por lógica propia (solo segmentación + slicing manteniendo orden)
 */
 
'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type ApiEvent = {
  type: 'upcoming' | 'release'
  country: string
  currency: string
  indicator: string
  datetime: string
  previous: number | null
  forecast: number | null
  actual: number | null
  surprise: number | null
  impact: 'low' | 'medium' | 'high' | null
  hasNewPublication: boolean
}

type ApiEventsResponse =
  | {
      provider: 'TradingEconomics' | string
      status: 'ok'
      events: ApiEvent[]
    }
  | {
      provider: 'TradingEconomics' | string
      status: 'provider_unavailable' | string
      events: ApiEvent[]
    }

function fmtNumber(n: number | null): string {
  if (n === null || n === undefined) return '—'
  if (!Number.isFinite(n)) return '—'
  return String(n)
}

function fmtDateUtc(iso: string): string {
  // Mostrar tal cual en UTC (sin conversiones locales).
  // Si viene con milisegundos, mantenemos el string (ISO).
  return iso
}

export default function MacroEventsPanel() {
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<'ok' | 'provider_unavailable' | 'error'>('ok')
  const [events, setEvents] = useState<ApiEvent[]>([])

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/events', { cache: 'no-store' })
        const json = (await res.json()) as ApiEventsResponse

        if (cancelled) return

        const st = String((json as any)?.status || '')
        if (st !== 'ok') {
          setStatus('provider_unavailable')
          setEvents(Array.isArray((json as any)?.events) ? ((json as any).events as ApiEvent[]) : [])
          return
        }

        setStatus('ok')
        setEvents(Array.isArray((json as any)?.events) ? ((json as any).events as ApiEvent[]) : [])
      } catch {
        if (cancelled) return
        setStatus('provider_unavailable')
        setEvents([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [])

  const upcomingEvents = useMemo(() => {
    // El backend ya deduplica, ordena y limita (10).
    return events.filter((e) => e.type === 'upcoming')
  }, [events])

  const latestReleases = useMemo(() => {
    // El backend ya deduplica, ordena y limita (10).
    return events.filter((e) => e.type === 'release')
  }, [events])

  return (
    <div className="space-y-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">Macro Events</div>

      {loading && (
        <div className="rounded-lg border bg-muted/50 p-4 text-sm text-muted-foreground">
          Cargando eventos macroeconómicos…
        </div>
      )}

      {!loading && status !== 'ok' && (
        <div className="rounded-lg border bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800 p-4 text-sm">
          Macroeconomic data temporarily unavailable
        </div>
      )}

      {!loading && status === 'ok' && events.length === 0 && (
        <div className="rounded-lg border bg-muted/50 p-4 text-sm text-muted-foreground">
          No hay eventos disponibles en este momento.
        </div>
      )}

      {!loading && status === 'ok' && events.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Upcoming Events</CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingEvents.length === 0 ? (
                <div className="text-sm text-muted-foreground">Sin próximos eventos.</div>
              ) : (
                <div className="space-y-2">
                  {upcomingEvents.slice(0, 10).map((e, idx) => (
                    <div key={`${e.country}|${e.currency}|${e.indicator}|${e.datetime}|${idx}`} className="rounded-md border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-medium">{e.indicator}</div>
                        <div className="text-xs text-muted-foreground">{fmtDateUtc(e.datetime)} (UTC)</div>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {e.country} · {e.currency}
                        {e.impact ? ` · impact: ${e.impact}` : ''}
                      </div>
                      <div className="mt-2 text-sm">
                        <span className="text-muted-foreground">Forecast: </span>
                        <span className="font-medium">{fmtNumber(e.forecast)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Latest Releases</CardTitle>
            </CardHeader>
            <CardContent>
              {latestReleases.length === 0 ? (
                <div className="text-sm text-muted-foreground">Sin publicaciones recientes.</div>
              ) : (
                <div className="space-y-2">
                  {latestReleases.slice(0, 10).map((e, idx) => (
                    <div key={`${e.country}|${e.currency}|${e.indicator}|${e.datetime}|rel|${idx}`} className="rounded-md border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-medium">{e.indicator}</div>
                        <div className="text-xs text-muted-foreground">{fmtDateUtc(e.datetime)} (UTC)</div>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {e.country} · {e.currency}
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <div className="text-xs text-muted-foreground">Actual</div>
                          <div className="font-medium">{fmtNumber(e.actual)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Forecast</div>
                          <div className="font-medium">{fmtNumber(e.forecast)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Surprise</div>
                          <div className="font-medium">{fmtNumber(e.surprise)}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

