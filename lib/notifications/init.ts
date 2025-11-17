/**
 * Initialize notifications system
 * Run validation and start scheduler
 */

import { validateTelegramConfig } from './validation'
import { startWeeklyScheduler, startDailyDigestScheduler } from './scheduler'

let initialized = false
let initializationPromise: Promise<void> | null = null
let validationResult: { 
  valid: boolean
  bot_ok: boolean
  chat_ok: boolean
  errors: string[]
  warnings: string[]
  checked_at?: string
} | null = null

/**
 * Initialize notifications (call at server startup)
 */
export async function initializeNotifications(): Promise<void> {
  if (initialized) {
    return
  }

  // If initialization is in progress, wait for it
  if (initializationPromise) {
    return initializationPromise
  }

  initializationPromise = (async () => {
    console.log('[notifications] Initializing notifications system...')

    // Quick timezone test (only in development)
    if (process.env.NODE_ENV !== 'production') {
      try {
        const { testTimezoneConversion } = await import('./__test_timezone')
        testTimezoneConversion()
      } catch (error) {
        console.warn('[notifications/init] Timezone test failed (non-critical):', error)
      }
    }

    // Validate configuration
    const validation = await validateTelegramConfig()
    validationResult = validation

    if (validation.valid) {
      console.log('[notifications] ✅ Configuration valid')
      console.log('[notifications] Bot OK:', validation.bot_ok)
      console.log('[notifications] Chat OK:', validation.chat_ok)
      if (validation.warnings.length > 0) {
        console.warn('[notifications] Warnings:', validation.warnings)
      }

      // Start scheduler if enabled
      if (process.env.ENABLE_TELEGRAM_NOTIFICATIONS === 'true') {
        startWeeklyScheduler()
        console.log('[notifications] ✅ Weekly scheduler started')

        // Start daily digest scheduler (if enabled)
        startDailyDigestScheduler()
        console.log('[notifications] ✅ Daily digest scheduler started (if enabled)')
      }
    } else {
      console.error('[notifications] ❌ Configuration invalid:', validation.errors)
      console.error('[notifications] Bot OK:', validation.bot_ok)
      console.error('[notifications] Chat OK:', validation.chat_ok)
      console.error('[notifications] Notifications will be disabled')
    }

    initialized = true
  })()

  return initializationPromise
}

/**
 * Ensure notifications are initialized (call this from endpoints to force init)
 */
export async function ensureNotificationsInitialized(): Promise<void> {
  if (!initialized) {
    await initializeNotifications()
  }
}

/**
 * Get initialization status
 */
export function getInitializationStatus() {
  return {
    initialized,
    validation: validationResult,
  }
}

// Auto-initialize in server context
if (typeof window === 'undefined') {
  initializeNotifications().catch(err => {
    console.error('[notifications] Failed to initialize:', err)
  })
}

