'use client'

/**
 * OverviewPrefetch Component
 * 
 * OPTIMIZATION: Precarga el endpoint /api/overview al cargar la app
 * Guarda la respuesta en cache in-memory para que MacroOverviewDashboard
 * la reutilice sin hacer otro fetch.
 * 
 * Se ejecuta silenciosamente en el layout root, sin bloquear render.
 */

import { useEffect } from 'react'
import { setOverviewCache } from '@/lib/cache/overview-cache'

export default function OverviewPrefetch() {
  useEffect(() => {
    // Prefetch overview endpoint para el tab diario (el más común)
    // Guardamos en cache in-memory para que el dashboard lo reutilice
    const prefetchOverview = async () => {
      try {
        // Prefetch silencioso usando link rel=prefetch (mejor para Next.js)
        const link = document.createElement('link')
        link.rel = 'prefetch'
        link.href = '/api/overview?tf=d'
        link.as = 'fetch'
        document.head.appendChild(link)
        
        // Fetch real y guardar en cache in-memory
        // Usar setTimeout para no competir con recursos críticos del primer paint
        setTimeout(async () => {
          try {
            const response = await fetch('/api/overview?tf=d', {
              method: 'GET',
              cache: 'default', // Usar cache del browser también
            })
            
            if (response.ok) {
              const data = await response.json()
              // Guardar en cache in-memory para que el dashboard lo reutilice
              setOverviewCache('d', data)
            }
          } catch {
            // Ignorar errores en prefetch (no crítico)
          }
        }, 500) // Esperar 500ms para no competir con recursos críticos
      } catch {
        // Ignorar errores en prefetch
      }
    }

    // Ejecutar después de que la página haya cargado (no bloquea)
    // Usar setTimeout para no competir con recursos críticos
    const timeoutId = setTimeout(prefetchOverview, 100)

    return () => clearTimeout(timeoutId)
  }, [])

  // Este componente no renderiza nada
  return null
}
