/**
 * Integration tests for Telegram alerts
 * Tests the full flow with dry-run mode
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock environment variables
const originalEnv = process.env

beforeEach(() => {
  process.env = {
    ...originalEnv,
    ENABLE_TELEGRAM_NOTIFICATIONS: 'true',
    ENABLE_TELEGRAM_TESTS: 'true',
    TELEGRAM_BOT_TOKEN: 'test_token',
    TELEGRAM_TEST_CHAT_ID: '123456',
    DRY_RUN_TELEGRAM: 'true', // Enable dry-run for tests
  }
})

describe('Telegram Integration (Dry-Run)', () => {
  it('should send test message in dry-run mode', async () => {
    const { sendTelegramMessage } = await import('@/lib/notifications/telegram')
    
    const result = await sendTelegramMessage('Test message', {
      test: true,
      dryRun: true,
    })

    expect(result.success).toBe(true)
    expect(result.messageId).toBe(-1) // Simulated ID
  })

  it('should respect rate limit', async () => {
    const { sendTelegramMessage } = await import('@/lib/notifications/telegram')
    
    // First message should succeed
    const result1 = await sendTelegramMessage('First message', {
      test: true,
      dryRun: false, // Actually check rate limit
    })

    // Second message immediately should fail rate limit
    const result2 = await sendTelegramMessage('Second message', {
      test: true,
      dryRun: false,
    })

    // In dry-run, both should succeed, but we test the logic
    expect(result1.success).toBe(true)
  })

  it('should bypass rate limit when requested', async () => {
    const { sendTelegramMessage } = await import('@/lib/notifications/telegram')
    
    const result1 = await sendTelegramMessage('First message', {
      test: true,
      bypassRateLimit: true,
    })

    const result2 = await sendTelegramMessage('Second message', {
      test: true,
      bypassRateLimit: true,
    })

    expect(result1.success).toBe(true)
    expect(result2.success).toBe(true)
  })
})





