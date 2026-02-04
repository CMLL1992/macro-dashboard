/**
 * Environment variables validation and access
 *
 * - Base env: validated at import but does NOT require job-only vars (FRED, INGEST_KEY).
 *   Build (e.g. Collecting page data) never fails for missing ingest secrets.
 * - Ingest env: validated only when getIngestEnv() is called from ingest routes.
 *
 * Usage:
 *   import { env } from '@/lib/env'
 *   const apiKey = env.FRED_API_KEY // may be undefined at build time
 *
 *   // In ingest route handler only:
 *   import { getIngestEnv } from '@/lib/env'
 *   const { INGEST_KEY, FRED_API_KEY } = getIngestEnv()
 */

import { z } from 'zod'
import { logger } from '@/lib/obs/logger'

// Base schema: nothing required that is only available at runtime in Vercel (no FRED/INGEST at import).
// VERCEL_URL is hostname-only (e.g. myapp.vercel.app); we never validate it as full URL.
const baseSchema = z.object({
  // ===== CRITICAL (optional at build; required only when used at runtime; empty string allowed at build) =====
  FRED_API_KEY: z.string().optional(),

  // ===== PRODUCTION-REQUIRED (validated in getIngestEnv / assertCronAuth at request time) =====
  CRON_TOKEN: z.string().optional(),
  INGEST_KEY: z.string().optional(),

  // ===== DATABASE =====
  TURSO_DATABASE_URL: z.string().url().optional(),
  TURSO_AUTH_TOKEN: z.string().optional(),
  DATABASE_PATH: z.string().optional(),

  // ===== APPLICATION CONFIG =====
  APP_URL: z.string().url().default('http://localhost:3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // ===== NOTIFICATIONS =====
  NOTIFICATIONS_ENABLED: z.string().optional().default('false'),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_BOT_USERNAME: z.string().optional(),
  TELEGRAM_CHAT_ID: z.string().optional(),
  TELEGRAM_TEST_CHAT_ID: z.string().optional(),
  ENABLE_TELEGRAM_NOTIFICATIONS: z.string().optional(),
  ENABLE_TELEGRAM_TESTS: z.string().optional(),
  BYPASS_RATE_LIMIT_FOR_TESTS: z.string().optional(),
  DRY_RUN_TELEGRAM: z.string().optional(),
  USE_MESSAGE_QUEUE: z.string().optional(),

  // ===== API KEYS =====
  TRADING_ECONOMICS_API_KEY: z.string().optional(),
  TE_API_KEY: z.string().optional(),
  ALPHA_VANTAGE_API_KEY: z.string().optional(),
  ESTAT_APP_ID: z.string().optional(),
  COINMARKETCAP_API_KEY: z.string().optional(),
  FMP_API_KEY: z.string().optional(),
  FINNHUB_API_KEY: z.string().optional(),
  NEWSAPI_KEY: z.string().optional(),

  // ===== CONFIGURATION =====
  TIMEZONE: z.string().default('Europe/Madrid'),
  WEEKLY_CRON: z.string().default('Sunday 18:00'),
  GLOBAL_RATE_LIMIT_PER_MIN: z.string().default('10'),
  CHAT_RATE_LIMIT_PER_MIN: z.string().optional(),
  ENABLE_DAILY_DIGEST: z.string().optional(),
  ENABLE_WEEKLY_SCHEDULER: z.string().optional(),
  USE_LIVE_SOURCES: z.string().optional(),
  DEBUG_DASHBOARD: z.string().optional(),
  DEBUG_INDICATOR: z.string().optional(),
  LEGACY_DASHBOARD_ENABLED: z.string().optional().default('true'),

  // ===== VERCEL (VERCEL_URL is hostname only, e.g. myapp.vercel.app; do not validate as URL) =====
  VERCEL: z.string().optional(),
  VERCEL_ENV: z.enum(['production', 'preview', 'development']).optional(),
  VERCEL_URL: z.string().optional(),
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
})

const parseResult = baseSchema.safeParse(process.env)

if (!parseResult.success) {
  const errors = parseResult.error.flatten().fieldErrors
  const errorMessages = Object.entries(errors)
    .map(([key, messages]) => `  - ${key}: ${messages?.join(', ')}`)
    .join('\n')
  logger.error('Invalid environment variables', { errors })
  console.error('❌ Invalid environment variables:\n' + errorMessages)
  throw new Error(`Invalid environment variables:\n${errorMessages}`)
}

const parsed = parseResult.data

// No import-time throw for production CRON/INGEST — validated at request time in cron auth and getIngestEnv()

// Notifications: only warn at import; strict check when actually sending
if (
  (parsed.NOTIFICATIONS_ENABLED === 'true' || parsed.ENABLE_TELEGRAM_NOTIFICATIONS === 'true') &&
  (!parsed.TELEGRAM_BOT_TOKEN || (!parsed.TELEGRAM_CHAT_ID && !parsed.TELEGRAM_TEST_CHAT_ID))
) {
  logger.warn('Notifications enabled but Telegram credentials missing (will fail when sending)', {})
}

if (parsed.NODE_ENV === 'production') {
  if (!parsed.TURSO_DATABASE_URL || !parsed.TURSO_AUTH_TOKEN) {
    logger.warn('Turso not configured, using SQLite (not recommended for production)', {})
  }
  const appUrl = getAppUrl(parsed)
  if (!appUrl || appUrl.includes('localhost')) {
    logger.warn('APP_URL/SITE_URL not configured or using localhost in production', { appUrl })
  }
}

/** Resolved app URL: NEXT_PUBLIC_SITE_URL, or https://VERCEL_URL, or APP_URL */
function getAppUrl(data: z.infer<typeof baseSchema>): string | undefined {
  if (data.NEXT_PUBLIC_SITE_URL) return data.NEXT_PUBLIC_SITE_URL
  if (data.VERCEL_URL) return `https://${data.VERCEL_URL}`
  return data.APP_URL
}

export const env = {
  ...parsed,
  /** Resolved site URL for links/redirects (prefers NEXT_PUBLIC_SITE_URL, then https://VERCEL_URL, then APP_URL) */
  SITE_URL: getAppUrl(parsed),
} as const

export type Env = typeof env

export function isProduction(): boolean {
  return env.NODE_ENV === 'production'
}

export function isDevelopment(): boolean {
  return env.NODE_ENV === 'development'
}

export function isVercel(): boolean {
  return !!(env.VERCEL || env.VERCEL_ENV || env.VERCEL_URL)
}

export function isUsingTurso(): boolean {
  return !!(env.TURSO_DATABASE_URL && env.TURSO_AUTH_TOKEN)
}

export function areNotificationsEnabled(): boolean {
  return env.NOTIFICATIONS_ENABLED === 'true' || env.ENABLE_TELEGRAM_NOTIFICATIONS === 'true'
}

// ===== Runtime-only: ingest / cron =====

const ingestSchema = z.object({
  INGEST_KEY: z.string().min(1, 'INGEST_KEY is required for ingest'),
  FRED_API_KEY: z.string().min(1, 'FRED_API_KEY is required for FRED ingest'),
})

export type IngestEnv = z.infer<typeof ingestSchema>

/**
 * Call only from ingest/cron handlers. Validates INGEST_KEY and FRED_API_KEY at request time.
 * Use when the route actually needs these (e.g. FRED ingest). For events ingest (TE only) env is enough.
 */
export function getIngestEnv(): IngestEnv {
  const result = ingestSchema.safeParse(process.env)
  if (!result.success) {
    const msg = result.error.flatten().fieldErrors
    const str = Object.entries(msg)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
      .join('; ')
    throw new Error(`Invalid ingest env: ${str}`)
  }
  return result.data
}
