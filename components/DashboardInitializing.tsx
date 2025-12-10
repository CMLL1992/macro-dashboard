'use client'

import React, { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

interface DashboardInitializingProps {
  initialHasData?: boolean
}

export default function DashboardInitializing({ initialHasData }: DashboardInitializingProps = {}) {
  const router = useRouter()
  const [ready, setReady] = useState(initialHasData ?? false)
  const [readyCount, setReadyCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [lastHealthResponse, setLastHealthResponse] = useState<any>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const readyRef = useRef(initialHasData ?? false)
  const hasRefreshed = useRef(false)

  useEffect(() => {
    // Si initialHasData es true, no hacer polling
    if (initialHasData) {
      readyRef.current = true
      setReady(true)
      return
    }

    // Solo si initialHasData es false inicia el bucle de comprobaciones
    const pollHealth = async () => {
      // Si ya está ready, no hacer nada
      if (readyRef.current) {
        return
      }

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
        if (hasDashboardData && !readyRef.current) {
          console.log('[DashboardInitializing] Dashboard has data, allowing access immediately')
          readyRef.current = true
          setReady(true)
          // Stop polling
          if (intervalRef.current) {
            clearInterval(intervalRef.current)
            intervalRef.current = null
          }
          return
        }

        // Solo si NO hay datos en el dashboard, usa el health
        if (healthRes && healthRes.ok) {
          const health = await healthRes.json()
          
          console.log('[DashboardInitializing] health =', health, 'hasDashboardData =', hasDashboardData)
          
          setLastHealthResponse(health)

          if (health?.ready || health?.hasData) {
            // Si health también tiene datos, permitir acceso inmediatamente
            if (health?.hasData && health?.observationCount > 0 && !readyRef.current) {
              console.log('[DashboardInitializing] Health has data, allowing access immediately')
              readyRef.current = true
              setReady(true)
              // Stop polling
              if (intervalRef.current) {
                clearInterval(intervalRef.current)
                intervalRef.current = null
              }
              return
            }
            
            setReadyCount(prev => {
              const newCount = prev + 1
              // Require 2 consecutive ready=true to avoid flickering (solo si no hay datos explícitos)
              if (newCount >= 2 && !readyRef.current) {
                readyRef.current = true
                setReady(true)
                // Stop polling
                if (intervalRef.current) {
                  clearInterval(intervalRef.current)
                  intervalRef.current = null
                }
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
    intervalRef.current = setInterval(() => {
      // Only poll if not ready
      if (!readyRef.current) {
        pollHealth()
      } else {
        // Stop polling if ready
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
          intervalRef.current = null
        }
      }
    }, 5000)
    
    // Initial check
    pollHealth()

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [initialHasData])

  // When ready, refresh the router to revalidate data without full page reload
  useEffect(() => {
    if (ready && !hasRefreshed.current) {
      hasRefreshed.current = true
      // Use router.refresh() to revalidate server components without full reload
      // This prevents flickering
      const timer = setTimeout(() => {
        router.refresh()
      }, 2000) // Longer delay to prevent rapid refreshes
      
      return () => clearTimeout(timer)
    }
  }, [ready, router])

  if (ready) {
    // Show a brief "redirecting" message instead of immediately reloading
    return (
      <main className="p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="rounded-lg border bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800 p-6 text-green-900 dark:text-green-200">
            <h1 className="text-xl font-semibold">Datos listos</h1>
            <p className="mt-2 text-sm">Cargando dashboard...</p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="rounded-lg border bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800 p-6 text-yellow-900 dark:text-yellow-200">
          <h1 className="text-xl font-semibold">Inicializando datos…</h1>
          <p className="mt-2 text-sm">
            Estamos preparando la base de datos y recalculando correlaciones y sesgos. 
            La página se actualizará automáticamente.
          </p>
          <div className="mt-4 flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-yellow-500 dark:bg-yellow-400 animate-pulse"></div>
            <span className="text-xs">Verificando estado del sistema...</span>
          </div>
          {error && (
            <div className="mt-4 rounded-lg border bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800 p-4 text-red-800 dark:text-red-300">
              <p className="font-semibold">Error en health check:</p>
              <p className="text-sm mt-1">{error}</p>
              {lastHealthResponse && (
                <pre className="text-xs mt-2 overflow-auto bg-red-100 dark:bg-red-900/30 p-2 rounded">
                  {JSON.stringify(lastHealthResponse, null, 2)}
                </pre>
              )}
            </div>
          )}
          <div className="mt-4 text-xs text-muted-foreground">
            <p>Ready count: {readyCount}/2</p>
            <p>Last response: {lastHealthResponse ? 'Received' : 'Waiting...'}</p>
          </div>
        </div>
      </div>
    </main>
  )
}
