/**
 * Zod schemas for external provider responses
 * 
 * Used to validate and type-check responses from external APIs
 * before converting to MacroSeries format.
 */

import { z } from 'zod'
import { logger } from '@/lib/obs/logger'
import { generateRequestId } from '@/lib/obs/request-id'

// ===== FRED API Schemas =====

export const FredObservationSchema = z.object({
  date: z.string(),
  value: z.union([z.string(), z.number()]).transform((val) => {
    if (typeof val === 'string') {
      const parsed = parseFloat(val)
      return isNaN(parsed) ? null : parsed
    }
    return val
  }),
})

export const FredResponseSchema = z.object({
  observations: z.array(FredObservationSchema),
  realtime_start: z.string().optional(),
  realtime_end: z.string().optional(),
})

export type FredObservation = z.infer<typeof FredObservationSchema>
export type FredResponse = z.infer<typeof FredResponseSchema>

// ===== TradingEconomics API Schemas =====

export const TradingEconomicsObservationSchema = z.object({
  date: z.string(),
  value: z.union([z.string(), z.number(), z.null()]).transform((val) => {
    if (val === null || val === '.') return null
    if (typeof val === 'string') {
      const parsed = parseFloat(val)
      return isNaN(parsed) ? null : parsed
    }
    return val
  }),
  Country: z.string().optional(),
  Category: z.string().optional(),
  Frequency: z.string().optional(),
  HistoricalDataSymbol: z.string().optional(),
  LastUpdate: z.string().optional(),
})

export const TradingEconomicsResponseSchema = z.array(TradingEconomicsObservationSchema)

export type TradingEconomicsObservation = z.infer<typeof TradingEconomicsObservationSchema>
export type TradingEconomicsResponse = z.infer<typeof TradingEconomicsResponseSchema>

// ===== ECB SDMX API Schemas =====

export const ECBSdmxObservationSchema = z.object({
  timeIndex: z.number(),
  value: z.union([z.string(), z.number(), z.null()]).transform((val) => {
    if (val === null || val === '.') return null
    if (typeof val === 'string') {
      const parsed = parseFloat(val)
      return isNaN(parsed) ? null : parsed
    }
    return val
  }),
})

export const ECBSdmxTimeValueSchema = z.string()

export const ECBSdmxResponseSchema = z.object({
  structure: z.object({
    dimensions: z.object({
      observation: z.array(z.any()).optional(),
    }).optional(),
  }).optional(),
  dataSets: z.array(z.object({
    series: z.record(z.any()).optional(),
    observations: z.record(z.array(z.array(z.union([z.string(), z.number()])))).optional(),
  })).optional(),
}).passthrough() // ECB responses can have various structures, we parse what we need

export type ECBSdmxObservation = z.infer<typeof ECBSdmxObservationSchema>
export type ECBSdmxResponse = z.infer<typeof ECBSdmxResponseSchema>

// ===== Helper: Safe Parse with Logging =====

export type ParseResult<T> = {
  ok: true
  data: T
} | {
  ok: false
  issues: z.ZodError['errors']
  sample?: unknown
}

/**
 * Safely parse provider response with structured logging
 * 
 * @param schema - Zod schema to validate against
 * @param raw - Raw response from provider
 * @param provider - Provider name for logging
 * @param requestId - Optional request ID for correlation
 * @returns ParseResult with typed data or issues
 */
export function safeParseProviderResponse<T extends z.ZodTypeAny>(
  schema: T,
  raw: unknown,
  provider: string,
  requestId?: string
): ParseResult<z.infer<T>> {
  const reqId = requestId || generateRequestId()
  
  const result = schema.safeParse(raw)
  
  if (result.success) {
    return { ok: true, data: result.data }
  }
  
  // Log parse failure with context
  const sample = typeof raw === 'object' && raw !== null
    ? JSON.stringify(raw).slice(0, 500) // First 500 chars
    : String(raw).slice(0, 500)
  
  logger.warn('provider.parse_failed', {
    requestId: reqId,
    provider,
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

