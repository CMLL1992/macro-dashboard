'use client'

import { useEffect, useState } from 'react'

export default function DashboardInitializing() {
  const [ready, setReady] = useState(false)
  const [readyCount, setReadyCount] = useState(0)

  useEffect(() => {
    const pollHealth = async () => {
      try {
        const res = await fetch('/api/health', { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        
        if (data.ready) {
          setReadyCount(prev => {
            const newCount = prev + 1
            // Require 2 consecutive ready=true to avoid flickering
            if (newCount >= 2) {
              setReady(true)
            }
            return newCount
          })
        } else {
          setReadyCount(0) // Reset counter if not ready
        }
      } catch (error) {
        console.error('Health check failed:', error)
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
        </div>
      </div>
    </main>
  )
}





