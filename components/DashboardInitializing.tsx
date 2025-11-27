'use client'

import { useEffect, useState } from 'react'

interface DashboardInitializingProps {
  initialHasData?: boolean
}

export default function DashboardInitializing({ initialHasData }: DashboardInitializingProps = {}) {
  const [ready, setReady] = useState(initialHasData ?? false)
  const [readyCount, setReadyCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [lastHealthResponse, setLastHealthResponse] = useState<any>(null)

  useEffect(() => {
    // Si initialHasData es true, no hacer polling
    if (initialHasData) {
      setReady(true)
      return
    }

    // Solo si initialHasData es false inicia el bucle de comprobaciones
    const pollHealth = async () => {
      try {
        // Check both /api/health and /api/dashboard
        const [healthRes, dashboardRes] = await Promise.all([
          fetch('/api/health', { cache: 'no-store' }).catch(() => null),
          fetch('/api/dashboard', { cache: 'no-store' }).catch(() => null),
        ])

        // Check if dashboard has data (this is the source of truth)
        let hasDashboardData = false
        if (dashboardRes && dashboardRes.ok) {
          try {
            const dash = await dashboardRes.json()
            hasDashboardData =
              (dash?.ok && dash?.data?.items && Array.isArray(dash.data.items) && dash.data.items.length > 0) ||
              (dash?.items && Array.isArray(dash.items) && dash.items.length > 0)
          } catch (e) {
            console.warn('[Dashboard] Error parsing dashboard response:', e)
          }
        }

        // Si el dashboard tiene datos, desbloquear SIEMPRE, aunque health.ready sea false
        if (hasDashboardData) {
          console.log('[DashboardInitializing] Dashboard has data, allowing access')
          setReady(true)
          return
        }

        // Solo si NO hay datos en el dashboard, usa el health
        if (healthRes && healthRes.ok) {
          const health = await healthRes.json()
          
          console.log('[DashboardInitializing] health =', health, 'hasDashboardData =', hasDashboardData)
          
          setLastHealthResponse(health)

          if (health?.ready || health?.hasData) {
            setReadyCount(prev => {
              const newCount = prev + 1
              // Require 2 consecutive ready=true to avoid flickering
              if (newCount >= 2) {
                setReady(true)
              }
              return newCount
            })
            setError(null) // Clear error on success
          } else {
            setReadyCount(0) // Reset counter if not ready
            setError(health?.error || 'System not ready yet')
          }
        } else {
          setError('Health check unavailable')
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error('[Dashboard] Health check failed:', error)
        setError(errorMessage)
        setLastHealthResponse({ error: errorMessage })
      }
    }

    // Poll every 5 seconds
    const interval = setInterval(pollHealth, 5000)
    pollHealth() // Initial check

    return () => clearInterval(interval)
  }, [initialHasData])

  if (ready) {
    // Reload page when ready
    window.location.reload()
    return null
  }

  return (
    <main className="p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="rounded-lg border bg-yellow-50 p-6 text-yellow-900">
          <h1 className="text-xl font-semibold">Inicializando datos…</h1>
          <p className="mt-2 text-sm">
            Estamos preparando la base de datos y recalculando correlaciones y sesgos. 
            La página se actualizará automáticamente.
          </p>
          <div className="mt-4 flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse"></div>
            <span className="text-xs">Verificando estado del sistema...</span>
          </div>
          {error && (
            <div className="mt-4 rounded-lg border bg-red-50 p-4 text-red-800">
              <p className="font-semibold">Error en health check:</p>
              <p className="text-sm mt-1">{error}</p>
              {lastHealthResponse && (
                <pre className="text-xs mt-2 overflow-auto">
                  {JSON.stringify(lastHealthResponse, null, 2)}
                </pre>
              )}
            </div>
          )}
          <div className="mt-4 text-xs text-gray-600">
            <p>Ready count: {readyCount}/2</p>
            <p>Last response: {lastHealthResponse ? 'Received' : 'Waiting...'}</p>
          </div>
        </div>
      </div>
    </main>
  )
}





