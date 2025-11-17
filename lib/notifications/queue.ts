/**
 * Advanced message queue with priorities and rate limiting
 * Supports global and per-chat rate limits
 */

import { getDB } from '@/lib/db/schema'

export type MessagePriority = 'high' | 'normal' | 'low'

export interface QueuedMessage {
  id: string
  text: string
  chatId: string
  priority: MessagePriority
  type: 'news' | 'narrative' | 'weekly' | 'narrative_weekly' | 'other'
  createdAt: number
  retries: number
  maxRetries: number
}

// Rate limiting configuration
const GLOBAL_RATE_LIMIT_PER_MIN = parseInt(process.env.GLOBAL_RATE_LIMIT_PER_MIN || '30', 10)
const CHAT_RATE_LIMIT_PER_MIN = parseInt(process.env.CHAT_RATE_LIMIT_PER_MIN || '5', 10)
const RATE_LIMIT_MS = 60 * 1000

// Global message tracking
interface MessageTime {
  timestamp: number
  chatId: string
}

let globalMessageTimes: number[] = []
let chatMessageTimes: Map<string, number[]> = new Map()

// Message queue (in-memory, can be persisted to DB if needed)
let messageQueue: QueuedMessage[] = []
let processingQueue = false

/**
 * Check global rate limit
 */
function checkGlobalRateLimit(): boolean {
  const now = Date.now()
  globalMessageTimes = globalMessageTimes.filter(time => now - time < RATE_LIMIT_MS)
  return globalMessageTimes.length < GLOBAL_RATE_LIMIT_PER_MIN
}

/**
 * Check per-chat rate limit
 */
function checkChatRateLimit(chatId: string): boolean {
  const now = Date.now()
  const chatTimes = chatMessageTimes.get(chatId) || []
  const filtered = chatTimes.filter(time => now - time < RATE_LIMIT_MS)
  chatMessageTimes.set(chatId, filtered)
  return filtered.length < CHAT_RATE_LIMIT_PER_MIN
}

/**
 * Record message sent
 */
function recordMessageSent(chatId: string): void {
  const now = Date.now()
  globalMessageTimes.push(now)
  
  const chatTimes = chatMessageTimes.get(chatId) || []
  chatTimes.push(now)
  chatMessageTimes.set(chatId, chatTimes)
}

/**
 * Get wait time for global rate limit
 */
function getGlobalWaitTime(): number {
  if (globalMessageTimes.length < GLOBAL_RATE_LIMIT_PER_MIN) return 0
  
  const now = Date.now()
  const oldestTime = globalMessageTimes[0]
  return Math.max(0, RATE_LIMIT_MS - (now - oldestTime))
}

/**
 * Get wait time for chat rate limit
 */
function getChatWaitTime(chatId: string): number {
  const chatTimes = chatMessageTimes.get(chatId) || []
  if (chatTimes.length < CHAT_RATE_LIMIT_PER_MIN) return 0
  
  const now = Date.now()
  const oldestTime = chatTimes[0]
  return Math.max(0, RATE_LIMIT_MS - (now - oldestTime))
}

/**
 * Add message to queue
 */
export function enqueueMessage(
  text: string,
  chatId: string,
  priority: MessagePriority = 'normal',
  type: QueuedMessage['type'] = 'other'
): string {
  const id = `${Date.now()}-${Math.random().toString(36).substring(7)}`
  const message: QueuedMessage = {
    id,
    text,
    chatId,
    priority,
    type,
    createdAt: Date.now(),
    retries: 0,
    maxRetries: 3,
  }

  // Insert based on priority (high priority at front)
  if (priority === 'high') {
    // Find first non-high priority message
    const firstNormalIndex = messageQueue.findIndex(m => m.priority !== 'high')
    if (firstNormalIndex === -1) {
      messageQueue.push(message)
    } else {
      messageQueue.splice(firstNormalIndex, 0, message)
    }
  } else {
    messageQueue.push(message)
  }

  // Start processing if not already running
  if (!processingQueue) {
    processQueue().catch(err => {
      console.error('[queue] Error processing queue:', err)
    })
  }

  return id
}

/**
 * Process queue (async, runs continuously)
 */
