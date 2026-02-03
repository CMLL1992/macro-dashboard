/**
 * Telegram notification helper
 * Sends messages to Telegram via Bot API
 */

interface SendOptions {
  test?: boolean
  dryRun?: boolean
  bypassRateLimit?: boolean
  noParseMode?: boolean
  /** Override destination chat (e.g. for /api/settings/telegram/test). */
  overrideChatId?: string | number
}

// Rate limiting (10 messages per minute - MVP simple)
const GLOBAL_RATE_LIMIT_PER_MIN = parseInt(process.env.GLOBAL_RATE_LIMIT_PER_MIN || '10', 10)
const RATE_LIMIT_MS = 60 * 1000
const RATE_LIMIT_WINDOW_MS = RATE_LIMIT_MS / GLOBAL_RATE_LIMIT_PER_MIN

// Track last N message times (simple sliding window)
let messageTimes: number[] = []

function checkRateLimit(bypass: boolean): boolean {
  if (bypass) return true
  
  const now = Date.now()
  
  // Remove old entries (outside 1 minute window)
  messageTimes = messageTimes.filter(time => now - time < RATE_LIMIT_MS)
  
  // Check if we're at limit
  if (messageTimes.length >= GLOBAL_RATE_LIMIT_PER_MIN) {
    // Calculate wait time
    const oldestTime = messageTimes[0]
    const waitTime = RATE_LIMIT_MS - (now - oldestTime)
    return false // Will be handled by caller
  }
  
  // Add current time
  messageTimes.push(now)
  return true
}

function getRateLimitWaitTime(): number {
  if (messageTimes.length < GLOBAL_RATE_LIMIT_PER_MIN) return 0
  
  const now = Date.now()
  const oldestTime = messageTimes[0]
  return Math.max(0, RATE_LIMIT_MS - (now - oldestTime))
}

/**
 * Normalize chat ID - ensure it's a valid string or number
 */
