/**
 * Quick test to verify toZonedTime import works correctly
 * Run this once to confirm timezone handling is correct
 * 
 * Usage: import this in a server route and check console
 */

import { toZonedTime } from 'date-fns-tz'

// Development guard: verify import works correctly
if (process.env.NODE_ENV !== 'production') {
  if (typeof toZonedTime !== 'function') {
    throw new Error('toZonedTime import mismatch. Check date-fns/date-fns-tz versions.')
  }
}

const TIMEZONE = process.env.TIMEZONE || 'Europe/Madrid'

export function testTimezoneConversion(): void {
  try {
    const nowUTC = new Date()
    const madridNow = toZonedTime(nowUTC, TIMEZONE)
    console.log('[TIMEZONE TEST] ✅ toZonedTime works correctly')
    console.log('[TIMEZONE TEST] UTC:', nowUTC.toISOString())
    console.log('[TIMEZONE TEST] Madrid:', madridNow.toISOString())
    console.log('[TIMEZONE TEST] TIMEZONE:', TIMEZONE)
    console.log('[TIMEZONE TEST] toZonedTime type:', typeof toZonedTime)
  } catch (error) {
    console.error('[TIMEZONE TEST] ❌ Error:', error)
    throw error
  }
}