async function processQueue(): Promise<void> {
  if (processingQueue) return
  processingQueue = true

  while (messageQueue.length > 0) {
    // Get next message (prioritized)
    const message = messageQueue.shift()
    if (!message) break

    // Check rate limits
    const globalOk = checkGlobalRateLimit()
    const chatOk = checkChatRateLimit(message.chatId)

    if (!globalOk || !chatOk) {
      // Calculate wait time
      const globalWait = getGlobalWaitTime()
      const chatWait = getChatWaitTime(message.chatId)
      const waitTime = Math.max(globalWait, chatWait)

      if (waitTime > 0) {
        // Re-insert at front (maintain priority)
        messageQueue.unshift(message)
        await new Promise(resolve => setTimeout(resolve, waitTime))
        continue
      }
    }

    // Send message (import dynamically to avoid circular deps)
    try {
      const { sendTelegramMessage } = await import('./telegram')
      const result = await sendTelegramMessage(message.text, {
        bypassRateLimit: true, // We handle rate limiting here
        noParseMode: true,
      })

      if (result.success) {
        recordMessageSent(message.chatId)
        
        // Update metrics
        const { incrementMetric } = await import('./metrics')
        incrementMetric('notification_sent_total', JSON.stringify({ type: message.type, status: 'sent' }))
        
        // Log success
        try {
          const db = getDB()
          db.prepare(`
            INSERT INTO notification_history (tipo, mensaje, status, sent_at, created_at)
            VALUES (?, ?, ?, ?, ?)
          `).run(
            message.type,
            message.text.substring(0, 200),
            'sent',
            new Date().toISOString(),
            new Date().toISOString()
          )
        } catch (err) {
          console.warn('[queue] Could not log to notification_history:', err)
        }
      } else {
        // Retry logic
        if (message.retries < message.maxRetries) {
          message.retries++
          messageQueue.unshift(message) // Re-insert at front
          await new Promise(resolve => setTimeout(resolve, 2000)) // Wait 2s before retry
        } else {
          // Max retries reached, log failure
          console.error(`[queue] Message ${message.id} failed after ${message.maxRetries} retries`)
          
          // Update metrics
          const { incrementMetric } = await import('./metrics')
          incrementMetric('notification_sent_total', JSON.stringify({ type: message.type, status: 'failed' }))
          
          try {
            const db = getDB()
            db.prepare(`
              INSERT INTO notification_history (tipo, mensaje, status, error, created_at)
              VALUES (?, ?, ?, ?, ?)
            `).run(
              message.type,
              message.text.substring(0, 200),
              'failed',
              result.error || 'Max retries exceeded',
              new Date().toISOString()
            )
          } catch (err) {
            console.warn('[queue] Could not log failure:', err)
          }
        }
      }
    } catch (error) {
      console.error(`[queue] Error sending message ${message.id}:`, error)
      // Retry on error
      if (message.retries < message.maxRetries) {
        message.retries++
        messageQueue.unshift(message)
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }

    // Small delay between messages to avoid overwhelming
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  processingQueue = false
}

/**
 * Get queue status
 */
export function getQueueStatus(): {
  queueLength: number
  globalRateLimit: { used: number; limit: number; waitTime: number }
  chatRateLimits: Array<{ chatId: string; used: number; limit: number; waitTime: number }>
} {
  const now = Date.now()
  globalMessageTimes = globalMessageTimes.filter(time => now - time < RATE_LIMIT_MS)
  
  const chatLimits: Array<{ chatId: string; used: number; limit: number; waitTime: number }> = []
  for (const [chatId, times] of chatMessageTimes.entries()) {
    const filtered = times.filter(time => now - time < RATE_LIMIT_MS)
    chatMessageTimes.set(chatId, filtered)
    chatLimits.push({
      chatId,
      used: filtered.length,
      limit: CHAT_RATE_LIMIT_PER_MIN,
      waitTime: getChatWaitTime(chatId),
    })
  }

  return {
    queueLength: messageQueue.length,
    globalRateLimit: {
      used: globalMessageTimes.length,
      limit: GLOBAL_RATE_LIMIT_PER_MIN,
      waitTime: getGlobalWaitTime(),
    },
    chatRateLimits: chatLimits,
  }
}

/**
 * Clear queue (for testing/admin)
 */
export function clearQueue(): void {
  messageQueue = []
  globalMessageTimes = []
  chatMessageTimes.clear()
}

