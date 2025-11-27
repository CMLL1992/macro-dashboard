'use client'

import { useEffect, useState } from 'react'

export default function DashboardInitializing() {
  const [ready, setReady] = useState(false)
  const [readyCount, setReadyCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [lastHealthResponse, setLastHealthResponse] = useState<any>(null)
  const [dashboardHasData, setDashboardHasData] = useState(false)

  useEffect(() => {
    const pollHealth = async () => {
      try {
        // Check both /api/health and /api/dashboard
        const [healthRes, dashboardRes] = await Promise.all([
          fetch('/api/health', { cache: 'no-store' }).catch(() => null),
          fetch('/api/dashboard', { cache: 'no-store' }).catch(() => null),
        ])
        
        // Check if dashboard has data (this is the source of truth)
        if (dashboardRes && dashboardRes.ok) {
          try {
            const dashboardData = await dashboardRes.json()
            const hasDashboardData = dashboardData.ok === true && 
              dashboardData.data && 
              Array.isArray(dashboardData.data.items) && 
              dashboardData.data.items.length > 0
            setDashboardHasData(hasDashboardData)
            
            // If dashboard has data, we're ready regardless of health check
            if (hasDashboardData) {
              console.log('[Dashboard] Dashboard has data, allowing access')
              setReady(true)
              return
            }
          } catch (e) {
            console.warn('[Dashboard] Error parsing dashboard response:', e)
          }
        }
        
        // Fallback to health check if dashboard check failed or has no data
        if (healthRes) {
          const data = await healthRes.json()
          
          // Log de depuración
          console.log('[Dashboard] Health check state', {
            status: healthRes.status,
            ok: healthRes.ok,
            ready: data.ready,
            hasData: data.hasData,
            readyCount,
            dashboardHasData,
            dataSample: data ? Object.keys(data) : null,
          })
          
          setLastHealthResponse(data)
          
          if (!healthRes.ok) {
            // If health check fails but dashboard has data, allow access
            if (dashboardHasData) {
              console.log('[Dashboard] Health check failed but dashboard has data, allowing access')
              setReady(true)
              return
            }
            setError(`Health check failed with status ${healthRes.status}`)
            return
          }
          
          if (data.ready || data.hasData) {
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
            // Don't set error if dashboard has data
            if (!dashboardHasData) {
              setError(data.error || 'System not ready yet')
            }
          }
        } else {
          // If health check fails completely but dashboard has data, allow access
          if (dashboardHasData) {
            console.log('[Dashboard] Health check unavailable but dashboard has data, allowing access')
            setReady(true)
            return
          }
          setError('Health check unavailable')
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error('[Dashboard] Health check failed:', error)
        // If dashboard has data, don't block on health check error
        if (!dashboardHasData) {
          setError(errorMessage)
          setLastHealthResponse({ error: errorMessage })
        }
      }
    }

    // Poll every 5 seconds
    const interval = setInterval(pollHealth, 5000)
    pollHealth() // Initial check

    return () => clearInterval(interval)
  }, [dashboardHasData])

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





