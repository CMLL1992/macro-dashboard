/**
 * Client-side logger for UI components
 * 
 * Strategy: Opción 1 - Simple
 * - Debug logs: Only in development (NODE_ENV !== 'production')
 * - Errors: Only in development (for now, can be extended to Sentry later)
 * - Throttling: Prevents log spam in development
 * 
 * Usage:
 *   import { clientLogger } from '@/lib/obs/client-logger'
 *   
 *   // Debug (dev only)
 *   clientLogger.debug('Component mounted', { props })
 *   
 *   // Error (dev only, can extend to Sentry)
 *   clientLogger.error('Failed to fetch', { error, url })
 */

// En Next.js, process.env.NODE_ENV está disponible en el cliente
// Verificar de forma segura si estamos en desarrollo
const isDevelopment = (() => {
  try {
    if (typeof window === 'undefined') {
      // Server-side
      return process.env.NODE_ENV !== 'production'
    }
    // Client-side: Next.js inyecta NODE_ENV
    return process.env.NODE_ENV !== 'production'
  } catch {
    // Si hay error, asumir desarrollo para seguridad
    return true
  }
})()

// Throttling para evitar spam de logs (especialmente warnings repetidos)
const warnThrottle = new Map<string, number>()
const WARN_THROTTLE_MS = 5000 // Solo loguear el mismo warning cada 5 segundos

function shouldThrottleWarn(key: string): boolean {
  try {
    const now = Date.now()
    const lastLog = warnThrottle.get(key)
    
    if (!lastLog || now - lastLog > WARN_THROTTLE_MS) {
      warnThrottle.set(key, now)
      return false // No throttling, puede loguear
    }
    
    return true // Throttling activo, no loguear
  } catch (error) {
    // Si hay error en throttling, permitir loguear (fail-safe)
    return false
  }
}

export const clientLogger = {
  /**
   * Debug log - only in development
   */
  debug: (message: string, ...args: unknown[]): void => {
    if (isDevelopment) {
      console.debug(`[Client Debug] ${message}`, ...args)
    }
  },

  /**
   * Info log - only in development
   */
  info: (message: string, ...args: unknown[]): void => {
    if (isDevelopment) {
      console.info(`[Client Info] ${message}`, ...args)
    }
  },

  /**
   * Warn log - only in development, with throttling to prevent spam
   */
  warn: (message: string, ...args: unknown[]): void => {
    if (!isDevelopment || typeof window === 'undefined' || typeof console === 'undefined' || !console.warn) {
      return
    }
    
    try {
      // Crear una key única basada en el mensaje para throttling
      // Simplificado para evitar problemas con JSON.stringify
      let throttleKey = message
      if (args.length > 0) {
        const firstArg = args[0]
        if (firstArg !== null && firstArg !== undefined) {
          if (typeof firstArg === 'object') {
            // Intentar extraer propiedades clave sin JSON.stringify completo
            try {
              const keys = Object.keys(firstArg).slice(0, 3).join(',')
              throttleKey = `${message}:${keys}`
            } catch {
              // Si falla, usar solo el mensaje
              throttleKey = message
            }
          } else {
            throttleKey = `${message}:${String(firstArg).substring(0, 50)}`
          }
        }
      }
      
      if (!shouldThrottleWarn(throttleKey)) {
        console.warn(`[Client Warn] ${message}`, ...args)
      }
    } catch (error) {
      // Fail-safe: si hay error, loguear sin throttling (solo una vez)
      try {
        console.warn(`[Client Warn] ${message}`, ...args)
      } catch {
        // Si incluso esto falla, no hacer nada (evitar crash)
      }
    }
  },

  /**
   * Error log - only in development
   * TODO: Can be extended to send to Sentry/error tracking service
   */
  error: (message: string, error?: unknown, context?: Record<string, unknown>): void => {
    if (isDevelopment) {
      console.error(`[Client Error] ${message}`, error, context)
    }
    // TODO: In production, send to error tracking service (Sentry, etc.)
    // if (!isDevelopment && error) {
    //   // Sentry.captureException(error, { extra: context })
    // }
  },
}

