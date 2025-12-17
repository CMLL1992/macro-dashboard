/**
 * Job: Auto-ingest PMI Manufacturing from calendar events
 * POST /api/jobs/ingest/pmi
 * Protected by CRON_TOKEN
 * 
 * Este job:
 * 1. Revisa el calendario económico para eventos de PMI publicados hoy
 * 2. Intenta extraer el valor publicado del evento
 * 3. Si encuentra un valor, lo inserta automáticamente en la base de datos
 * 
 * Se ejecuta automáticamente después de la ingesta del calendario
 */

export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { validateCronToken, unauthorizedResponse } from '@/lib/security/token'
import { logger } from '@/lib/obs/logger'
import { getUnifiedDB, isUsingTurso } from '@/lib/db/unified-db'
import { upsertMacroSeries } from '@/lib/db/upsert'
import type { MacroSeries } from '@/lib/types/macro'

/**
 * Extrae el valor numérico del PMI desde el texto del evento
 */
function extractPMIValue(eventText: string): number | null {
  if (!eventText || typeof eventText !== 'string') {
    return null
  }

  // Patrones comunes: "PMI 52.5", "PMI: 52.5", "52.5", "ISM Manufacturing PMI 52.3", etc.
  const patterns = [
    /PMI[:\s]+(\d{1,2}\.?\d*)/i,                    // "PMI: 52.5" o "PMI 52"
    /(\d{1,2}\.?\d*)\s*PMI/i,                        // "52.5 PMI"
    /ISM[:\s]+Manufacturing[:\s]+PMI[:\s]+(\d{1,2}\.?\d*)/i, // "ISM Manufacturing PMI 52.3"
    /Manufacturing[:\s]+PMI[:\s]+(\d{1,2}\.?\d*)/i,  // "Manufacturing PMI 52.3"
    /ISM[:\s]+(\d{1,2}\.?\d*)/i,                     // "ISM 52.5"
    /\b(\d{2}\.?\d*)\b/,                             // Cualquier número de 2 dígitos con decimales opcionales
  ]

  for (const pattern of patterns) {
    const match = eventText.match(pattern)
    if (match && match[1]) {
      const value = parseFloat(match[1])
      // PMI típicamente está entre 30-70 (rango válido del índice)
      if (!isNaN(value) && value >= 30 && value <= 70) {
        return value
      }
    }
  }

  // Intentar buscar números que parezcan PMI en el contexto
  const contextPattern = /(\d{1,2}\.?\d*)\s*(?:PMI|ISM|Manufacturing)/i
  const contextMatch = eventText.match(contextPattern)
  if (contextMatch && contextMatch[1]) {
    const value = parseFloat(contextMatch[1])
    if (!isNaN(value) && value >= 30 && value <= 70) {
      return value
    }
  }

  return null
}

/**
 * Obtiene eventos de PMI del calendario (últimos 90 días para tener datos históricos)
 * No solo eventos de hoy - acepta datos de hasta 90 días atrás
 */
