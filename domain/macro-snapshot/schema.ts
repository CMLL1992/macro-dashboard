/**
 * Macro Snapshot Schema (Zod)
 * 
 * Definición única y validada del estado macro para trading.
 * Este es el contrato que garantiza que UI, jobs y notificaciones
 * consumen el mismo estado con la misma semántica.
 * 
 * Usage:
 *   import { parseMacroSnapshot } from '@/domain/macro-snapshot'
 *   const result = parseMacroSnapshot(rawData)
 *   if (result.ok) {
 *     const snapshot = result.data // Type-safe MacroSnapshot
 *   } else {
 *     console.error(result.issues) // Validation errors
 *   }
 */

import { z } from 'zod'

// ===== ENUMS =====

export const RegimeEnum = z.enum([
  'RISK_ON',
  'RISK_OFF',
  'NEUTRAL',
])

export const USDBiasEnum = z.enum([
  'Fuerte',
  'Débil',
  'Neutral',
  'STRONG',
  'WEAK',
  'NEUTRAL',
])

export const BiasDirectionEnum = z.enum([
  'long',
  'short',
  'neutral',
])

export const ConfidenceEnum = z.enum([
  'Alta',
  'Media',
  'Baja',
  'high',
  'medium',
  'low',
])

export const ImportanceEnum = z.enum([
  'low',
  'medium',
  'high',
])

// ===== DRIVERS =====

export const BiasDriverSchema = z.object({
  key: z.string(),
  name: z.string(),
  direction: BiasDirectionEnum,
  weight: z.number().min(0).max(1),
  note: z.string().optional(),
})

// ===== UPCOMING DATES =====

export const UpcomingDateSchema = z.object({
  name: z.string(),
  date: z.string().datetime(), // ISO string
  importance: ImportanceEnum,
  country: z.string().optional(),
  currency: z.string().optional(),
})

// ===== CORRELATIONS =====

export const CorrelationRowSchema = z.object({
  symbol: z.string(),
  benchmark: z.string().default('DXY'),
  corr12m: z.number().nullable(),
  corr6m: z.number().nullable(),
  corr3m: z.number().nullable(),
  corrRef: z.string().optional(),
})

// ===== NARRATIVE =====

export const NarrativeSchema = z.object({
  headline: z.string(),
  bullets: z.array(z.string()),
  confidence: ConfidenceEnum,
  tags: z.array(z.string()).optional(),
})

// ===== REGIME =====

export const RegimeSchema = z.object({
  overall: z.string(), // e.g., 'RISK_ON', 'RISK_OFF', 'NEUTRAL'
  usd_direction: z.string(), // e.g., 'Fuerte', 'Débil', 'Neutral'
  usd_label: USDBiasEnum.optional(), // Normalized label
  quad: z.string(), // e.g., 'Growth/Inflation'
  liquidity: z.string().optional(),
  credit: z.string().optional(),
  risk: z.string().optional(),
})

// ===== METRICS =====

export const MetricsSchema = z.object({
  usdScore: z.number().min(-100).max(100),
  quadScore: z.number().min(-100).max(100).optional(),
  liquidityScore: z.number().min(-100).max(100).nullable().optional(),
  creditScore: z.number().min(-100).max(100).nullable().optional(),
  riskScore: z.number().min(-100).max(100).nullable().optional(),
  // Unified score (0-100 or -100 to 100)
  score: z.number().min(-100).max(100).optional(),
})

// ===== CURRENCY REGIMES =====

export const CurrencyRegimeSchema = z.object({
  regime: z.string(),
  probability: z.number().min(0).max(1),
  description: z.string().optional(),
})

export const CurrencyRegimesSchema = z.object({
  USD: CurrencyRegimeSchema.optional(),
  EUR: CurrencyRegimeSchema.optional(),
  GBP: CurrencyRegimeSchema.optional(),
  JPY: CurrencyRegimeSchema.optional(),
  AUD: CurrencyRegimeSchema.optional(),
}).optional()

// ===== MAIN SCHEMA =====

export const MacroSnapshotSchema = z.object({
  // Timestamp
  nowTs: z.string().datetime(), // ISO string
  
  // Regime
  regime: RegimeSchema,
  
  // USD Bias (normalized)
  usdBias: USDBiasEnum,
  macroBias: z.enum(['hawkish', 'dovish', 'neutral']).optional(),
  
  // Score (unified)
  score: z.number().min(-100).max(100),
  
  // Drivers
  drivers: z.array(BiasDriverSchema),
  
  // Upcoming dates
  upcomingDates: z.array(UpcomingDateSchema),
  
  // Correlations (normalized structure)
  correlations: z.array(CorrelationRowSchema),
  
  // Narrative
  narrative: NarrativeSchema.optional(),
  
  // Metrics (optional, for detailed analysis)
  metrics: MetricsSchema.optional(),
  
  // Currency regimes (optional)
  currencyRegimes: CurrencyRegimesSchema,
  
  // Metadata
  updatedAt: z.string().datetime().optional(), // ISO string
  biasUpdatedAt: z.string().datetime().optional(), // ISO string
  correlationUpdatedAt: z.string().datetime().optional(), // ISO string
})

// ===== TYPE EXPORTS =====

export type Regime = z.infer<typeof RegimeEnum>
export type USDBias = z.infer<typeof USDBiasEnum>
export type BiasDirection = z.infer<typeof BiasDirectionEnum>
export type Confidence = z.infer<typeof ConfidenceEnum>
export type Importance = z.infer<typeof ImportanceEnum>
export type BiasDriver = z.infer<typeof BiasDriverSchema>
export type UpcomingDate = z.infer<typeof UpcomingDateSchema>
export type CorrelationRow = z.infer<typeof CorrelationRowSchema>
export type Narrative = z.infer<typeof NarrativeSchema>
export type RegimeData = z.infer<typeof RegimeSchema>
export type Metrics = z.infer<typeof MetricsSchema>
export type CurrencyRegime = z.infer<typeof CurrencyRegimeSchema>
export type CurrencyRegimes = z.infer<typeof CurrencyRegimesSchema>
export type MacroSnapshot = z.infer<typeof MacroSnapshotSchema>

// ===== VALIDATION RESULT =====

export type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; issues: z.ZodIssue[] }

