import { NextResponse } from 'next/server'

export async function GET() {
  if (process.env.ENABLE_TELEGRAM_TESTS !== 'true') {
    return NextResponse.json({ ok: false, error: 'TEST_MODE_DISABLED' }, { status: 403 })
  }

  return NextResponse.json({
    ok: true,
    tokenLength: process.env.TELEGRAM_BOT_TOKEN?.length || 0,
    chatId: process.env.TELEGRAM_TEST_CHAT_ID || null,
    env: process.env.NODE_ENV || 'development',
  })
}




