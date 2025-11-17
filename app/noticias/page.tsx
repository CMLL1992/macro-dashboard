export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { getCalendarEvents } from '@/lib/notifications/weekly'
import { getIndicatorHistory } from '@/lib/db/read'
import { format, addDays, startOfWeek, endOfWeek, parseISO } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'
import { es } from 'date-fns/locale/es'

const TIMEZONE = process.env.TIMEZONE || 'Europe/Madrid'

// Mapeo de temas a claves de indicadores
const TEMA_TO_INDICATOR_KEY: Record<string, string> = {
  'NFP': 'NFP',
  'Non-Farm Payrolls': 'NFP',
  'CPI': 'CPI_YOY',
  'Consumer Price Index': 'CPI_YOY',
  'PPI': 'PPI_YOY',
  'Producer Price Index': 'PPI_YOY',
  'GDP': 'GDP_YOY',
  'Gross Domestic Product': 'GDP_YOY',
  'Fed Funds Rate': 'FEDFUNDS',
  'Interest Rate': 'FEDFUNDS',
  'Unemployment Rate': 'UNRATE',
  'PMI Manufacturing': 'PMI_MANUFACTURING',
  'PMI Services': 'PMI_SERVICES',
  'Retail Sales': 'RETAIL_SALES',
  'ISM Manufacturing': 'ISM_MANUFACTURING',
  'ISM Services': 'ISM_SERVICES',
}

function getIndicatorKeyFromEvent(event: string, tema: string): string | null {
  // Buscar por tema primero
  if (TEMA_TO_INDICATOR_KEY[tema]) {
    return TEMA_TO_INDICATOR_KEY[tema]
  }
  
  // Buscar por nombre de evento
  const eventUpper = event.toUpperCase()
  for (const [key, value] of Object.entries(TEMA_TO_INDICATOR_KEY)) {
    if (eventUpper.includes(key.toUpperCase())) {
      return value
    }
  }
  
  return null
}

function parseConsenso(consenso: string | null | undefined): { value: number | null; unit: string | null } {
  if (!consenso) return { value: null, unit: null }
  
  // Intentar extraer número y unidad
  const match = consenso.match(/([+-]?\d+\.?\d*)\s*([%$€]|p\.p\.|pp)/i)
  if (match) {
    return {
      value: parseFloat(match[1]),
      unit: match[2]
    }
  }
  
  // Solo número
  const numMatch = consenso.match(/([+-]?\d+\.?\d*)/)
  if (numMatch) {
    return {
      value: parseFloat(numMatch[1]),
      unit: null
    }
  }
  
  return { value: null, unit: null }
}

