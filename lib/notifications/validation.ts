/**
 * Validation at startup
 * Check Telegram configuration before enabling notifications
 */

interface ValidationResult {
  valid: boolean
  bot_ok: boolean
  chat_ok: boolean
  errors: string[]
  warnings: string[]
  checked_at?: string
}

/**
 * Validate Telegram configuration
 */
export async function validateTelegramConfig(): Promise<ValidationResult> {
  const errors: string[] = []
  const warnings: string[] = []
  let bot_ok = false
  let chat_ok = false
  const checked_at = new Date().toISOString()

  // Check BOT_TOKEN
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token || token.trim() === '') {
    errors.push('TELEGRAM_BOT_TOKEN is missing or empty')
    return { valid: false, bot_ok: false, chat_ok: false, errors, warnings, checked_at }
  }

  // Check at least one CHAT_ID
  const chatId = process.env.TELEGRAM_CHAT_ID
  const testChatId = process.env.TELEGRAM_TEST_CHAT_ID
  const targetChatId = chatId || testChatId
  if (!targetChatId) {
    errors.push('At least one of TELEGRAM_CHAT_ID or TELEGRAM_TEST_CHAT_ID must be set')
    return { valid: false, bot_ok: false, chat_ok: false, errors, warnings, checked_at }
  }

  // Test bot token with getMe
  try {
    const getMeUrl = `https://api.telegram.org/bot${token}/getMe`
    const response = await fetch(getMeUrl, {
      method: 'GET',
      signal: AbortSignal.timeout(5000), // 5s timeout
    })

    if (!response.ok) {
      errors.push(`Telegram API getMe failed: ${response.status} ${response.statusText}`)
      return { valid: false, bot_ok: false, chat_ok: false, errors, warnings, checked_at }
    }

    const data = await response.json()
    if (!data.ok) {
      errors.push(`Telegram API error: ${data.description || 'Unknown error'}`)
      return { valid: false, bot_ok: false, chat_ok: false, errors, warnings, checked_at }
    }

    bot_ok = true
    console.log('[validation] ✅ Bot token valid:', data.result?.username || 'unknown')
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    if (errorMessage.includes('timeout')) {
      errors.push('Telegram API timeout - check network connectivity')
    } else {
      errors.push(`Telegram API connection failed: ${errorMessage}`)
    }
    return { valid: false, bot_ok: false, chat_ok: false, errors, warnings, checked_at }
  }

  // Test chat access with sendChatAction
  if (targetChatId) {
    try {
      const sendActionUrl = `https://api.telegram.org/bot${token}/sendChatAction`
      const actionResponse = await fetch(sendActionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: targetChatId,
          action: 'typing',
        }),
        signal: AbortSignal.timeout(5000),
      })

      if (!actionResponse.ok) {
        const actionData = await actionResponse.json()
        if (actionData.error_code === 400) {
          errors.push(`Chat ID ${targetChatId} is invalid (chat not found or bot not member)`)
        } else if (actionData.error_code === 403) {
          errors.push(`Chat ID ${targetChatId} - bot blocked or no permission`)
        } else {
          errors.push(`sendChatAction failed: ${actionData.description || 'Unknown error'}`)
        }
      } else {
        const actionData = await actionResponse.json()
        if (actionData.ok) {
          chat_ok = true
          console.log('[validation] ✅ Chat ID valid:', targetChatId)
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      errors.push(`Chat validation failed: ${errorMessage}`)
    }
  }

  // Check timezone
  const timezone = process.env.TIMEZONE || 'Europe/Madrid'
  if (timezone !== 'Europe/Madrid') {
    warnings.push(`Timezone is ${timezone}, expected Europe/Madrid`)
  }

  const valid = errors.length === 0 && bot_ok && chat_ok
  return { valid, bot_ok, chat_ok, errors, warnings, checked_at }
}

/**
 * Get validation status (cached result)
 */
let cachedValidation: ValidationResult | null = null
let validationTimestamp: number = 0
const VALIDATION_CACHE_MS = 5 * 60 * 1000 // 5 minutes

export async function getValidationStatus(forceRefresh: boolean = false): Promise<ValidationResult> {
  const now = Date.now()
  
  if (!forceRefresh && cachedValidation && (now - validationTimestamp < VALIDATION_CACHE_MS)) {
    return cachedValidation
  }

  const result = await validateTelegramConfig()
  cachedValidation = result
  validationTimestamp = now
  return result
}

// Export type for use in other modules
export type { ValidationResult }

