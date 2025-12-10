'use client'

import { useState, useEffect, useMemo } from 'react'
import { CalendarFilters } from '@/components/CalendarFilters'
import { MAIN_REGIONS, REGION_NAMES, getRegionCode, type RegionCode } from '@/config/calendar-countries'
import type { CalendarEventResponse } from '@/app/api/calendar/route'

interface CalendarClientProps {
  initialEvents: CalendarEventResponse[]
}

export function CalendarClient({ initialEvents }: CalendarClientProps) {
  const [events, setEvents] = useState<CalendarEventResponse[]>(initialEvents)
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState<{
    range: 'today' | '7d' | '30d'
    regions: RegionCode[]
    impacts: ('low' | 'medium' | 'high')[]
    query: string
  }>({
    range: '7d',
    regions: MAIN_REGIONS,
    impacts: ['high', 'medium'],
    query: '',
  })

  // Calcular fechas según el rango
  const { from, to } = useMemo(() => {
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    
    let endDate = new Date(now)
    if (filters.range === 'today') {
      endDate.setHours(23, 59, 59, 999)
    } else if (filters.range === '7d') {
      endDate.setDate(now.getDate() + 7)
      endDate.setHours(23, 59, 59, 999)
    } else {
      endDate.setDate(now.getDate() + 30)
      endDate.setHours(23, 59, 59, 999)
    }
    
    return {
      from: now.toISOString().split('T')[0],
      to: endDate.toISOString().split('T')[0],
    }
  }, [filters.range])

  // Fetch eventos cuando cambian los filtros
  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams({
          from,
          to,
          region: filters.regions.join(','),
          impact: filters.impacts.join(','),
        })
        if (filters.query) {
          params.set('query', filters.query)
        }
        
        const response = await fetch(`/api/calendar?${params.toString()}`)
        if (!response.ok) throw new Error('Failed to fetch events')
        
        const data = await response.json()
        setEvents(data.events || [])
      } catch (error) {
        console.error('[CalendarClient] Error fetching events:', error)
      } finally {
        setLoading(false)
      }
    }
    
    fetchEvents()
  }, [from, to, filters.regions, filters.impacts, filters.query])

  // Agrupar eventos por fecha
  const eventsByDate = useMemo(() => {
    const grouped = new Map<string, CalendarEventResponse[]>()
    for (const event of events) {
      const date = event.dateTimeUtc.split('T')[0]
      if (!grouped.has(date)) {
        grouped.set(date, [])
      }
      grouped.get(date)!.push(event)
    }
    return grouped
  }, [events])

  const sortedDates = Array.from(eventsByDate.keys()).sort()

  const getImportanceColor = (importance: string | null): string => {
    switch (importance) {
      case 'high':
        return 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300 border-red-300 dark:border-red-800'
      case 'medium':
        return 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-300 border-yellow-300 dark:border-yellow-800'
      case 'low':
        return 'bg-muted text-muted-foreground border-border'
      default:
        return 'bg-muted text-muted-foreground border-border'
    }
  }

  const getImportanceLabel = (importance: string | null): string => {
    switch (importance) {
      case 'high':
        return 'Alta'
      case 'medium':
        return 'Media'
      case 'low':
        return 'Baja'
      default:
        return 'N/A'
    }
  }

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr)
    return date.toLocaleString('es-ES', {
      timeZone: 'Europe/Madrid',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <>
      {/* Filtros */}
      <CalendarFilters onFiltersChange={setFilters} />

      {/* Próximos Eventos */}
      <section className="rounded-lg border bg-card p-6">
        <h2 className="text-2xl font-semibold mb-4">
          Próximos eventos ({loading ? '...' : events.length})
        </h2>
        
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>Cargando eventos...</p>
          </div>
        ) : sortedDates.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-lg mb-2">No hay eventos programados</p>
            <p className="text-sm">
              Los eventos se actualizan automáticamente mediante el job de calendario.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {sortedDates.map(date => {
              const dayEvents = eventsByDate.get(date)!
              const dateObj = new Date(date)
              const isToday = date === new Date().toISOString().split('T')[0]
              
              return (
                <div key={date} className="border rounded-lg p-4">
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    {isToday && <span className="text-blue-600">📅 Hoy</span>}
                    {!isToday && (
                      <span>
                        {dateObj.toLocaleDateString('es-ES', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </span>
                    )}
                    <span className="text-sm font-normal text-muted-foreground">
                      ({dayEvents.length} {dayEvents.length === 1 ? 'evento' : 'eventos'})
                    </span>
                  </h3>
                  
                  <div className="space-y-3">
                    {dayEvents.map(event => (
                      <div
                        key={event.id}
                        className="border rounded-lg p-4 hover:bg-muted transition-colors"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <span className="font-semibold text-lg">{event.title}</span>
                              <span className={`px-2 py-0.5 rounded text-xs border ${getImportanceColor(event.importance)}`}>
                                {getImportanceLabel(event.importance)}
                              </span>
                              <span className="text-sm text-muted-foreground">
                                {event.currency} • {event.country}
                              </span>
                              {(() => {
                                const regionCode = event.region || getRegionCode(event.country) || null
                                if (!regionCode) return null
                                return (
                                  <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
                                    {REGION_NAMES[regionCode as RegionCode] ?? regionCode}
                                  </span>
                                )
                              })()}
                            </div>
                            
                            <div className="text-sm text-muted-foreground space-y-1">
                              <div>
                                <strong>Hora:</strong>{' '}
                                {formatDate(event.dateTimeUtc)}
                                {event.localTime && (
                                  <span className="ml-2 text-muted-foreground/70">
                                    ({event.localTime})
                                  </span>
                                )}
                              </div>
                              
                              {event.category && (
                                <div>
                                  <strong>Categoría:</strong> {event.category}
                                </div>
                              )}
                              
                              {event.forecast && (
                                <div>
                                  <strong>Consenso:</strong> {event.forecast}
                                  {event.previous && (
                                    <span className="ml-2">
                                      (Anterior: {event.previous})
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </>
  )
}
