'use client'

import { useEffect, useState } from 'react'

export default function DashboardInitializing() {
  const [ready, setReady] = useState(false)
  const [readyCount, setReadyCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [lastHealthResponse, setLastHealthResponse] = useState<any>(null)

  useEffect(() => {
    const pollHealth = async () => {
      try {
        const res = await fetch('/api/health', { cache: 'no-store' })
        const data = await res.json()
        
        // Log de depuración
        console.log('[Dashboard] Health check state', {
          status: res.status,
          ok: res.ok,
          ready: data.ready,
          hasData: data.hasData,
          readyCount,
          dataSample: data ? Object.keys(data) : null,
        })
        
        setLastHealthResponse(data)
        
        if (!res.ok) {
          setError(`Health check failed with status ${res.status}`)
          return
        }
        
        if (data.ready) {
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
          setError(data.error || 'System not ready yet')
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
  }, [])

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





