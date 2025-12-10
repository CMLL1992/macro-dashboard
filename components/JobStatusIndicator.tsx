'use client'

import { useEffect, useState } from 'react'

type JobStatus = {
  calendar?: {
    last_success_at: string | null
    last_error_at: string | null
    status: 'ok' | 'warning' | 'error'
  }
  releases?: {
    last_success_at: string | null
    last_error_at: string | null
    status: 'ok' | 'warning' | 'error'
  }
  bias?: {
    last_updated_at: string | null
    status: 'ok' | 'warning' | 'error'
  }
}

export default function JobStatusIndicator() {
  const [status, setStatus] = useState<JobStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        console.log('[JobStatusIndicator] fetching /api/status/jobs')

        // RUTA RELATIVA - NUNCA http://localhost:3000
        const res = await fetch('/api/status/jobs', {
          method: 'GET',
          cache: 'no-store',
          credentials: 'include',
        })

        if (!res.ok) {
          throw new Error(`Status ${res.status}`)
        }

        const json = (await res.json()) as JobStatus

        if (!cancelled) {
          setStatus(json)
          setError(null)
          setLoading(false)
        }
      } catch (err) {
        console.error('[JobStatusIndicator] Error fetching status:', err)
        if (!cancelled) {
          setError('Error al cargar estado de jobs')
          setLoading(false)
        }
      }
    }

    load()
    const id = setInterval(load, 60_000)

    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  // Si hay error, mostrar mensaje discreto
  if (error) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 px-3 py-1.5 text-xs">
        <div className="h-2 w-2 rounded-full bg-red-500 dark:bg-red-400"></div>
        <span className="text-red-700 dark:text-red-300">Error cargando estado</span>
      </div>
    )
  }

  // Si está cargando, mostrar indicador discreto
  if (loading || !status) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border bg-muted px-3 py-1.5 text-xs">
        <div className="h-2 w-2 rounded-full bg-muted-foreground animate-pulse"></div>
        <span className="text-muted-foreground">Verificando estado...</span>
      </div>
    )
  }

  // Determinar estado general
  const overallStatus = 
    status.calendar?.status === 'error' || status.releases?.status === 'error' || status.bias?.status === 'error'
      ? 'error'
      : status.calendar?.status === 'warning' || status.releases?.status === 'warning' || status.bias?.status === 'warning'
      ? 'warning'
      : 'ok'

  const statusConfig = {
    ok: {
      color: 'bg-green-500',
      text: 'text-green-700',
      bg: 'bg-green-50',
      border: 'border-green-200',
      label: 'Sistema funcionando',
    },
    warning: {
      color: 'bg-yellow-500 dark:bg-yellow-400',
      text: 'text-yellow-700 dark:text-yellow-300',
      bg: 'bg-yellow-50 dark:bg-yellow-950/20',
      border: 'border-yellow-200 dark:border-yellow-800',
      label: 'Posible retraso',
    },
    error: {
      color: 'bg-red-500 dark:bg-red-400',
      text: 'text-red-700 dark:text-red-300',
      bg: 'bg-red-50 dark:bg-red-950/20',
      border: 'border-red-200 dark:border-red-800',
      label: 'Atención requerida',
    },
  }

  const config = statusConfig[overallStatus]

  return (
    <div className={`inline-flex items-center gap-2 rounded-full border ${config.border} ${config.bg} px-3 py-1.5 text-xs`}>
      <div className={`h-2 w-2 rounded-full ${config.color}`}></div>
      <span className={config.text}>{config.label}</span>
      <details className="group">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </summary>
        <div className="absolute mt-2 right-0 w-64 rounded-lg border bg-card shadow-lg p-3 z-50 text-xs space-y-2">
          <div>
            <div className="font-semibold mb-1">Calendario</div>
            <div className="text-foreground">
              {status.calendar?.last_success_at ? (
                <>
                  Último éxito: {new Date(status.calendar.last_success_at).toLocaleString('es-ES')}
                </>
              ) : (
                'Sin datos'
              )}
            </div>
            {status.calendar?.status === 'warning' && (
              <div className="text-yellow-600 dark:text-yellow-400 mt-1">⚠️ Última ejecución hace más de 24h</div>
            )}
            {status.calendar?.status === 'error' && (
              <div className="text-red-600 dark:text-red-400 mt-1">❌ Error en última ejecución</div>
            )}
          </div>
          <div>
            <div className="font-semibold mb-1">Releases</div>
            <div className="text-foreground">
              {status.releases?.last_success_at ? (
                <>
                  Último éxito: {new Date(status.releases.last_success_at).toLocaleString('es-ES')}
                </>
              ) : (
                'Sin datos'
              )}
            </div>
            {status.releases?.status === 'warning' && (
              <div className="text-yellow-600 mt-1">⚠️ Última ejecución hace más de 3 min</div>
            )}
            {status.releases?.status === 'error' && (
              <div className="text-red-600 mt-1">❌ Error en última ejecución</div>
            )}
          </div>
          <div>
            <div className="font-semibold mb-1">Bias</div>
            <div className="text-foreground">
              {status.bias?.last_updated_at ? (
                <>
                  Última actualización: {new Date(status.bias.last_updated_at).toLocaleString('es-ES')}
                </>
              ) : (
                'Sin datos'
              )}
            </div>
            {status.bias?.status === 'warning' && (
              <div className="text-yellow-600 mt-1">⚠️ Bias desactualizado respecto a último release</div>
            )}
          </div>
        </div>
      </details>
    </div>
  )
}

