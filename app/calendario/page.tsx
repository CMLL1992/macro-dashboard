/**
 * Página de Calendario Económico
 * Muestra eventos económicos programados y releases publicados
 */

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { getUnifiedDB, isUsingTurso } from '@/lib/db/unified-db'
import type { EconomicEvent } from '@/lib/db/economic-events'
import { Accordion } from '@/components/ui/accordion'
import { CalendarClient } from './CalendarClient'
import type { CalendarEventResponse } from '@/app/api/calendar/route'
import { getRegionCode } from '@/config/calendar-countries'

async function getUpcomingEvents(days: number = 14): Promise<EconomicEvent[]> {
  try {
    // All methods are async now, so always use await
    const db = getUnifiedDB()
    const now = new Date()
    const endDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)
    const endDateStr = endDate.toISOString()
    
    const query = `
      SELECT 
        id, source_event_id, country, currency, name, category, importance,
        series_id, indicator_key, scheduled_time_utc, scheduled_time_local,
        previous_value, consensus_value, consensus_range_min, consensus_range_max,
        directionality, created_at, updated_at
      FROM economic_events
      WHERE scheduled_time_utc >= datetime('now')
        AND scheduled_time_utc <= ?
      ORDER BY scheduled_time_utc ASC
    `
    
    const rows = await db.prepare(query).all(endDateStr) as any[]
    return rows.map(row => ({
      id: row.id,
      source_event_id: row.source_event_id,
      country: row.country,
      currency: row.currency,
      name: row.name,
      category: row.category,
      importance: row.importance,
      series_id: row.series_id,
      indicator_key: row.indicator_key,
      scheduled_time_utc: row.scheduled_time_utc,
      scheduled_time_local: row.scheduled_time_local,
      previous_value: row.previous_value,
      consensus_value: row.consensus_value,
      consensus_range_min: row.consensus_range_min,
      consensus_range_max: row.consensus_range_max,
      directionality: row.directionality,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }))
  } catch (error) {
    console.error('[getUpcomingEvents] Error:', error)
    return []
  }
}

async function getRecentReleases(limit: number = 10) {
  try {
    // All methods are async now, so always use await
    const db = getUnifiedDB()
    
    const query = `
      SELECT 
        er.id,
        er.release_time_utc,
        er.actual_value,
        er.consensus_value,
        er.previous_value,
        er.surprise_raw,
        er.surprise_pct,
        er.surprise_score,
        er.surprise_direction,
        ee.currency,
        ee.name,
        ee.importance,
        ee.category
      FROM economic_releases er
      JOIN economic_events ee ON er.event_id = ee.id
      ORDER BY er.release_time_utc DESC
      LIMIT ?
    `
    
    // All methods are async now, so always use await
    return await db.prepare(query).all(limit) as any[]
  } catch (error) {
    console.error('[getRecentReleases] Error:', error)
    return []
  }
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleString('es-ES', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Madrid',
  })
}

