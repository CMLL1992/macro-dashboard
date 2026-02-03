/**
 * Client-side Performance Monitoring
 * 
 * Monitorea "First load budget" para /dashboard:
 * - Tamaño total JS descargado
 * - Número de requests iniciales
 * - Genera PERF_WARN_DASHBOARD si se exceden umbrales
 */

// Umbrales de "First load budget"
const FIRST_LOAD_BUDGET = {
  maxJsSizeMB: 2, // 2MB de JS total
  maxRequests: 120, // 120 requests iniciales
}

interface PerformanceMetrics {
  totalJsSizeMB: number
  totalRequests: number
  domContentLoaded: number
  load: number
  largestResource?: {
    name: string
    size: number
    type: string
  }
}

/**
 * Medir "First load budget" de /dashboard
 * Se ejecuta automáticamente al cargar la página
 */
export function measureFirstLoadBudget(): void {
  if (typeof window === 'undefined') return // Solo en cliente
  
  // Esperar a que la página cargue completamente
  if (document.readyState === 'loading') {
    window.addEventListener('load', () => {
      setTimeout(() => calculateMetrics(), 100) // Pequeño delay para capturar todos los recursos
    })
  } else {
    setTimeout(() => calculateMetrics(), 100)
  }
}

function calculateMetrics(): void {
  try {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
    if (!navigation) return

    // Obtener todos los recursos cargados
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[]
    
    // Filtrar recursos JS
    const jsResources = resources.filter(r => {
      const name = r.name.toLowerCase()
      return name.includes('.js') || name.includes('chunk') || name.includes('_next')
    })
    
    // Calcular tamaño total de JS (transferSize en bytes)
    const totalJsSizeBytes = jsResources.reduce((sum, r) => {
      // transferSize puede ser 0 si viene de cache, usar decodedBodySize como fallback
      const size = (r as any).transferSize || (r as any).decodedBodySize || 0
      return sum + size
    }, 0)
    
    const totalJsSizeMB = totalJsSizeBytes / (1024 * 1024)
    
    // Contar requests totales (excluyendo navigation)
    const totalRequests = resources.length
    
    // Encontrar el recurso más pesado
    const largestResource = resources.reduce((largest, r) => {
      const size = (r as any).transferSize || (r as any).decodedBodySize || 0
      const largestSize = (largest as any)?.transferSize || (largest as any)?.decodedBodySize || 0
      return size > largestSize ? r : largest
    }, null as PerformanceResourceTiming | null)
    
    const metrics: PerformanceMetrics = {
      totalJsSizeMB: Math.round(totalJsSizeMB * 100) / 100,
      totalRequests,
      domContentLoaded: Math.round(navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart),
      load: Math.round(navigation.loadEventEnd - navigation.loadEventStart),
      largestResource: largestResource ? {
        name: largestResource.name.split('/').pop() || largestResource.name,
        size: Math.round(((largestResource as any).transferSize || (largestResource as any).decodedBodySize || 0) / 1024),
        type: getResourceType(largestResource.name),
      } : undefined,
    }
    
    // Log metrics
    console.log('[PERF] First Load Budget:', {
      jsSizeMB: metrics.totalJsSizeMB,
      requests: metrics.totalRequests,
      domContentLoaded: `${metrics.domContentLoaded}ms`,
      load: `${metrics.load}ms`,
      largestResource: metrics.largestResource,
    })
    
    // Verificar umbrales y generar warning si se exceden
    const warnings: string[] = []
    
    if (metrics.totalJsSizeMB > FIRST_LOAD_BUDGET.maxJsSizeMB) {
      warnings.push(`JS size ${metrics.totalJsSizeMB}MB exceeds ${FIRST_LOAD_BUDGET.maxJsSizeMB}MB`)
    }
    
    if (metrics.totalRequests > FIRST_LOAD_BUDGET.maxRequests) {
      warnings.push(`Requests ${metrics.totalRequests} exceeds ${FIRST_LOAD_BUDGET.maxRequests}`)
    }
    
    if (warnings.length > 0) {
      console.warn('[PERF_WARN_DASHBOARD] First load budget exceeded:', {
        warnings,
        metrics,
      })
      
      // También enviar a backend para logging (opcional)
      try {
        fetch('/api/debug/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            level: 'warn',
            message: 'PERF_WARN_DASHBOARD: First load budget exceeded',
            meta: {
              warnings,
              metrics,
              page: '/dashboard',
            },
          }),
        }).catch(() => {
          // Ignorar errores de logging
        })
      } catch {
        // Ignorar errores
      }
    }
  } catch (error) {
    console.warn('[PERF] Error measuring first load budget:', error)
  }
}

function getResourceType(url: string): string {
  const lower = url.toLowerCase()
  if (lower.includes('.js')) return 'JS'
  if (lower.includes('.css')) return 'CSS'
  if (lower.includes('.png') || lower.includes('.jpg') || lower.includes('.jpeg') || lower.includes('.webp')) return 'Image'
  if (lower.includes('.woff') || lower.includes('.ttf')) return 'Font'
  if (lower.includes('/api/')) return 'API'
  return 'Other'
}
