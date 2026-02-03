/**
 * Environment variables validation and access
 * 
 * Centralizes all environment variable access with Zod validation.
 * Fails fast on startup if critical variables are missing.
 * 
 * Usage:
 *   import { env } from '@/lib/env'
 *   const apiKey = env.FRED_API_KEY // Type-safe, always valid
 */

import { z } from 'zod'
import { logger } from '@/lib/obs/logger'

// Schema for environment variables
const envSchema = z.object({
  // ===== CRITICAL VARIABLES (required) =====
  FRED_API_KEY: z.string().min(1, 'FRED_API_KEY is required'),
  
  // ===== PRODUCTION-REQUIRED (validated separately) =====
  CRON_TOKEN: z.string().min(1).optional(),
  INGEST_KEY: z.string().min(1).optional(),
  
  // ===== DATABASE (optional, fallback to SQLite) =====
  TURSO_DATABASE_URL: z.string().url().optional(),
  TURSO_AUTH_TOKEN: z.string().optional(),
  DATABASE_PATH: z.string().optional(),
  
  // ===== APPLICATION CONFIG =====
  APP_URL: z.string().url().default('http://localhost:3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  // ===== NOTIFICATIONS =====
  NOTIFICATIONS_ENABLED: z.string().optional().default('false'),
  // ===== TELEGRAM (optional, but required if NOTIFICATIONS_ENABLED=true) =====
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_BOT_USERNAME: z.string().optional(), // e.g. MyMacroBot (sin @) para deep link t.me/<bot>
  TELEGRAM_CHAT_ID: z.string().optional(),
  TELEGRAM_TEST_CHAT_ID: z.string().optional(),
  ENABLE_TELEGRAM_NOTIFICATIONS: z.string().optional(), // Legacy, use NOTIFICATIONS_ENABLED
  ENABLE_TELEGRAM_TESTS: z.string().optional(),
  BYPASS_RATE_LIMIT_FOR_TESTS: z.string().optional(),
  DRY_RUN_TELEGRAM: z.string().optional(),
  USE_MESSAGE_QUEUE: z.string().optional(),
  
  // ===== API KEYS (optional) =====
  TRADING_ECONOMICS_API_KEY: z.string().optional(),
  TE_API_KEY: z.string().optional(), // Alias for TRADING_ECONOMICS_API_KEY (legacy)
  ALPHA_VANTAGE_API_KEY: z.string().optional(),
  ESTAT_APP_ID: z.string().optional(), // Japan e-Stat API
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
  
  // ===== DASHBOARD MIGRATION =====
  // If false, legacy dashboard sections (indicators table, tactical rows, scenarios) are hidden
  // Default: true in dev (for gradual migration), false in prod/preview (snapshot-only)
  LEGACY_DASHBOARD_ENABLED: z.string().optional().default('true'),
  
  // ===== VERCEL AUTOMATIC =====
  VERCEL: z.string().optional(),
  VERCEL_ENV: z.enum(['production', 'preview', 'development']).optional(),
  VERCEL_URL: z.string().url().optional(),
})

// Parse and validate
const parseResult = envSchema.safeParse(process.env)

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

// Additional validation for production
if (parsed.NODE_ENV === 'production') {
  if (!parsed.CRON_TOKEN) {
    logger.error('CRON_TOKEN is required in production', {})
    throw new Error('CRON_TOKEN is required in production')
  }
  if (!parsed.INGEST_KEY) {
    logger.error('INGEST_KEY is required in production', {})
    throw new Error('INGEST_KEY is required in production')
  }
}

// Additional validation for notifications
// If NOTIFICATIONS_ENABLED=true, require Telegram credentials
const notificationsEnabled = parsed.NOTIFICATIONS_ENABLED === 'true' || parsed.ENABLE_TELEGRAM_NOTIFICATIONS === 'true'
if (notificationsEnabled) {
  if (!parsed.TELEGRAM_BOT_TOKEN) {
    logger.error('TELEGRAM_BOT_TOKEN is required when NOTIFICATIONS_ENABLED=true', {})
    throw new Error('TELEGRAM_BOT_TOKEN is required when NOTIFICATIONS_ENABLED=true')
  }
  if (!parsed.TELEGRAM_CHAT_ID && !parsed.TELEGRAM_TEST_CHAT_ID) {
    logger.error('At least one of TELEGRAM_CHAT_ID or TELEGRAM_TEST_CHAT_ID is required when NOTIFICATIONS_ENABLED=true', {})
    throw new Error('At least one of TELEGRAM_CHAT_ID or TELEGRAM_TEST_CHAT_ID is required when NOTIFICATIONS_ENABLED=true')
  }
}

// Log warnings for missing optional but recommended variables
if (parsed.NODE_ENV === 'production') {
  if (!parsed.TURSO_DATABASE_URL || !parsed.TURSO_AUTH_TOKEN) {
    logger.warn('Turso not configured, using SQLite (not recommended for production)', {})
  }
  if (!parsed.APP_URL || parsed.APP_URL.includes('localhost')) {
    logger.warn('APP_URL not configured or using localhost in production', { appUrl: parsed.APP_URL })
  }
}

// Export validated environment
export const env = parsed

// Type export for convenience
export type Env = typeof env

// Helper functions
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

