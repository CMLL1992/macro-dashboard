/**
 * Debug endpoint to check environment variables
 * TEMPORARY - Remove after verification
 */

import { NextResponse } from 'next/server'

export async function GET() {
  const hasTradingEconomics = !!process.env.TRADING_ECONOMICS_API_KEY
  const tradingEconomicsLength = process.env.TRADING_ECONOMICS_API_KEY?.length || 0
  const tradingEconomicsPreview = process.env.TRADING_ECONOMICS_API_KEY 
    ? `${process.env.TRADING_ECONOMICS_API_KEY.substring(0, 10)}...` 
    : 'NOT_SET'
  
  return NextResponse.json({
    TRADING_ECONOMICS_API_KEY: {
      configured: hasTradingEconomics,
      length: tradingEconomicsLength,
      preview: tradingEconomicsPreview,
      fullValue: process.env.TRADING_ECONOMICS_API_KEY || null, // Only for debugging
    },
    NODE_ENV: process.env.NODE_ENV,
    VERCEL: process.env.VERCEL,
    timestamp: new Date().toISOString(),
  })
}
