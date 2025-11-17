/**
 * Weekly scheduler for notifications
 * Runs every Sunday at 18:00 Europe/Madrid
 * 
 * SERVER-ONLY: This module should only be imported from server-side code
 */

import { sendWeeklyAhead } from './weekly'
import { sendDailyDigest } from './digest'
import { format, getDay, setHours, setMinutes, addDays } from 'date-fns'
import { toZonedTime, fromZonedTime } from 'date-fns-tz'

// Development guard: verify import works correctly
if (process.env.NODE_ENV !== 'production') {
  if (typeof toZonedTime !== 'function') {
    throw new Error('toZonedTime import mismatch. Check date-fns/date-fns-tz versions.')
  }
  if (typeof fromZonedTime !== 'function') {
    throw new Error('fromZonedTime import mismatch. Check date-fns/date-fns-tz versions.')
  }
}

const TIMEZONE = process.env.TIMEZONE || 'Europe/Madrid'
const WEEKLY_CRON = process.env.WEEKLY_CRON || 'Sunday 18:00'

let schedulerInterval: NodeJS.Timeout | null = null

/**
 * Calculate next Sunday 18:00 in Europe/Madrid
 */
function getNextWeeklyTime(): Date {
  const nowUTC = new Date()
  const madridNow = toZonedTime(nowUTC, TIMEZONE)
  
  // Get current day (0 = Sunday, 6 = Saturday)
  const currentDay = getDay(madridNow)
  
  // Calculate days until next Sunday
  let daysUntilSunday: number
  if (currentDay === 0) {
    // Today is Sunday, check if we've passed 18:00
    const currentHour = madridNow.getHours()
    const currentMinute = madridNow.getMinutes()
    if (currentHour < 18 || (currentHour === 18 && currentMinute === 0)) {
      daysUntilSunday = 0 // Today, but hasn't run yet
    } else {
      daysUntilSunday = 7 // Next Sunday
    }
  } else {
    daysUntilSunday = 7 - currentDay
  }
  
  // Next Sunday
  let nextSunday = addDays(madridNow, daysUntilSunday)
  
  // Set to 18:00
  nextSunday = setHours(nextSunday, 18)
  nextSunday = setMinutes(nextSunday, 0)
  
  // Convert back to UTC for scheduling
  const nextSundayUTC = fromZonedTime(nextSunday, TIMEZONE)
  return nextSundayUTC
}

/**
 * Start weekly scheduler
 */
/**
 * Get next daily digest time (17:00 Europe/Madrid, Mon-Fri)
 */
function getNextDailyDigestTime(): Date {
  const nowUTC = new Date()
  const madridNow = toZonedTime(nowUTC, TIMEZONE)
  
  // Target: 17:00 Madrid
  let nextDigest = setHours(setMinutes(madridNow, 0), 17)
  
  // If already past 17:00 today, move to tomorrow
  if (nextDigest <= madridNow) {
    nextDigest = addDays(nextDigest, 1)
  }
  
  // Skip weekends (Saturday = 6, Sunday = 0)
  const dayOfWeek = getDay(nextDigest)
  if (dayOfWeek === 6) { // Saturday -> Monday
    nextDigest = addDays(nextDigest, 2)
  } else if (dayOfWeek === 0) { // Sunday -> Monday
    nextDigest = addDays(nextDigest, 1)
  }
  
  // Convert back to UTC
  const nextDigestUTC = fromZonedTime(nextDigest, TIMEZONE)
  return nextDigestUTC
}

/**
 * Start daily digest scheduler
 */
export function startDailyDigestScheduler(): void {
  if (process.env.ENABLE_DAILY_DIGEST !== 'true') {
    console.log('[scheduler] Daily digest disabled (ENABLE_DAILY_DIGEST != true)')
    return
  }

  const scheduleNext = () => {
    const nextRun = getNextDailyDigestTime()
    const nowUTC = new Date()
    const msUntilNext = nextRun.getTime() - nowUTC.getTime()

    if (msUntilNext < 0) {
      // Already past, schedule for tomorrow
      setTimeout(scheduleNext, 1000)
      return
    }

    console.log(`[scheduler] Daily digest scheduled for ${nextRun.toISOString()} (${Math.round(msUntilNext / 1000 / 60)} min)`)

    setTimeout(async () => {
      try {
        await sendDailyDigest()
      } catch (error) {
        console.error('[scheduler] Daily digest error:', error)
      }
      scheduleNext() // Schedule next run
    }, msUntilNext)
  }

  scheduleNext()
}

export function startWeeklyScheduler(): void {
  if (schedulerInterval) {
    console.log('[scheduler] Weekly scheduler already running')
    return
  }

  // Check if notifications are enabled
  if (process.env.ENABLE_TELEGRAM_NOTIFICATIONS !== 'true') {
    console.log('[scheduler] Notifications disabled, skipping scheduler')
    return
  }

  console.log('[scheduler] Starting weekly scheduler (Sunday 18:00 Madrid)')

  // Calculate next run time
  const nextRun = getNextWeeklyTime()
  const nowUTC = new Date()
  const msUntilNext = nextRun.getTime() - nowUTC.getTime()

  console.log(`[scheduler] Next weekly notification scheduled for: ${format(nextRun, 'yyyy-MM-dd HH:mm')} (${Math.round(msUntilNext / 1000 / 60)} minutes)`)

  // Schedule first run
  if (msUntilNext > 0) {
    setTimeout(() => {
      runWeeklyJob()
      // Then schedule every 7 days
      schedulerInterval = setInterval(runWeeklyJob, 7 * 24 * 60 * 60 * 1000)
    }, msUntilNext)
  } else {
    // If we missed it, run now and schedule next week
    runWeeklyJob()
    schedulerInterval = setInterval(runWeeklyJob, 7 * 24 * 60 * 60 * 1000)
  }
}

/**
 * Stop weekly scheduler
 */
export function stopWeeklyScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval)
    schedulerInterval = null
    console.log('[scheduler] Weekly scheduler stopped')
  }
}

/**
 * Run weekly job
 */
async function runWeeklyJob(): Promise<void> {
  console.log('[scheduler] Running weekly ahead notification job')
  try {
    const result = await sendWeeklyAhead()
    if (result.success) {
      console.log(`[scheduler] Weekly notification sent successfully (${result.eventCount} events)`)
    } else {
      console.error(`[scheduler] Weekly notification failed: ${result.error}`)
    }
  } catch (error) {
    console.error('[scheduler] Error in weekly job:', error)
  }
}

/**
 * Initialize scheduler on module load (if in server context)
 */
if (typeof window === 'undefined') {
  // Only run in server context
  if (process.env.ENABLE_WEEKLY_SCHEDULER !== 'false') {
    startWeeklyScheduler()
  }
}

