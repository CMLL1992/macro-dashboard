/**
 * Server Warmup
 * 
 * OPTIMIZATION: Pre-carga módulos pesados al arrancar el servidor
 * Esto evita que la primera request pague el coste del dynamic import
 * 
 * Uso: Llamar esta función al arrancar el servidor (una sola vez)
 */

let warmedUp = false

export async function warmupServerModules() {
  if (warmedUp) {
    return // Ya se ejecutó
  }

  try {
    // Pre-cargar módulos que se usan en /api/overview
    // Esto los deja en memoria para que la primera request sea más rápida
    await Promise.all([
      import('@/lib/dashboard-data'),
      import('@/domain/macro-engine/bias'),
      import('@/lib/dashboard-time-horizon'),
    ])
    
    warmedUp = true
    console.log('[server-warmup] Módulos pre-cargados exitosamente')
  } catch (error) {
    console.warn('[server-warmup] Error al pre-cargar módulos:', error)
    // No fallar el arranque si el warmup falla
  }
}
