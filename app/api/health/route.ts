import { NextRequest, NextResponse } from 'next/server'
// Initialize notifications system on first health check
import { ensureNotificationsInitialized } from '@/lib/notifications/init'
import { checkMacroDataHealth } from '@/lib/db/read-macro'
import { isDbReady, getBootstrapTimestamp, getBootstrapStartedAt, isBootstrapLocked, getFallbackCount } from '@/lib/runtime/state'

export async function GET(request: NextRequest) {
  // Force notifications initialization
  await ensureNotificationsInitialized()
  const health = checkMacroDataHealth()
  const ready = health.hasObservations && health.hasBias && isDbReady()
  
  return NextResponse.json({
    ready,
    observationCount: health.observationCount,
    biasCount: health.biasCount,
    correlationCount: health.correlationCount,
    latestDate: health.latestDate,
    db_ready: isDbReady(),
    bootstrap_timestamp: getBootstrapTimestamp(),
    bootstrap_locked: isBootstrapLocked(),
    bootstrap_started_at: getBootstrapStartedAt(),
    fallback_count: getFallbackCount(),
  })
}