function getImportanceColor(importance: string | null): string {
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

function getImportanceLabel(importance: string | null): string {
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

function getSurpriseColor(direction: string | null): string {
  switch (direction) {
    case 'positive':
      return 'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30'
    case 'negative':
      return 'text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/30'
    default:
      return 'text-muted-foreground bg-muted'
  }
}

export default async function CalendarioPage() {
  // Obtener eventos iniciales para SSR (próximos 7 días, high/medium)
  let initialEvents: CalendarEventResponse[] = []
  let releases: any[] = []
  
  try {
    // Obtener eventos directamente desde la BD para SSR
    // All methods are async now, so always use await
    const db = getUnifiedDB()
    const now = new Date()
    const from = new Date(now.getTime())
    from.setHours(0, 0, 0, 0)
    const to = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    to.setHours(23, 59, 59, 999)
    
    const sql = `
      SELECT 
        id,
        source_event_id,
        country,
        currency,
        name,
        category,
        importance,
        scheduled_time_utc,
        scheduled_time_local,
        previous_value,
        consensus_value,
        consensus_range_min,
        consensus_range_max
      FROM economic_events
      WHERE scheduled_time_utc >= ? AND scheduled_time_utc <= ?
        AND importance IN ('high', 'medium')
      ORDER BY scheduled_time_utc ASC
    `
    
    const rows = await db.prepare(sql).all(from.toISOString(), to.toISOString()) as any[]
    
    initialEvents = rows.map(row => {
      const localTime = row.scheduled_time_local || new Date(row.scheduled_time_utc).toLocaleString('es-ES', {
        timeZone: 'Europe/Madrid',
      })
      const regionCode = getRegionCode(row.country) || 'US'
      
      return {
        id: String(row.id),
        dateTimeUtc: row.scheduled_time_utc,
        localTime,
        region: regionCode,
        country: row.country,
        currency: row.currency,
        title: row.name,
        category: row.category,
        importance: row.importance,
        actual: row.consensus_value != null ? String(row.consensus_value) : null,
        previous: row.previous_value != null ? String(row.previous_value) : null,
        forecast: row.consensus_value != null ? String(row.consensus_value) : null,
      }
    })
  } catch (error) {
    console.error('[CalendarioPage] Error fetching initial events:', error)
  }
  
  try {
    releases = await getRecentReleases(20) // Últimos 20 releases
  } catch (error) {
    console.error('[CalendarioPage] Error fetching releases:', error)
  }

  return (
    <main className="p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Explicación de la página Calendario */}
        <Accordion 
          title="📅 ¿Qué muestra esta página?"
          description="Guía completa para entender el calendario económico y cómo interpretar los eventos"
        >
          <div className="space-y-4 text-sm text-foreground">
            <div>
              <h3 className="font-semibold mb-2">1️⃣ Próximos Eventos</h3>
              <p className="mb-2">
                Muestra los eventos económicos programados para los próximos días:
              </p>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Nombre del Evento:</strong> Indicador económico que se publicará (ej: NFP, CPI, Fed Rate Decision)</li>
                <li><strong>Importancia:</strong> Alta/Media/Baja - qué tan importante es este evento para los mercados</li>
                <li><strong>Moneda/País:</strong> Qué moneda o país afecta este evento</li>
                <li><strong>Hora:</strong> Cuándo se publicará el dato (en UTC y hora local)</li>
                <li><strong>Consenso:</strong> Valor esperado por los analistas</li>
                <li><strong>Valor Anterior:</strong> Último valor publicado de este indicador</li>
                <li><strong>Rango Consenso:</strong> Rango esperado por los analistas (mínimo-máximo)</li>
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">
                <strong>¿Cómo usarlo?</strong> Revisa los eventos de Alta importancia para saber cuándo esperar volatilidad. 
                Compara el valor real (cuando se publique) con el consenso para identificar sorpresas.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">2️⃣ Releases Recientes</h3>
              <p className="mb-2">
                Muestra los datos económicos que ya se han publicado:
              </p>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Valor Real:</strong> El dato que realmente se publicó</li>
                <li><strong>Consenso:</strong> Lo que esperaban los analistas</li>
                <li><strong>Valor Anterior:</strong> El dato del mes/trimestre anterior</li>
                <li><strong>Sorpresa:</strong> Diferencia entre el valor real y el consenso</li>
                <li><strong>Dirección:</strong> Positiva (mejor de lo esperado) o Negativa (peor de lo esperado)</li>
                <li><strong>Score de Sorpresa:</strong> Qué tan grande fue la sorpresa (normalizado)</li>
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">
                <strong>¿Cómo interpretarlo?</strong> Sorpresas positivas grandes normalmente fortalecen la moneda afectada. 
                Sorpresas negativas grandes la debilitan. El dashboard recalcula automáticamente los scores macro tras cada release importante.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">3️⃣ Importancia de los Eventos</h3>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Alta:</strong> Eventos que causan alta volatilidad (NFP, CPI, decisiones de bancos centrales)</li>
                <li><strong>Media:</strong> Eventos importantes pero con menor impacto (PMI, ventas minoristas)</li>
                <li><strong>Baja:</strong> Eventos con impacto limitado (datos secundarios)</li>
              </ul>
            </div>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mt-4">
              <p className="text-sm font-semibold text-yellow-900 dark:text-yellow-300 mb-2">💡 Consejo</p>
              <p className="text-xs text-yellow-800 dark:text-yellow-200">
                Los eventos de Alta importancia pueden causar movimientos fuertes. 
                Considera reducir exposición o esperar a que pase la volatilidad si no estás seguro de la dirección.
              </p>
            </div>
          </div>
        </Accordion>

        {/* Header */}
        <div className="rounded-lg border bg-card p-6">
          <h1 className="text-3xl font-bold mb-2">Calendario Económico</h1>
          <p className="text-muted-foreground">
            Eventos económicos programados y releases publicados. Datos actualizados desde proveedores oficiales.
          </p>
        </div>

        {/* Próximos Eventos con Filtros */}
        <CalendarClient initialEvents={initialEvents} />

        {/* Releases Recientes */}
        <section className="rounded-lg border bg-card p-6">
          <h2 className="text-2xl font-semibold mb-4">Releases Recientes ({releases.length})</h2>
          
          {releases.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-lg mb-2">No hay releases publicados</p>
              <p className="text-sm">
                Los releases se actualizan automáticamente cuando se publican los datos.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-2 text-left">Fecha</th>
                    <th className="px-4 py-2 text-left">Evento</th>
                    <th className="px-4 py-2 text-left">Moneda</th>
                    <th className="px-4 py-2 text-right">Actual</th>
                    <th className="px-4 py-2 text-right">Consenso</th>
                    <th className="px-4 py-2 text-right">Anterior</th>
                    <th className="px-4 py-2 text-center">Sorpresa</th>
                  </tr>
                </thead>
                <tbody>
                  {releases.map((release: any) => (
                    <tr key={release.id} className="border-t hover:bg-muted/50">
                      <td className="px-4 py-3">
                        {formatDate(release.release_time_utc)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold">{release.name}</div>
                        {release.category && (
                          <div className="text-xs text-muted-foreground">{release.category}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium">{release.currency}</span>
                        {release.importance && (
                          <span className={`ml-2 px-1.5 py-0.5 rounded text-xs ${getImportanceColor(release.importance)}`}>
                            {getImportanceLabel(release.importance)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {release.actual_value != null ? release.actual_value.toFixed(2) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">
                        {release.consensus_value != null ? release.consensus_value.toFixed(2) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground/70">
                        {release.previous_value != null ? release.previous_value.toFixed(2) : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {release.surprise_direction && release.surprise_score != null ? (
                          <div className={`inline-flex items-center gap-1 px-2 py-1 rounded ${getSurpriseColor(release.surprise_direction)}`}>
                            <span className="font-semibold">
                              {release.surprise_direction === 'positive' ? '↑' : '↓'}
                            </span>
                            <span className="text-xs">
                              {release.surprise_score > 0 ? '+' : ''}
                              {(release.surprise_score * 100).toFixed(1)}%
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