export default async function NoticiasPage() {
  // Calcular próxima semana (lunes a domingo)
  const currentUTC = new Date()
  const currentMadrid = toZonedTime(currentUTC, TIMEZONE)
  const nextMonday = startOfWeek(addDays(currentMadrid, 7), { weekStartsOn: 1 })
  const nextSunday = endOfWeek(nextMonday, { weekStartsOn: 1 })

  const mondayStr = format(nextMonday, 'yyyy-MM-dd')
  const sundayStr = format(nextSunday, 'yyyy-MM-dd')

  // Obtener eventos de próxima semana
  const events = getCalendarEvents(mondayStr, sundayStr)
  
  // Agrupar eventos por día
  const eventsByDay = new Map<string, typeof events>()
  for (const event of events) {
    const day = event.fecha
    if (!eventsByDay.has(day)) {
      eventsByDay.set(day, [])
    }
    eventsByDay.get(day)!.push(event)
  }

  // Obtener datos históricos para cada evento
  const eventsWithHistory = events.map(event => {
    const indicatorKey = getIndicatorKeyFromEvent(event.evento, event.tema)
    const history = indicatorKey ? getIndicatorHistory(indicatorKey) : null
    const consenso = parseConsenso(event.consenso)
    
    return {
      ...event,
      indicatorKey,
      history,
      consenso,
    }
  })

  return (
    <div className="mx-auto max-w-7xl p-6 space-y-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight mb-4">Calendario Macroeconómico</h1>
        <p className="text-lg text-muted-foreground mb-2">
          Eventos de la próxima semana: {format(nextMonday, "d 'de' MMMM", { locale: es })} - {format(nextSunday, "d 'de' MMMM, yyyy", { locale: es })}
        </p>
        <p className="text-sm text-muted-foreground">
          Datos anteriores, previsiones y análisis de eventos macroeconómicos de alta y media importancia
        </p>
      </div>

      {/* Explicación */}
      <div className="rounded-lg border bg-card p-6 mb-6">
        <h2 className="text-2xl font-semibold mb-4">¿Qué es el Calendario Macroeconómico?</h2>
        <div className="space-y-3 text-sm">
          <p className="text-foreground leading-relaxed">
            El calendario macroeconómico muestra los eventos económicos más importantes que pueden afectar a los mercados financieros. Cada evento incluye:
          </p>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
            <li><strong>Dato Anterior:</strong> El último valor publicado de este indicador</li>
            <li><strong>Previsión (Consenso):</strong> El valor esperado por los analistas</li>
            <li><strong>Importancia:</strong> Alto impacto (high) o medio impacto (med) en los mercados</li>
          </ul>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
            <h3 className="font-semibold text-blue-900 mb-2">¿Por qué es importante?</h3>
            <p className="text-blue-800 text-sm leading-relaxed">
              Cuando un dato económico se publica, los mercados comparan el valor real con la previsión (consenso). Si el dato es mejor de lo esperado, generalmente es positivo para el activo relacionado. Si es peor, puede generar volatilidad negativa. Esta información te ayuda a anticipar movimientos y gestionar el riesgo.
            </p>
          </div>
        </div>
      </div>

      {/* Eventos por día */}
      {eventsByDay.size === 0 ? (
        <div className="rounded-lg border bg-card p-6 text-center">
          <p className="text-muted-foreground">No hay eventos programados para la próxima semana.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Array.from(eventsByDay.entries())
            .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
            .map(([date, dayEvents]) => {
              const dateObj = parseISO(date)
              const dayName = format(dateObj, 'EEEE', { locale: es })
              const dayNumber = format(dateObj, 'd')
              const month = format(dateObj, 'MMMM', { locale: es })
              
              return (
                <div key={date} className="space-y-4">
                  <div className="border-b pb-2">
                    <h2 className="text-2xl font-semibold capitalize">
                      {dayName}, {dayNumber} de {month}
                    </h2>
                  </div>
                  
                  <div className="grid gap-4">
                    {dayEvents.map((event, idx) => {
                      const eventWithHistory = eventsWithHistory.find(e => 
                        e.fecha === event.fecha && 
                        e.evento === event.evento &&
                        e.tema === event.tema
                      ) || event
                      
                      const history = 'history' in eventWithHistory ? eventWithHistory.history : null
                      const consenso = 'consenso' in eventWithHistory ? eventWithHistory.consenso : parseConsenso(event.consenso)
                      
                      const importanciaBadge = event.importancia === 'high'
                        ? 'bg-red-100 text-red-800 border-red-200'
                        : 'bg-yellow-100 text-yellow-800 border-yellow-200'
                      
                      return (
                        <div key={idx} className="rounded-lg border bg-card p-5 hover:shadow-md transition-shadow">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className="text-lg font-semibold">{event.evento}</h3>
                                <span className={`px-2 py-1 rounded text-xs font-medium border ${importanciaBadge}`}>
                                  {event.importancia === 'high' ? 'Alto Impacto' : 'Medio Impacto'}
                                </span>
                              </div>
                              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                {event.pais && (
                                  <span className="flex items-center gap-1">
                                    <span className="font-medium">País:</span> {event.pais}
                                  </span>
                                )}
                                {event.tema && (
                                  <span className="flex items-center gap-1">
                                    <span className="font-medium">Tema:</span> {event.tema}
                                  </span>
                                )}
                                {event.hora_local && (
                                  <span className="flex items-center gap-1">
                                    <span className="font-medium">Hora:</span> {event.hora_local}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Datos históricos y previsión */}
                          <div className="grid md:grid-cols-3 gap-4 mt-4 pt-4 border-t">
                            {/* Dato Anterior */}
                            <div className="bg-muted/30 rounded-lg p-4">
                              <div className="text-xs text-muted-foreground mb-1">Dato Anterior</div>
                              {history?.value_previous != null ? (
                                <div>
                                  <div className="text-lg font-semibold">
                                    {history.value_previous.toLocaleString('es-ES', {
                                      maximumFractionDigits: 2
                                    })}
                                    {history.date_previous && (
                                      <span className="text-xs text-muted-foreground ml-2">
                                        ({format(parseISO(history.date_previous), 'd MMM yyyy', { locale: es })})
                                      </span>
                                    )}
                                  </div>
                                  {history.value_current != null && (
                                    <div className="text-xs text-muted-foreground mt-1">
                                      Actual: {history.value_current.toLocaleString('es-ES', {
                                        maximumFractionDigits: 2
                                      })}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="text-sm text-muted-foreground">No disponible</div>
                              )}
                            </div>

                            {/* Previsión (Consenso) */}
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                              <div className="text-xs text-blue-700 mb-1 font-medium">Previsión (Consenso)</div>
                              {typeof consenso === 'object' && consenso?.value != null ? (
                                <div>
                                  <div className="text-lg font-semibold text-blue-900">
                                    {consenso.value > 0 ? '+' : ''}{consenso.value.toLocaleString('es-ES', {
                                      maximumFractionDigits: 2
                                    })}
                                    {consenso.unit && <span className="text-sm ml-1">{consenso.unit}</span>}
                                  </div>
                                  {event.consenso && (
                                    <div className="text-xs text-blue-700 mt-1">
                                      {event.consenso}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="text-sm text-blue-700">
                                  {event.consenso || 'No disponible'}
                                </div>
                              )}
                            </div>

                            {/* Análisis */}
                            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                              <div className="text-xs text-green-700 mb-1 font-medium">Análisis</div>
                              {history?.value_previous != null && typeof consenso === 'object' && consenso?.value != null ? (
                                <div className="text-sm text-green-800">
                                  {consenso.value > history.value_previous ? (
                                    <span className="font-semibold">Esperado mejor que anterior</span>
                                  ) : consenso.value < history.value_previous ? (
                                    <span className="font-semibold">Esperado peor que anterior</span>
                                  ) : (
                                    <span>Esperado similar al anterior</span>
                                  )}
                                </div>
                              ) : (
                                <div className="text-sm text-green-700">
                                  Compara el dato publicado con la previsión para evaluar sorpresas
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Información adicional */}
                          {'indicatorKey' in eventWithHistory && eventWithHistory.indicatorKey && (
                            <div className="mt-4 pt-4 border-t text-xs text-muted-foreground">
                              Indicador relacionado: <code className="bg-muted px-1 rounded">{eventWithHistory.indicatorKey}</code>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
        </div>
      )}

      {/* Notas finales */}
      <div className="rounded-lg border bg-card p-6 mt-8">
        <h2 className="text-2xl font-semibold mb-4">Notas Importantes</h2>
        <div className="space-y-3 text-sm">
          <div className="flex items-start gap-3">
            <span className="text-primary font-bold">•</span>
            <p className="text-foreground leading-relaxed">
              <strong>Horarios:</strong> Los horarios mostrados son en hora local del país donde se publica el dato. Ajusta según tu zona horaria para operar.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-primary font-bold">•</span>
            <p className="text-foreground leading-relaxed">
              <strong>Previsiones:</strong> Las previsiones (consenso) son estimaciones de analistas y pueden cambiar antes de la publicación. Revisa actualizaciones el día del evento.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-primary font-bold">•</span>
            <p className="text-foreground leading-relaxed">
              <strong>Sorpresas:</strong> Cuando el dato publicado difiere significativamente de la previsión, puede generar alta volatilidad. Prepara tu estrategia de gestión de riesgo.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-primary font-bold">•</span>
            <p className="text-foreground leading-relaxed">
              <strong>Datos históricos:</strong> Algunos indicadores pueden no tener datos históricos disponibles si son nuevos o no se han actualizado recientemente.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
