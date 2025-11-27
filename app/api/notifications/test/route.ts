/**
 * POST /api/notifications/test
 * Send a test notification message
 * Allows same-origin requests from the notifications page
 */

import { NextRequest, NextResponse } from 'next/server'
import { sendTelegramMessage } from '@/lib/notifications/telegram'
import { validateCronToken } from '@/lib/security/token'
import { validateIngestKeyWithError } from '@/lib/security/ingest'

function isSameOriginRequest(request: NextRequest): boolean {
  const origin = request.headers.get('origin')
  const referer = request.headers.get('referer')
  const host = request.headers.get('host')
  
  // Allow if origin matches host (same-origin request)
  if (origin && host) {
    try {
      const originHost = new URL(origin).host
      if (originHost === host) {
        return true
      }
    } catch (e) {
      // Invalid origin URL
    }
  }
  
  // Allow if referer includes /notificaciones
  if (referer && referer.includes('/notificaciones')) {
    return true
  }
  
  // In development, allow localhost requests
  if (host && (host.includes('localhost') || host.includes('127.0.0.1'))) {
    return true
  }
  
  return false
}

export async function POST(request: NextRequest) {
  // Allow same-origin requests from notifications page (no auth required)
  const isSameOrigin = isSameOriginRequest(request)
  
  // If not same-origin, require auth
  if (!isSameOrigin) {
    const ingestValid = validateIngestKeyWithError(request)
    const cronValid = process.env.NODE_ENV !== 'production' && process.env.ENABLE_TELEGRAM_TESTS === 'true'
      ? validateCronToken(request)
      : false

    if (!ingestValid.valid && !cronValid) {
      return NextResponse.json(
        { error: ingestValid.error || 'Unauthorized' },
        { status: 401 }
      )
    }
  }

  try {
    const now = new Date()
    const timestamp = now.toLocaleString('es-ES', { 
      timeZone: 'Europe/Madrid',
      dateStyle: 'short',
      timeStyle: 'short'
    })
    
    const testMessage = `🧪 Mensaje de Prueba - CM11 Trading

Este es un mensaje de prueba para verificar que las notificaciones de Telegram funcionan correctamente.

✅ Si recibes este mensaje, significa que:
- El bot está configurado correctamente
- El Chat ID es válido
- Las notificaciones están funcionando

📅 Enviado: ${timestamp}
🕐 Timestamp: ${now.toISOString()}`

    const result = await sendTelegramMessage(testMessage, { noParseMode: true })

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Mensaje de prueba enviado correctamente',
        messageId: result.messageId,
        timestamp: now.toISOString(),
      })
    } else {
      return NextResponse.json({
        success: false,
        error: result.error || 'Error desconocido',
        details: result.details,
      }, { status: 500 })
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    )
  }
}