function normalizeChatId(chatId: string | undefined): string | null {
  if (!chatId) return null
  
  // Remove any extra quotes or whitespace
  const cleaned = chatId.trim().replace(/^["']|["']$/g, '')
  
  // Check if it's a valid number (as string) or valid string
  if (cleaned === '' || cleaned === 'null' || cleaned === 'undefined') {
    return null
  }
  
  return cleaned
}

/**
 * Send message to Telegram
 * @param text - Message text
 * @param options - Send options (test mode, dry-run, bypass rate limit, noParseMode)
 */
export async function sendTelegramMessage(
  text: string,
  options: SendOptions = {}
): Promise<{ success: boolean; messageId?: number; error?: string; details?: string }> {
  const { test = false, dryRun = false, bypassRateLimit = false, noParseMode = false } = options

  // Check if Telegram is enabled
  if (process.env.ENABLE_TELEGRAM_NOTIFICATIONS !== 'true') {
    console.log('[TELEGRAM] Notifications disabled (ENABLE_TELEGRAM_NOTIFICATIONS != true)')
    return { success: false, error: 'Notifications disabled' }
  }

  // 2) Validate BOT TOKEN first
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token || token.trim() === '') {
    const error = 'MISSING_TELEGRAM_TOKEN'
    console.error('[TELEGRAM]', error, '- TELEGRAM_BOT_TOKEN is undefined or empty')
    return { success: false, error }
  }

  // Determine chat ID
  // IMPORTANT: If ENABLE_TELEGRAM_TESTS=true, ALWAYS use test chat (even if test=false)
  const testsEnabled = process.env.ENABLE_TELEGRAM_TESTS === 'true'
  let chatId: string | undefined

  if (options?.overrideChatId != null) {
    chatId = typeof options.overrideChatId === 'number' ? String(options.overrideChatId) : options.overrideChatId
  } else if (testsEnabled || test) {
    // Test mode: use test chat
    chatId = process.env.TELEGRAM_TEST_CHAT_ID
  } else {
    // Production mode: use production chat
    chatId = process.env.TELEGRAM_CHAT_ID
  }

  // 2) Validate CHAT ID
  const normalizedChatId = normalizeChatId(chatId)
  if (!normalizedChatId) {
    const error = 'MISSING_TELEGRAM_CHAT_ID'
    const chatType = (testsEnabled || test) ? 'TELEGRAM_TEST_CHAT_ID' : 'TELEGRAM_CHAT_ID'
    console.error('[TELEGRAM]', error, `- ${chatType} is undefined, empty, or invalid`)
    return { success: false, error }
  }

  // 6) Debugging temporal en modo test
  if (testsEnabled || test) {
    console.log('[TELEGRAM] Debug info (test mode):', {
      testChatIdPresent: !!process.env.TELEGRAM_TEST_CHAT_ID,
      testChatIdLength: process.env.TELEGRAM_TEST_CHAT_ID?.length || 0,
      tokenPresent: !!process.env.TELEGRAM_BOT_TOKEN,
      tokenLength: process.env.TELEGRAM_BOT_TOKEN?.length || 0,
      normalizedChatId,
    })
  }

  // Check rate limit (unless bypassed or dry-run)
  if (!dryRun && !checkRateLimit(bypassRateLimit || process.env.BYPASS_RATE_LIMIT_FOR_TESTS === 'true')) {
    const waitTime = Math.ceil(getRateLimitWaitTime() / 1000)
    console.warn(`[TELEGRAM] Rate limit: wait ${waitTime}s before next message`)
    return { success: false, error: `Rate limit: wait ${waitTime}s` }
  }

  // Dry-run mode: log and return without sending
  if (dryRun || process.env.DRY_RUN_TELEGRAM === 'true') {
    console.log('[TELEGRAM] DRY RUN - Would send:', {
      chatId: normalizedChatId,
      text: text.substring(0, 100) + '...',
      test: testsEnabled || test,
      noParseMode,
    })
    return { success: true, messageId: 0 }
  }

  // 3) Prepare API call - EXACT format
  const url = `https://api.telegram.org/bot${token}/sendMessage`
  const payload: any = {
    chat_id: normalizedChatId,
    text: text,
  }
  if (!noParseMode) {
    payload.parse_mode = 'Markdown'
  }

  // 1) Log request details before sending
  console.log('[TELEGRAM] Sending message:', {
    url: url.replace(token, 'TOKEN_HIDDEN'),
    chatId: normalizedChatId,
    tokenLength: token.length,
    textLength: text.length,
    test: testsEnabled || test,
    payload: {
      chat_id: normalizedChatId,
      text: text.substring(0, 50) + '...',
      parse_mode: payload.parse_mode || 'NONE',
    },
  })

  // Helper to send with timeout and one retry on network error
  async function postWithTimeoutAndRetry(): Promise<Response> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        cache: 'no-store',
        signal: controller.signal,
      })
      clearTimeout(timeout)
      return res
    } catch (e) {
      clearTimeout(timeout)
      // retry once
      const controller2 = new AbortController()
      const timeout2 = setTimeout(() => controller2.abort(), 10000)
      const res2 = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        cache: 'no-store',
        signal: controller2.signal,
      })
      clearTimeout(timeout2)
      return res2
    }
  }

  try {
    const response = await postWithTimeoutAndRetry()

    // 7) Wait for response text first
    const responseText = await response.text()
    
    // 1) Log response details
    console.log('[TELEGRAM] Response received:', {
      status: response.status,
      statusText: response.statusText,
      responseText: responseText.substring(0, 500),
      url: url.replace(token, 'TOKEN_HIDDEN'),
      chatId: normalizedChatId,
    })

    // Parse JSON response
    let responseData: any
    try {
      responseData = JSON.parse(responseText)
    } catch (parseError) {
      const error = `TELEGRAM_SEND_FAILED: Invalid JSON response from Telegram`
      console.error('[TELEGRAM]', error, {
        status: response.status,
        statusText: response.statusText,
        responseText: responseText,
        parseError: parseError instanceof Error ? parseError.message : String(parseError),
      })
      return { success: false, error, details: responseText }
    }

    // 5) Handle Telegram API errors
    if (!responseData.ok) {
      const description = responseData.description || 'Unknown Telegram error'
      const errorCode = responseData.error_code || 'UNKNOWN'
      
      // Special handling for specific Telegram errors
      let helpfulMessage = description
      if (description.includes('chat not found')) {
        helpfulMessage = `Chat not found. Solutions:
1. Send /start to your bot in Telegram
2. Verify TELEGRAM_TEST_CHAT_ID is correct (use @userinfobot to get your ID)
3. Make sure the bot token is correct
Current chat ID: ${normalizedChatId}`
      } else if (description.includes('Unauthorized') || errorCode === 401) {
        helpfulMessage = `Bot token is invalid or revoked. Solutions:
1. Go to @BotFather on Telegram
2. Send /mybots and select your bot
3. Click "API Token" → "Revoke token" (if needed) or "Edit token"
4. Copy the new token
5. Update TELEGRAM_BOT_TOKEN in .env.local
6. Restart the server (pkill -f 'next dev' && pnpm dev)
Current token length: ${token.length} characters`
      }
      
      console.error('[TELEGRAM] Telegram API error:', {
        ok: responseData.ok,
        error_code: errorCode,
        description: description,
        helpfulMessage,
        fullResponse: responseData,
        url: url.replace(token, 'TOKEN_HIDDEN'),
        chatId: normalizedChatId,
        payload: {
          chat_id: normalizedChatId,
          text: text.substring(0, 50) + '...',
          parse_mode: payload.parse_mode || 'NONE',
        },
      })
      return { success: false, error: 'TELEGRAM_SEND_FAILED', details: helpfulMessage }
    }

    // Success
    const messageId = responseData.result?.message_id
    console.log('[TELEGRAM] Message sent successfully:', {
      messageId,
      chatId: normalizedChatId,
      test: testsEnabled || test,
    })
    return { success: true, messageId }
  } catch (error) {
    // 1) Log full error details
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined
    
    console.error('[TELEGRAM] Fetch error:', {
      error: errorMessage,
      stack: errorStack,
      url: url.replace(token, 'TOKEN_HIDDEN'),
      chatId: normalizedChatId,
      payload: {
        chat_id: normalizedChatId,
        text: text.substring(0, 50) + '...',
        parse_mode: payload.parse_mode || 'NONE',
      },
      test: testsEnabled || test,
    })
    
    return { success: false, error: 'TELEGRAM_SEND_FAILED', details: errorMessage }
  }
}
