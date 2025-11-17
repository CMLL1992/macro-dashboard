/**
 * Test endpoint for Telegram alerts
 * POST /api/alerts/test
 * 
 * Sends a test message to verify Telegram configuration
 * Accepts requests from Admin panel (same-origin) when ENABLE_TELEGRAM_TESTS=true
 */

import { NextRequest, NextResponse } from 'next/server'
import { sendTelegramMessage } from '@/lib/notifications/telegram'

const isProduction = process.env.NODE_ENV === 'production'

function isAuthenticatedFromAdmin(req: NextRequest): boolean {
  const origin = req.headers.get('origin')
  const referer = req.headers.get('referer')
  const host = req.headers.get('host')
  
  // Debug logging (only in development)
  if (process.env.NODE_ENV === 'development') {
    console.log('[API/TEST] Auth check:', {
      origin,
      referer,
      host,
      originMatches: origin && host ? new URL(origin).host === host : 'N/A',
      refererHasAdmin: referer ? referer.includes('/admin') : 'N/A',
    })
  }
  
  // In development, be more lenient - just check if referer exists and includes /admin
  // or if origin matches host (same-origin request)
  if (process.env.NODE_ENV === 'development') {
    // Allow if referer includes /admin
    if (referer && referer.includes('/admin')) {
      return true
    }
    // Allow if origin matches host (same-origin)
    if (origin && host) {
      try {
        const originHost = new URL(origin).host
        if (originHost === host) {
          return true
        }
      } catch (e) {
        // Invalid origin URL, continue to other checks
      }
    }
    // In development, if no referer/origin, allow localhost requests
    if (host && (host.includes('localhost') || host.includes('127.0.0.1'))) {
      return true
    }
  }
  
  // Production: stricter checks
  if (origin && host) {
    try {
      const originHost = new URL(origin).host
      if (originHost !== host) return false
    } catch (e) {
      return false
    }
  }
  if (referer && !referer.includes('/admin')) return false
  
  return true
}

export async function POST(request: NextRequest) {
  try {
    console.log('[API/TEST] Request received')
    
    if (process.env.ENABLE_TELEGRAM_TESTS !== 'true') {
      console.log('[API/TEST] Test mode disabled')
      return NextResponse.json({ ok: false, error: 'TEST_MODE_DISABLED' }, { status: 403 })
    }

    const authResult = isAuthenticatedFromAdmin(request)
    console.log('[API/TEST] Auth result:', authResult)
    
    if (!authResult) {
      console.log('[API/TEST] Authentication failed')
      return NextResponse.json({ ok: false, error: 'NOT_AUTHENTICATED' }, { status: 401 })
    }
    
    console.log('[API/TEST] Authentication passed')

    if (isProduction && !process.env.TELEGRAM_TEST_CHAT_ID) {
      return NextResponse.json({ ok: false, error: 'TEST_CHAT_MISSING' }, { status: 403 })
    }

    // Plain text without Markdown for test
    const testText = 'OK desde CM11 Trading'

    // Extra debug (test only)
    console.log('[API/TEST] ENV debug:', {
      env: process.env.NODE_ENV,
      tokenLength: process.env.TELEGRAM_BOT_TOKEN?.length || 0,
      tokenPresent: !!process.env.TELEGRAM_BOT_TOKEN,
      chatId: process.env.TELEGRAM_TEST_CHAT_ID || 'N/A',
      chatIdPresent: !!process.env.TELEGRAM_TEST_CHAT_ID,
      enableTests: process.env.ENABLE_TELEGRAM_TESTS,
      enableNotifications: process.env.ENABLE_TELEGRAM_NOTIFICATIONS,
    })

    const result = await sendTelegramMessage(testText, {
      test: true,
      bypassRateLimit: true,
      noParseMode: true,
    })
    
    console.log('[API/TEST] sendTelegramMessage result:', result)

    if (result.success) {
      return NextResponse.json({ ok: true, messageId: result.messageId })
    }

    // Propagate details from Telegram
    return NextResponse.json(
      { ok: false, error: 'TELEGRAM_SEND_FAILED', details: result.details || result.error || 'Unknown' },
      { status: 500 }
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined
    console.error('[API/TEST] Exception:', {
      error: errorMessage,
      stack: errorStack,
    })
    return NextResponse.json(
      { ok: false, error: 'INTERNAL_ERROR', details: errorMessage },
      { status: 500 }
    )
  }
}
