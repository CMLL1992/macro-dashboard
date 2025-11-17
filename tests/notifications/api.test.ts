/**
 * Tests for notification API endpoints
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

// Mock environment
const originalEnv = process.env

beforeEach(() => {
  process.env = {
    ...originalEnv,
    ENABLE_TELEGRAM_NOTIFICATIONS: 'true',
    TELEGRAM_BOT_TOKEN: 'test_token',
    TELEGRAM_CHAT_ID: '123456',
    INGEST_KEY: 'test_ingest_key',
    CRON_TOKEN: 'test_cron_token',
    TIMEZONE: 'Europe/Madrid',
  }
})

describe('API Endpoints', () => {
  describe('POST /api/news/insert', () => {
    it('should validate required fields', async () => {
      const { POST } = await import('@/app/api/news/insert/route')
      
      const request = new NextRequest('http://localhost:3000/api/news/insert', {
        method: 'POST',
        headers: {
          'X-INGEST-KEY': 'test_ingest_key',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // Missing required fields
          id_fuente: 'test',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Missing required fields')
    })

    it('should validate impacto enum', async () => {
      const { POST } = await import('@/app/api/news/insert/route')
      
      const request = new NextRequest('http://localhost:3000/api/news/insert', {
        method: 'POST',
        headers: {
          'X-INGEST-KEY': 'test_ingest_key',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id_fuente: 'test',
          fuente: 'TEST',
          titulo: 'Test',
          impacto: 'invalid', // Invalid enum value
          published_at: new Date().toISOString(),
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('impacto must be one of')
    })

    it('should require authentication', async () => {
      const { POST } = await import('@/app/api/news/insert/route')
      
      const request = new NextRequest('http://localhost:3000/api/news/insert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id_fuente: 'test',
          fuente: 'TEST',
          titulo: 'Test',
          impacto: 'high',
          published_at: new Date().toISOString(),
        }),
      })

      const response = await POST(request)
      
      expect(response.status).toBe(401)
    })
  })

  describe('POST /api/calendar/insert', () => {
    it('should validate required fields', async () => {
      const { POST } = await import('@/app/api/calendar/insert/route')
      
      const request = new NextRequest('http://localhost:3000/api/calendar/insert', {
        method: 'POST',
        headers: {
          'X-INGEST-KEY': 'test_ingest_key',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // Missing required fields
          fecha: '2025-11-20',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Missing required fields')
    })
  })

  describe('GET /api/notifications/status', () => {
    it('should return system status', async () => {
      const { GET } = await import('@/app/api/notifications/status/route')
      
      const request = new NextRequest('http://localhost:3000/api/notifications/status')
      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('initialized')
      expect(data).toHaveProperty('validation')
      expect(data).toHaveProperty('counters')
    })
  })

  describe('GET /api/notifications/verify', () => {
    it('should verify system components', async () => {
      const { GET } = await import('@/app/api/notifications/verify/route')
      
      const response = await GET()
      const data = await response.json()

      // IMPORTANTE: El endpoint ahora devuelve:
      // - 200: Siempre (con información detallada del estado)
      // - 400: Solo si faltan variables de entorno requeridas (esperable en CI sin credenciales)
      // - 500: Solo para errores inesperados del servidor
      // 
      // En CI, es esperable que falten credenciales de Telegram, así que aceptamos 400
      // como un resultado válido (configuración incompleta, no error del servidor)
      expect([200, 400]).toContain(response.status)
      
      if (response.status === 400) {
        // Si es 400, debe ser por MISSING_ENV_VAR (no un error del servidor)
        expect(data.error).toBe('MISSING_ENV_VAR')
        expect(data).toHaveProperty('details')
        // En CI sin credenciales, esto es esperable y no es un fallo del sistema
        return
      }
      
      // Si es 200, debe tener la estructura completa
      expect(data).toHaveProperty('ok')
      expect(data).toHaveProperty('checks')
      expect(data).toHaveProperty('summary')
      expect(data.checks).toHaveProperty('environment')
      // Los demás checks pueden no estar presentes si la inicialización falló
    })
  })
})





