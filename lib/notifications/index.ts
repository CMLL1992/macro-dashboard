/**
 * Notifications module entry point
 * Import this to initialize the notifications system
 */

// Initialize on import (server-side only)
if (typeof window === 'undefined') {
  import('./init').then(module => {
    module.initializeNotifications().catch(err => {
      console.error('[notifications] Failed to initialize:', err)
    })
  })
}

// Export all public APIs
export { insertNewsItem, getRecentNewsItems, type NewsItem } from './news'
export { 
  getCurrentNarrative, 
  processNewsForNarrative, 
  updateNarrative,
  type NarrativeState 
} from './narrative'
export { 
  insertCalendarEvent, 
  sendWeeklyAhead, 
  getCalendarEvents,
  type CalendarEvent 
} from './weekly'
export { sendTelegramMessage } from './telegram'
export { validateTelegramConfig, getValidationStatus } from './validation'
export { startWeeklyScheduler, stopWeeklyScheduler } from './scheduler'
export { getInitializationStatus } from './init'