async function getRecentPMIEvents(daysBack: number = 90): Promise<Array<{ fecha: string; evento: string; consenso?: string; tipo: 'manufacturing' | 'services' }>> {
  const today = new Date()
  const startDate = new Date(today)
  startDate.setDate(startDate.getDate() - daysBack)
  const startDateStr = startDate.toISOString().slice(0, 10)
  const todayStr = today.toISOString().slice(0, 10)
  
  if (isUsingTurso()) {
    const db = getUnifiedDB()
    const result = await db.prepare(`
      SELECT fecha, evento, consenso 
      FROM macro_calendar 
      WHERE fecha >= ? AND fecha <= ?
        AND (evento LIKE '%PMI%' OR evento LIKE '%ISM%')
        AND (tema = 'Manufactura' OR tema = 'Servicios' OR evento LIKE '%Services%' OR evento LIKE '%Manufacturing%')
      ORDER BY fecha DESC
    `).all(startDateStr, todayStr)
    
    return (result as Array<{ fecha: string; evento: string; consenso?: string }>).map(row => {
      const isServices = row.evento.toLowerCase().includes('services') || row.evento.toLowerCase().includes('servicios')
      return {
        fecha: row.fecha,
        evento: row.evento,
        consenso: row.consenso || undefined,
        tipo: isServices ? 'services' as const : 'manufacturing' as const,
      }
    })
  } else {
    // All methods are async now, so always use await
    const db = getUnifiedDB()
    const rows = await db.prepare(`
      SELECT fecha, evento, consenso 
      FROM macro_calendar 
      WHERE fecha >= ? AND fecha <= ?
        AND (evento LIKE '%PMI%' OR evento LIKE '%ISM%')
        AND (tema = 'Manufactura' OR tema = 'Servicios' OR evento LIKE '%Services%' OR evento LIKE '%Manufacturing%')
      ORDER BY fecha DESC
    `).all(startDateStr, todayStr) as Array<{ fecha: string; evento: string; consenso?: string }>
    
    return rows.map(row => {
      const isServices = row.evento.toLowerCase().includes('services') || row.evento.toLowerCase().includes('servicios')
      return {
        fecha: row.fecha,
        evento: row.evento,
        consenso: row.consenso || undefined,
        tipo: isServices ? 'services' as const : 'manufacturing' as const,
      }
    })
  }
}

/**
 * Verifica si ya existe un valor de PMI para una fecha específica
 */
async function hasPMIForDate(date: string, seriesId: 'USPMI' | 'USPMI_SERVICES'): Promise<boolean> {
  if (isUsingTurso()) {
    const db = getUnifiedDB()
    const result = await db.prepare(
      'SELECT COUNT(1) as c FROM macro_observations WHERE series_id = ? AND date = ?'
    ).get(seriesId, date)
    return ((result as { c: number }).c) > 0
  } else {
    // All methods are async now, so always use await
    const db = getUnifiedDB()
    const result = await db.prepare(
      'SELECT COUNT(1) as c FROM macro_observations WHERE series_id = ? AND date = ?'
    ).get(seriesId, date) as { c: number } | undefined
    return (result?.c || 0) > 0
  }
}

