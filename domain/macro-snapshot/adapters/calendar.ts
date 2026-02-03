/**
 * Calendar Adapter
 * 
 * Convierte eventos del calendario económico a UpcomingDate[]
 * para el Macro Snapshot.
 */

import { getUnifiedDB } from '@/lib/db/unified-db'
import type { UpcomingDate } from '../schema'
import { ImportanceEnum } from '../schema'
import { logger } from '@/lib/obs/logger'

/**
 * Extract upcoming dates from economic_events table
 * 
 * Rules:
 * - Only future events (filter past events)
 * - Normalize to ISO date/string
 * - Map importance to ImportanceEnum
 * - Deduplicate by (name, date, country)
 * 
 * @param days - Number of days ahead to fetch (default: 14)
 * @returns Array of UpcomingDate
 */
export async function extractUpcomingDates(days: number = 14): Promise<UpcomingDate[]> {
  try {
    const db = getUnifiedDB()
    const now = new Date()
    const endDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)
    const endDateStr = endDate.toISOString()
    
    // Query economic_events table
    const query = `
      SELECT 
        name,
        scheduled_time_utc,
        country,
        currency,
        importance
      FROM economic_events
      WHERE scheduled_time_utc >= datetime('now')
        AND scheduled_time_utc <= ?
        AND importance IN ('high', 'medium', 'low')
      ORDER BY scheduled_time_utc ASC
    `
    
    const rows = await db.prepare(query).all(endDateStr) as Array<{
      name: string
      scheduled_time_utc: string
      country: string | null
      currency: string | null
      importance: string
    }>
    
    // Deduplicate by (name, date, country)
    const seen = new Set<string>()
    const upcomingDates: UpcomingDate[] = []
    
    for (const row of rows) {
      // Normalize date to ISO string
      let dateStr: string
      try {
        const date = new Date(row.scheduled_time_utc)
        if (isNaN(date.getTime())) {
          logger.warn('snapshot.calendar.invalid_date', {
            name: row.name,
            scheduled_time_utc: row.scheduled_time_utc,
          })
          continue
        }
        dateStr = date.toISOString()
        
        // Filter past events (safety check)
        if (date < now) {
          logger.debug('snapshot.calendar.past_event_filtered', {
            name: row.name,
            date: dateStr,
          })
          continue
        }
      } catch (error) {
        logger.warn('snapshot.calendar.date_parse_error', {
          name: row.name,
          scheduled_time_utc: row.scheduled_time_utc,
          error: error instanceof Error ? error.message : String(error),
        })
        continue
      }
      
      // Normalize importance
      const importance = normalizeImportance(row.importance)
      
      // Create deduplication key
      const dedupKey = `${row.name}|${dateStr}|${row.country || ''}`
      if (seen.has(dedupKey)) {
        continue
      }
      seen.add(dedupKey)
      
      upcomingDates.push({
        name: row.name,
        date: dateStr,
        importance,
        country: row.country || undefined,
        currency: row.currency || undefined,
      })
    }
    
    logger.debug('snapshot.calendar.extracted', {
      count: upcomingDates.length,
      days,
    })
    
    return upcomingDates
  } catch (error) {
    logger.error('snapshot.calendar.extract_error', {
      error,
      cause: error instanceof Error ? error.message : String(error),
    })
    return []
  }
}

/**
 * Normalize importance string to ImportanceEnum
 */
function normalizeImportance(importance: string): 'low' | 'medium' | 'high' {
  const lower = importance.toLowerCase()
  if (lower === 'high' || lower === 'alta') {
    return 'high'
  }
  if (lower === 'medium' || lower === 'media') {
    return 'medium'
  }
  return 'low'
}

