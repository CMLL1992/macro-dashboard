/**
 * Zod schemas for API request/response validation
 * 
 * Used to validate API endpoints before returning responses.
 * Ensures type safety and consistent error handling.
 */

import { z } from 'zod'

// ===== Bias API Schemas =====

/**
 * BiasRow from /api/bias (enriched with correlations and events)
 */
export const BiasRowSchema = z.object({
  par: z.string(),
  sesgoMacro: z.string(),
  accion: z.string(), // 'Long' | 'Short' | 'Neutral'
  motivo: z.string(),
  tactico: z.string().optional(),
  confianza: z.string().optional(), // 'Alta' | 'Media' | 'Baja'
  corr12m: z.number().nullable().optional(),
  corr3m: z.number().nullable().optional(),
  corr6m: z.number().nullable().optional(),
  corrRef: z.string().optional(),
  corrMapped: z.boolean().optional(),
  n_obs12m: z.number().optional(),
  n_obs3m: z.number().optional(),
  last_relevant_event: z.object({
    currency: z.string(),
    name: z.string(),
    surprise_direction: z.string(),
    surprise_score: z.number(),
    release_time_utc: z.string(),
  }).nullable().optional(),
  updated_after_last_event: z.boolean().optional(),
})

export type BiasRow = z.infer<typeof BiasRowSchema>

/**
 * Diagnosis Item (from getMacroDiagnosis)
 * Based on LatestPoint from lib/fred.ts
 */
export const DiagnosisItemSchema = z.object({
  key: z.string(),
  seriesId: z.string().optional(),
  label: z.string(),
  value: z.number().nullable(),
  value_previous: z.number().nullable().optional(),
  date: z.string().optional(), // LatestPoint has date?: string (not nullable)
  date_previous: z.string().nullable().optional(),
  trend: z.string().nullable().optional(), // Can be null
  posture: z.string().nullable().optional(), // Can be null
  weight: z.number().optional(),
  category: z.string().optional(),
  unit: z.string().optional(), // LatestPoint has unit?: string (not nullable)
  originalKey: z.string().optional(),
  note: z.string().optional(), // LatestPoint has note?: string
  zScore: z.number().nullable().optional(), // May exist in diagnosis items
})

export type DiagnosisItem = z.infer<typeof DiagnosisItemSchema>

/**
 * Recent Event (from getRecentEventsWithImpact)
 */
export const RecentEventSchema = z.object({
  event_id: z.number().optional(),
  release_id: z.number().optional(),
  currency: z.string(),
  name: z.string(),
  category: z.string().nullable().optional(), // Can be null
  importance: z.enum(['low', 'medium', 'high']).nullable().optional(), // Can be null
  release_time_utc: z.string(),
  actual: z.number().nullable().optional(),
  consensus: z.number().nullable().optional(),
  previous: z.number().nullable().optional(),
  surprise_raw: z.number().nullable().optional(),
  surprise_pct: z.number().nullable().optional(),
  surprise_score: z.number().nullable().optional(),
  surprise_direction: z.string().nullable().optional(),
  linked_series_id: z.string().nullable().optional(),
  linked_indicator_key: z.string().nullable().optional(),
  currency_score_before: z.number().nullable().optional(),
  currency_score_after: z.number().nullable().optional(),
  regime_before: z.string().nullable().optional(),
  regime_after: z.string().nullable().optional(),
})

export type RecentEvent = z.infer<typeof RecentEventSchema>

/**
 * Bias API Response Schema
 */