export async function POST(request: NextRequest) {
  if (!validateCronToken(request)) {
    return unauthorizedResponse()
  }

  const jobId = 'ingest_pmi_auto'
  const startedAt = new Date().toISOString()

  try {
    logger.info('Starting automatic PMI ingestion from calendar', { job: jobId })

    // 1. Obtener eventos de PMI de los últimos 90 días (no solo hoy)
    // Esto permite ingerir datos históricos si el calendario tiene eventos pasados
    const pmiEvents = await getRecentPMIEvents(90)
    
    if (pmiEvents.length === 0) {
      logger.info('No PMI events found in calendar (last 90 days)', { job: jobId })
      return NextResponse.json({
        success: true,
        message: 'No PMI events found in calendar (last 90 days)',
        ingested: 0,
      })
    }

    logger.info(`Found ${pmiEvents.length} PMI events in calendar (last 90 days)`, { job: jobId })

    let ingested = 0
    let skipped = 0

    for (const event of pmiEvents) {
      try {
        const seriesId = event.tipo === 'services' ? 'USPMI_SERVICES' : 'USPMI'
        const teEndpoint = event.tipo === 'services' 
          ? 'united-states/services-pmi' 
          : 'united-states/manufacturing-pmi'
        
        // Verificar si ya existe un valor para esta fecha
        if (await hasPMIForDate(event.fecha, seriesId)) {
          logger.info(`${seriesId} value already exists for ${event.fecha}, skipping`, { job: jobId })
          skipped++
          continue
        }

        // Intentar extraer el valor del evento
        let pmiValue: number | null = null

        // Primero intentar desde consenso si existe (puede contener el valor publicado)
        if (event.consenso) {
          const parsed = parseFloat(event.consenso)
          if (!isNaN(parsed) && parsed >= 30 && parsed <= 70) {
            pmiValue = parsed
          }
        }

        // Si no, intentar extraer del texto del evento
        if (pmiValue === null) {
          pmiValue = extractPMIValue(event.evento)
        }

        // También intentar desde el consenso como texto
        if (pmiValue === null && event.consenso) {
          pmiValue = extractPMIValue(event.consenso)
        }

        // Si aún no tenemos valor, intentar obtenerlo de Alpha Vantage (si está disponible)
        // TradingEconomics eliminado para USA - usar solo Alpha Vantage o manual entry
        if (pmiValue === null && process.env.ALPHA_VANTAGE_API_KEY) {
          try {
            logger.info(`Attempting to fetch ${seriesId} from Alpha Vantage for published date`, {
              job: jobId,
              date: event.fecha,
            })
            
            const { fetchAlphaVantagePMI } = await import('@/packages/ingestors/alphavantage')
            const pmiObservations = await fetchAlphaVantagePMI(process.env.ALPHA_VANTAGE_API_KEY)
            
            if (pmiObservations.length > 0) {
              // Buscar el valor más reciente que coincida con la fecha del evento
              const matchingObs = pmiObservations.find(obs => obs.date === event.fecha)
              if (matchingObs) {
                pmiValue = matchingObs.value
                logger.info('Found PMI value from Alpha Vantage', {
                  job: jobId,
                  date: event.fecha,
                  value: pmiValue,
                })
              } else {
                // Si no hay coincidencia exacta, usar el más reciente
                const latest = pmiObservations[pmiObservations.length - 1] // Ordenado ascendente
                if (latest && latest.date >= event.fecha) {
                  pmiValue = latest.value
                  logger.info('Using latest PMI value from Alpha Vantage', {
                    job: jobId,
                    eventDate: event.fecha,
                    obsDate: latest.date,
                    value: pmiValue,
                  })
                }
              }
            }
          } catch (error) {
            logger.warn('Failed to fetch PMI from Alpha Vantage', {
              job: jobId,
              error: error instanceof Error ? error.message : String(error),
            })
          }
        }

        if (pmiValue === null) {
          logger.warn(`Could not extract PMI value from event: ${event.evento}`, { job: jobId })
          skipped++
          continue
        }

        // Insertar el valor
        const pmiSeries: MacroSeries = {
          id: seriesId,
          source: 'MANUAL', // Calendar auto-ingested
          indicator: seriesId,
          nativeId: 'calendar-auto',
          name: event.tipo === 'services' ? 'ISM Services: PMI' : 'ISM Manufacturing: PMI',
          frequency: 'M', // Monthly
          data: [{
            date: event.fecha,
            value: pmiValue,
          }],
          lastUpdated: event.fecha,
        }

        await upsertMacroSeries(pmiSeries)
        ingested++

        logger.info('Auto-ingested PMI from calendar event', {
          job: jobId,
          date: event.fecha,
          value: pmiValue,
          source: 'calendar',
        })
      } catch (error) {
        logger.error('Error processing PMI event', {
          job: jobId,
          event: event.evento,
          error: error instanceof Error ? error.message : String(error),
        })
        skipped++
      }
    }

    const finishedAt = new Date().toISOString()
    const durationMs = new Date(finishedAt).getTime() - new Date(startedAt).getTime()

    logger.info('Automatic PMI ingestion completed', {
      job: jobId,
      ingested,
      skipped,
      durationMs,
    })

    return NextResponse.json({
      success: true,
      ingested,
      skipped,
      duration_ms: durationMs,
      finishedAt,
    })
  } catch (error) {
    const finishedAt = new Date().toISOString()
    const errorMessage = error instanceof Error ? error.message : String(error)

    logger.error('Automatic PMI ingestion failed', {
      job: jobId,
      error: errorMessage,
    })

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    )
  }
}

// Permitir GET además de POST para compatibilidad con cron jobs de Vercel
export async function GET(request: NextRequest) {
  return POST(request)
}

