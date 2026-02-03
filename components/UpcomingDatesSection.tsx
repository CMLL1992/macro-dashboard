/**
 * Upcoming Dates Section Component
 * 
 * Muestra eventos próximos del snapshot, agrupados por:
 * - Next 4h (no-trade window)
 * - Hoy
 * - Próximos 7 días
 */

import React from 'react'
import type { UpcomingDate } from '@/domain/macro-snapshot/schema'
import { formatDistanceToNow, format, isToday, isTomorrow, addDays, isBefore, addHours } from 'date-fns'
import { es } from 'date-fns/locale'

interface UpcomingDatesSectionProps {
  upcomingDates: UpcomingDate[]
  nowTs: string
  requestId?: string
  className?: string
}

export default function UpcomingDatesSection({
  upcomingDates,
  nowTs,
  requestId,
  className = '',
}: UpcomingDatesSectionProps) {
  const now = new Date(nowTs)
  const next4h = addHours(now, 4)
  const next7Days = addDays(now, 7)

  // Group dates
  const next4hEvents: UpcomingDate[] = []
  const todayEvents: UpcomingDate[] = []
  const next7DaysEvents: UpcomingDate[] = []
  const laterEvents: UpcomingDate[] = []

  upcomingDates.forEach((date) => {
    const eventDate = new Date(date.date)
    
    if (isBefore(eventDate, next4h)) {
      next4hEvents.push(date)
    } else if (isToday(eventDate)) {
      todayEvents.push(date)
    } else if (isBefore(eventDate, next7Days)) {
      next7DaysEvents.push(date)
    } else {
      laterEvents.push(date)
    }
  })

  const getImportanceColor = (importance: UpcomingDate['importance']) => {
    switch (importance) {
      case 'high':
        return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 border-red-300 dark:border-red-700'
      case 'medium':
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 border-yellow-300 dark:border-yellow-700'
      default:
        return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-700'
    }
  }

  const getImportanceLabel = (importance: UpcomingDate['importance']) => {
    switch (importance) {
      case 'high':
        return 'Alta'
      case 'medium':
        return 'Media'
      default:
        return 'Baja'
    }
  }

  if (upcomingDates.length === 0) {
    return (
      <section className={`rounded-lg border bg-card p-6 ${className}`}>
        <h2 className="text-lg font-semibold mb-3">Calendario de Eventos</h2>
        <div className="text-sm text-muted-foreground">
          Calendario no disponible
          {requestId && (
            <span className="ml-2 text-xs font-mono">(ID: {requestId.substring(0, 8)}...)</span>
          )}
        </div>
      </section>
    )
  }

  const renderEventGroup = (title: string, events: UpcomingDate[], highlight: boolean = false) => {
    if (events.length === 0) return null

    return (
      <div className={highlight ? 'mb-4' : 'mb-3'}>
        <h3 className={`text-sm font-semibold mb-2 ${highlight ? 'text-red-700 dark:text-red-300' : 'text-foreground'}`}>
          {title} ({events.length})
        </h3>
        <div className="space-y-2">
          {events.map((event, idx) => {
            const eventDate = new Date(event.date)
            const timeUntil = formatDistanceToNow(eventDate, { addSuffix: true, locale: es })

            return (
              <div
                key={`${event.name}-${event.date}-${idx}`}
                className={`rounded-lg border p-3 ${highlight ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800' : 'bg-muted/50'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-semibold text-sm">{event.name}</span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded border ${getImportanceColor(event.importance)}`}
                      >
                        {getImportanceLabel(event.importance)}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <div>
                        <strong>Fecha:</strong> {format(eventDate, 'PPpp', { locale: es })}
                      </div>
                      <div>
                        <strong>En:</strong> {timeUntil}
                      </div>
                      {event.country && (
                        <div>
                          <strong>País:</strong> {event.country}
                        </div>
                      )}
                      {event.currency && (
                        <div>
                          <strong>Moneda:</strong> {event.currency}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <section className={`rounded-lg border bg-card p-6 ${className}`}>
      <h2 className="text-lg font-semibold mb-4">Calendario de Eventos</h2>

      {next4hEvents.length > 0 && (
        <div className="mb-4 p-3 rounded-lg border-2 border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/20">
          <div className="flex items-center gap-2 mb-2">
            <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse"></span>
            <span className="font-semibold text-red-800 dark:text-red-200">
              ⚠️ No Trade Window - Eventos en las próximas 4 horas
            </span>
          </div>
          {renderEventGroup('Próximas 4 horas', next4hEvents, true)}
        </div>
      )}

      {renderEventGroup('Hoy', todayEvents)}
      {renderEventGroup('Próximos 7 días', next7DaysEvents)}
      {laterEvents.length > 0 && (
        <details className="mt-3">
          <summary className="text-sm text-muted-foreground cursor-pointer">
            Más adelante ({laterEvents.length} eventos)
          </summary>
          <div className="mt-2 space-y-2">
            {laterEvents.map((event, idx) => {
              const eventDate = new Date(event.date)
              return (
                <div
                  key={`${event.name}-${event.date}-${idx}`}
                  className="rounded-lg border p-2 bg-muted/50 text-xs"
                >
                  <div className="font-semibold">{event.name}</div>
                  <div className="text-muted-foreground">
                    {format(eventDate, 'PP', { locale: es })}
                    {event.importance === 'high' && (
                      <span className="ml-2 px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 text-[10px]">
                        Alta
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </details>
      )}
    </section>
  )
}