export const BiasApiResponseSchema = z.object({
  ok: z.literal(true),
  data: z.array(BiasRowSchema),
  items: z.array(DiagnosisItemSchema),
  regime: z.string(),
  usd: z.string(), // 'Fuerte' | 'Débil' | 'Neutral'
  quad: z.string(),
  score: z.number(),
  rows: z.array(BiasRowSchema), // Alias de data
  recentEvents: z.array(RecentEventSchema).optional(),
  meta: z.object({
    bias_updated_at: z.string().nullable(),
    last_event_applied_at: z.string().nullable().optional(),
  }).optional(),
  health: z.object({
    hasData: z.boolean(),
    observationCount: z.number(),
    biasCount: z.number(),
    correlationCount: z.number(),
  }).optional(),
  updatedAt: z.string().nullable().optional(),
  latestDataDate: z.string().nullable().optional(),
})

export type BiasApiResponse = z.infer<typeof BiasApiResponseSchema>

// ===== Correlations API Schemas =====

/**
 * Correlation API Row (formatted for frontend)
 */
export const CorrelationApiRowSchema = z.object({
  activo: z.string(),
  corr12: z.number().nullable(),
  corr24: z.number().nullable().optional(),
  corr6: z.number().nullable().optional(),
  corr3: z.number().nullable(),
  señal: z.string(), // 'Strengthening' | 'Weakening' | 'Stable' | 'Weak'
  comentario: z.string(),
})

export type CorrelationApiRow = z.infer<typeof CorrelationApiRowSchema>

/**
 * Save Correlations Body Schema (POST /api/correlations)
 * Supports both CorrelationEntry format and legacy format
 */
export const SaveCorrelationsBodySchema = z.array(
  z.union([
    // CorrelationEntry format
    z.object({
      pair: z.string(),
      ref: z.string(),
      corr12m: z.number().nullable(),
      corr6m: z.number().nullable(),
      corr3m: z.number().nullable(),
      lastUpdated: z.string(),
    }),
    // Legacy format (activo, corr12, etc.)
    z.object({
      activo: z.string(),
      corr12: z.number().nullable().optional(),
      corr24: z.number().nullable().optional(),
      corr6: z.number().nullable().optional(),
      corr3: z.number().nullable().optional(),
      señal: z.string().optional(),
      comentario: z.string().optional(),
    }),
  ])
)

export type SaveCorrelationsBody = z.infer<typeof SaveCorrelationsBodySchema>

// ===== Calendar API Schemas =====

/**
 * Calendar Event Row (for /calendario page)
 * Based on EconomicEvent from lib/db/economic-events.ts
 */
export const CalendarEventRowSchema = z.object({
  id: z.number(),
  source_event_id: z.string().nullable(), // EconomicEvent has source_event_id: string | null (not optional)
  country: z.string(),
  currency: z.string(),
  name: z.string(),
  category: z.string().nullable(), // EconomicEvent has category: string | null
  importance: z.enum(['low', 'medium', 'high']).nullable(), // EconomicEvent has importance: 'low' | 'medium' | 'high' | null
  series_id: z.string().nullable().optional(), // May be in query
  indicator_key: z.string().nullable().optional(), // May be in query
  scheduled_time_utc: z.string(),
  scheduled_time_local: z.string().nullable(),
  previous_value: z.number().nullable(),
  consensus_value: z.number().nullable(),
  consensus_range_min: z.number().nullable().optional(),
  consensus_range_max: z.number().nullable().optional(),
  directionality: z.enum(['higher_is_positive', 'lower_is_positive']).nullable().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
})

export type CalendarEventRow = z.infer<typeof CalendarEventRowSchema>

/**
 * Economic Release Row (for /calendario page)
 */
export const EconomicReleaseRowSchema = z.object({
  id: z.number(),
  release_time_utc: z.string(),
  actual_value: z.number().nullable().optional(),
  consensus_value: z.number().nullable().optional(),
  previous_value: z.number().nullable().optional(),
  surprise_raw: z.number().nullable().optional(),
  surprise_pct: z.number().nullable().optional(),
  surprise_score: z.number().nullable().optional(),
  surprise_direction: z.string().nullable().optional(),
  currency: z.string().optional(),
  name: z.string().optional(),
  importance: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
})

export type EconomicReleaseRow = z.infer<typeof EconomicReleaseRowSchema>

