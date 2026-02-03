/**
 * Zod schemas for database row validation
 * 
 * Used to validate and type-check rows from SQLite/Turso queries
 * before using them in application code.
 */

import { z } from 'zod'
import { logger } from '@/lib/obs/logger'
import { generateRequestId } from '@/lib/obs/request-id'

// ===== Macro Series Schemas =====

export const MacroSeriesRowSchema = z.object({
  series_id: z.string(),
  source: z.string(),
  name: z.string(),
  frequency: z.string(),
  unit: z.string().nullable().optional(),
  last_updated: z.string().nullable().optional(),
})

export type MacroSeriesRow = z.infer<typeof MacroSeriesRowSchema>

export const MacroObservationRowSchema = z.object({
  date: z.string(),
  value: z.number().nullable(),
  observation_period: z.string().nullable().optional(),
})

export type MacroObservationRow = z.infer<typeof MacroObservationRowSchema>

// ===== Macro Bias Schemas =====

export const MacroBiasRowSchema = z.object({
  symbol: z.string(),
  score: z.number(),
  direction: z.string(), // 'long' | 'short' | 'neutral'
  confidence: z.number(),
  drivers_json: z.string(), // JSON string
  narrative_json: z.string().nullable().optional(), // JSON string or null
  computed_at: z.string(),
})

export type MacroBiasRow = z.infer<typeof MacroBiasRowSchema>

// ===== Correlations Schemas =====

export const CorrelationRowSchema = z.object({
  symbol: z.string(),
  base: z.string(),
  window: z.string(), // '12m' | '3m'
  value: z.number().nullable(),
  asof: z.string(),
  n_obs: z.number(),
  last_asset_date: z.string().nullable().optional(),
  last_base_date: z.string().nullable().optional(),
})

export type CorrelationRow = z.infer<typeof CorrelationRowSchema>

// ===== Economic Events Schemas =====

export const EconomicEventRowSchema = z.object({
  id: z.number(),
  source_event_id: z.string().nullable().optional(),
  country: z.string(),
  currency: z.string(),
  name: z.string(),
  scheduled_time_utc: z.string(),
  scheduled_time_local: z.string().nullable().optional(),
  importance: z.string().nullable().optional(), // 'high' | 'medium' | 'low'
  previous_value: z.number().nullable().optional(),
  consensus_value: z.number().nullable().optional(),
  actual_value: z.number().nullable().optional(),
  series_id: z.string().nullable().optional(),
  notified_at: z.string().nullable().optional(),
  notify_lead_minutes: z.number().nullable().optional(),
})

export type EconomicEventRow = z.infer<typeof EconomicEventRowSchema>

// ===== Indicator History Schemas =====

export const IndicatorHistoryRowSchema = z.object({
  indicator_key: z.string(),
  value_current: z.number().nullable(),
  value_previous: z.number().nullable(),
  date_current: z.string().nullable(),
  date_previous: z.string().nullable(),
})

export type IndicatorHistoryRow = z.infer<typeof IndicatorHistoryRowSchema>

// ===== Helper: Safe Parse Row with Logging =====

export type ParseRowResult<T> = {
  ok: true
  data: T
} | {
  ok: false
  issues: z.ZodError['errors']
  sample?: unknown
}

/**
 * Safely parse a database row with structured logging
 * 
 * @param schema - Zod schema to validate against
 * @param raw - Raw row from database
 * @param table - Table name for logging
 * @param requestId - Optional request ID for correlation
 * @returns ParseRowResult with typed data or issues
 */
export function safeParseRow<T extends z.ZodTypeAny>(
  schema: T,
  raw: unknown,
  table: string,
  requestId?: string
): ParseRowResult<z.infer<T>> {
  const reqId = requestId || generateRequestId()
  
  const result = schema.safeParse(raw)
  
  if (result.success) {
    return { ok: true, data: result.data }
  }
  
  // Log parse failure with context
  const sample = typeof raw === 'object' && raw !== null
    ? JSON.stringify(raw).slice(0, 500) // First 500 chars
    : String(raw).slice(0, 500)
  
  logger.warn('db.row.parse_failed', {
    requestId: reqId,
    table,
    issues: result.error.errors.map(e => ({
      path: e.path.join('.'),
      message: e.message,
      code: e.code,
    })),
    sample: sample.length > 500 ? `${sample}...` : sample,
  })
  
  return {
    ok: false,
    issues: result.error.errors,
    sample: raw,
  }
}

/**
 * Safely parse multiple database rows
 * 
 * @param schema - Zod schema to validate against
 * @param rawRows - Raw rows from database
 * @param table - Table name for logging
 * @param requestId - Optional request ID for correlation
 * @returns Array of parsed rows (failed rows are logged but skipped)
 */
export function safeParseRows<T extends z.ZodTypeAny>(
  schema: T,
  rawRows: unknown[],
  table: string,
  requestId?: string
): z.infer<T>[] {
  const reqId = requestId || generateRequestId()
  const parsed: z.infer<T>[] = []
  let failedCount = 0
  
  for (const raw of rawRows) {
    const result = safeParseRow(schema, raw, table, reqId)
    if (result.ok) {
      parsed.push(result.data)
    } else {
      failedCount++
    }
  }
  
  if (failedCount > 0) {
    logger.warn('db.rows.parse_partial', {
      requestId: reqId,
      table,
      total: rawRows.length,
      parsed: parsed.length,
      failed: failedCount,
    })
  }
  
  return parsed
}

