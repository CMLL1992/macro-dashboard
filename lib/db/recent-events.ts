/**
 * Get recent economic events with impact information for /api/bias
 */

import { getRecentReleases } from './economic-events'
import { getUnifiedDB, isUsingTurso } from './unified-db'
import { getDB } from './schema'
import type { CurrencyScores } from '@/domain/diagnostic'

export type RecentEventWithImpact = {
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

/**
 * Get recent events with impact information for bias endpoint
 */
export async function getRecentEventsWithImpact(params: {
  hours?: number
  currencies?: string[]
  min_importance?: 'low' | 'medium' | 'high'
  min_surprise_score?: number
}): Promise<RecentEventWithImpact[]> {
  const {
    hours = 48,
    currencies,
    min_importance = 'medium',
    min_surprise_score = 0.3,
  } = params

  // Get recent releases
  const releases = await getRecentReleases({
    hours,
    importance: min_importance,
    min_surprise_score,
  })

  // Filter by currencies if specified
  const filteredReleases = currencies
    ? releases.filter(r => currencies.includes(r.event.currency))
    : releases

  // Get impact information for each release
  const eventsWithImpact: RecentEventWithImpact[] = []

  for (const release of filteredReleases) {
    // Get impact if available
    let impact: {
      currency_score_before: number | null
      currency_score_after: number | null
      regime_before: string | null
      regime_after: string | null
    } | null = null

    if (isUsingTurso()) {
      const db = getUnifiedDB()
      const stmt = db.prepare(`
        SELECT 
          total_score_before as currency_score_before,
          total_score_after as currency_score_after,
          regime_before,
          regime_after
        FROM macro_event_impact
        WHERE release_id = ? AND currency = ?
        ORDER BY created_at DESC
        LIMIT 1
      `)
      impact = await stmt.get(release.event_id, release.event.currency) as typeof impact
    } else {
      const db = getDB()
      const stmt = db.prepare(`
        SELECT 
          total_score_before as currency_score_before,
          total_score_after as currency_score_after,
          regime_before,
          regime_after
        FROM macro_event_impact
        WHERE release_id = ? AND currency = ?
        ORDER BY created_at DESC
        LIMIT 1
      `)
      impact = stmt.get(release.event_id, release.event.currency) as typeof impact
    }

    eventsWithImpact.push({
      event_id: release.event.id,
      release_id: release.id,
      currency: release.event.currency,
      name: release.event.name,
      category: release.event.category,
      importance: release.event.importance,
      release_time_utc: release.release_time_utc,
      actual: release.actual_value,
      consensus: release.consensus_value,
      previous: release.previous_value,
      surprise_raw: release.surprise_raw,
      surprise_pct: release.surprise_pct,
      surprise_score: release.surprise_score,
      surprise_direction: release.surprise_direction,
      linked_series_id: release.event.series_id,
      linked_indicator_key: release.event.indicator_key,
      currency_score_before: impact?.currency_score_before ?? null,
      currency_score_after: impact?.currency_score_after ?? null,
      regime_before: impact?.regime_before ?? null,
      regime_after: impact?.regime_after ?? null,
    })
  }

  return eventsWithImpact
}

/**
 * Get last relevant event for a currency (for TacticalBiasRow enrichment)
 */
export async function getLastRelevantEventForCurrency(
  currency: string,
  hours: number = 24
): Promise<RecentEventWithImpact | null> {
  const events = await getRecentEventsWithImpact({
    hours,
    currencies: [currency],
    min_importance: 'medium',
    min_surprise_score: 0.2,
  })

  if (events.length === 0) return null

  // Return most recent
  return events[0]
}

