/**
 * Debug endpoint to check environment variables
 * TEMPORARY - Remove after verification
 */

import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    TRADING_ECONOMICS_API_KEY: {
      configured: Boolean(process.env.TRADING_ECONOMICS_API_KEY),
    },
    NODE_ENV: process.env.NODE_ENV,
    VERCEL: process.env.VERCEL,
    timestamp: new Date().toISOString(),
  })
}
