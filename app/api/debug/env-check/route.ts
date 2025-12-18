/**
 * Debug endpoint to check environment variables
 * TEMPORARY - Remove after verification
 */

import { NextResponse } from 'next/server'

export const runtime = "nodejs"

export async function GET() {
  return NextResponse.json({
    TRADING_ECONOMICS_API_KEY: { 
      configured: (process.env.TRADING_ECONOMICS_API_KEY?.length ?? 0) > 0 
    }
  })
}
