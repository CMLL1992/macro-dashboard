'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { safeArray, isFiniteNumber, safeDate } from '@/lib/utils/guards'

interface RunStatus {
  runId: string
  job: string
  country?: string
  status: 'running' | 'complete' | 'error'
  startTime: number
  durationMs?: number
  summary?: {
    ingested: number
    failed: number
    notMigrated: number
    notAvailable: number
    total: number
    circuitBreakerState?: {
      oecd?: {
        isOpen: boolean
        failures: number
        timeoutMs?: number
      }
      [key: string]: {
        isOpen: boolean
        failures: number
        timeoutMs?: number
      } | undefined
    }
  }
  error?: string
}

interface SystemEvent {
  timestamp: number
  level: 'info' | 'warn' | 'error' | 'debug'
  message: string
  meta?: {
    job?: string
    country?: string
    indicatorId?: string
    runId?: string
    [key: string]: any
  }
}

interface IndicatorError {
  indicatorId: string
  country: string
  status: 'failed' | 'not_available' | 'not_migrated'
  errorType: string
  message: string
  lastRun?: string
}

interface IndicatorOK {
  indicatorId: string
  lastValue: number | null
  date: string | null
  source: string
  status: string
  lastUpdated: string | null
}

export default function ProgramacionPage() {
  const [runStatus, setRunStatus] = useState<RunStatus | null>(null)
  const [events, setEvents] = useState<SystemEvent[]>([])
  const [errors, setErrors] = useState<IndicatorError[]>([])
  const [indicatorsOK, setIndicatorsOK] = useState<IndicatorOK[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [selectedCountry, setSelectedCountry] = useState<string>('all')
  const [eventFilter, setEventFilter] = useState<{
    country?: string
    level?: string
    indicatorId?: string
  }>({})
  const [pollingErrors, setPollingErrors] = useState<{ [key: string]: number }>({})
  const [showErrorBanner, setShowErrorBanner] = useState(false)

  // Ref para leer el estado de errores de polling dentro de los intervalos
  const pollingErrorsRef = useRef<{ [key: string]: number }>({})

  // Poll for latest run status
  const fetchRunStatus = useCallback(async (country?: string) => {
    try {
      const url = country && country !== 'all' 
        ? `/api/jobs/runs/latest?country=${country}`
        : '/api/jobs/runs/latest'
      const res = await fetch(url)
      const data = await res.json()
      if (data.success && data.run) {
        setRunStatus(data.run)
        setIsRunning(data.run.status === 'running')
      }
    } catch (error) {
      console.error('Failed to fetch run status:', error)
    }
  }, [])

  // Poll for events
  const fetchEvents = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (eventFilter.country) params.set('country', eventFilter.country)
      if (eventFilter.level) params.set('level', eventFilter.level)
      if (eventFilter.indicatorId) params.set('indicatorId', eventFilter.indicatorId)
      params.set('since', String(Date.now() - 3600000)) // Last hour

      const res = await fetch(`/api/debug/events?${params.toString()}`)
      const data = await res.json()
      if (data.success) {
        setEvents(safeArray<SystemEvent>(data.events))
      }
    } catch (error) {
      console.error('Failed to fetch events:', error)
    }
  }, [eventFilter])

  // Fetch errors
  const fetchErrors = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (selectedCountry !== 'all') {
        params.set('country', selectedCountry)
      }
      params.set('failedOnly', 'false') // Show all statuses

      const res = await fetch(`/api/debug/errors?${params.toString()}`)
      const data = await res.json()
      if (data.success) {
        setErrors(safeArray<IndicatorError>(data.errors))
      }
    } catch (error) {
      console.error('Failed to fetch errors:', error)
    }
  }, [selectedCountry])

  // Fetch indicators OK
  const fetchIndicatorsOK = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (selectedCountry !== 'all') {
        params.set('country', selectedCountry)
      }

      const res = await fetch(`/api/debug/indicators-ok?${params.toString()}`)
      
      if (!res.ok) {
        // Get response body for diagnosis
        let bodyText = ''
        try {
          bodyText = await res.text()
        } catch (e) {
          bodyText = 'Could not read response body'
        }
        
        const errorDetails = {
          status: res.status,
          statusText: res.statusText,
          body: bodyText.substring(0, 200),
        }
        
        // Log detailed error with event emission
        console.error('Failed to fetch indicators OK:', errorDetails)
        
        // Emit event to backend for monitoring
        try {
          await fetch('/api/debug/events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              level: 'error',
              message: `api.debug.indicators-ok.failed: HTTP ${res.status} ${res.statusText}`,
              meta: {
                endpoint: '/api/debug/indicators-ok',
                status: res.status,
                statusText: res.statusText,
                body: bodyText.substring(0, 200),
                country: selectedCountry !== 'all' ? selectedCountry : undefined,
              },
            }),
          }).catch(() => {
            // Ignore if event emission fails
          })
        } catch (e) {
          // Ignore
        }
        
        throw new Error(`HTTP ${res.status} ${res.statusText}: ${bodyText.substring(0, 100)}`)
      }

      const data = await res.json()
      if (data.success) {
        setIndicatorsOK(safeArray<IndicatorOK>(data.indicators))
        // Reset error count on success
        setPollingErrors(prev => {
          const next = { ...prev }
          delete next['indicators-ok']
          return next
        })
      }
    } catch (error) {
      console.error('Failed to fetch indicators OK:', error)
      // Track consecutive errors
      setPollingErrors(prev => {
        const count = (prev['indicators-ok'] || 0) + 1
        const next = { ...prev, 'indicators-ok': count }
        // Show banner after 3 consecutive errors
        if (count >= 3) {
          setShowErrorBanner(true)
        }
        return next
      })
    }
  }, [selectedCountry])

  // Execute job
  const executeJob = async (country?: string) => {
    setIsRunning(true)
    try {
      // Always use /all endpoint if country is 'all' or undefined
      const url = (country && country !== 'all')
        ? `/api/jobs/ingest/${country}`
        : '/api/jobs/ingest/all'
      
      // In localhost, validateCronToken allows requests without token
      // In production, you'd need a real token
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      }
      
      // Only add token if we're not in localhost (validateCronToken handles localhost)
      // For now, we'll let validateCronToken handle it automatically
      
      const res = await fetch(url, {
        method: 'POST',
        headers,
      })

      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(`HTTP ${res.status}: ${errorText}`)
      }

      const result = await res.json()
      
      if (result.success) {
        // Refresh status (don't pass 'all' to fetchRunStatus)
        const countryForStatus = (country && country !== 'all') ? country : undefined
        setTimeout(() => fetchRunStatus(countryForStatus), 1000)
      } else {
        setIsRunning(false)
        alert(`Error: ${result.error || 'Unknown error'}`)
      }
    } catch (error) {
      setIsRunning(false)
      alert(`Error ejecutando job: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      // Always stop loading state
      setIsRunning(false)
    }
  }

  // FIX 6.4: Actualizar ref cuando pollingErrors cambia
  useEffect(() => {
    pollingErrorsRef.current = pollingErrors
  }, [pollingErrors])

  // Polling effects
  useEffect(() => {
    fetchRunStatus(selectedCountry !== 'all' ? selectedCountry : undefined)
    fetchErrors()
    
    // Only poll indicators-ok if error count is below threshold
    const indicatorsErrorCount = pollingErrorsRef.current['indicators-ok'] || 0
    if (indicatorsErrorCount < 5) {
      fetchIndicatorsOK()
    }
    
    const interval = setInterval(() => {
      fetchRunStatus(selectedCountry !== 'all' ? selectedCountry : undefined)
      fetchEvents()
      fetchErrors()
      
      // Stop polling indicators-ok after 5 consecutive errors
      const currentErrorCount = pollingErrorsRef.current['indicators-ok'] || 0
      if (currentErrorCount < 5) {
        fetchIndicatorsOK()
      }
    }, 2000) // Poll every 2 seconds

    return () => clearInterval(interval)
  }, [selectedCountry, fetchRunStatus, fetchEvents, fetchErrors, fetchIndicatorsOK])

  // Initial fetch
  useEffect(() => {
    fetchRunStatus()
    fetchEvents()
    fetchErrors()
    fetchIndicatorsOK()
  }, [fetchRunStatus, fetchEvents, fetchErrors, fetchIndicatorsOK])

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  const formatDuration = (ms?: number) => {
    if (!ms) return '—'
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(1)}s`
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Programación</h1>

        {/* Error Banner */}
        {showErrorBanner && (
          <div className="bg-red-900 border border-red-700 rounded-lg p-4 mb-6 flex justify-between items-center">
            <div>
              <div className="font-semibold text-red-200">Error de conexión</div>
              <div className="text-sm text-red-300 mt-1">
                Hay problemas conectando con algunos endpoints. El polling se ha detenido automáticamente.
              </div>
            </div>
            <button
              onClick={() => {
                setShowErrorBanner(false)
                setPollingErrors({})
                // Retry immediately
                fetchIndicatorsOK()
              }}
              className="px-4 py-2 bg-red-700 hover:bg-red-600 rounded text-sm font-medium"
            >
              Reintentar
            </button>
          </div>
        )}

        {/* Botones de Ejecución */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Ejecutar Jobs</h2>
          <div className="flex gap-4 flex-wrap">
            <button
              onClick={() => executeJob()}
              disabled={isRunning}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
            >
              {isRunning ? 'Ejecutando...' : 'Ingerir TODO'}
            </button>
            
            <select
              value={selectedCountry}
              onChange={(e) => setSelectedCountry(e.target.value)}
              className="px-4 py-3 bg-gray-700 rounded-lg border border-gray-600"
            >
              <option value="all">Todos los países</option>
              <option value="ca">Canadá (CA)</option>
              <option value="nz">Nueva Zelanda (NZ)</option>
              <option value="ch">Suiza (CH)</option>
              <option value="jp">Japón (JP)</option>
              <option value="uk">Reino Unido (UK)</option>
              <option value="cn">China (CN)</option>
            </select>

            <button
              onClick={() => {
                if (selectedCountry === 'all') {
                  executeJob() // Call without country to use /all endpoint
                } else {
                  executeJob(selectedCountry)
                }
              }}
              disabled={isRunning || selectedCountry === 'all'}
              className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
            >
              {isRunning ? 'Ejecutando...' : `Ingerir ${selectedCountry === 'all' ? 'TODO' : selectedCountry.toUpperCase()}`}
            </button>
          </div>
        </div>

        {/* Panel de Estado General */}
        {runStatus && (
          <div className="bg-gray-800 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Estado General</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-sm text-gray-400">Última ejecución</div>
                <div className="text-lg font-medium">
                  {formatTime(runStatus.startTime)}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-400">Estado</div>
                <div className={`text-lg font-medium ${
                  runStatus.status === 'complete' ? 'text-green-400' :
                  runStatus.status === 'running' ? 'text-yellow-400' :
                  'text-red-400'
                }`}>
                  {runStatus.status === 'complete' ? 'Completado' :
                   runStatus.status === 'running' ? 'Ejecutando' :
                   'Error'}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-400">Duración</div>
                <div className="text-lg font-medium">
                  {formatDuration(runStatus.durationMs)}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-400">Run ID</div>
                <div className="text-sm font-mono text-gray-500">
                  {runStatus.runId}
                </div>
              </div>
            </div>

            {runStatus.summary && (
              <div className="mt-6">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                  <div>
                    <div className="text-sm text-gray-400">Ingeridos</div>
                    <div className="text-2xl font-bold text-green-400">
                      {runStatus.summary.ingested}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-400">Errores</div>
                    <div className="text-2xl font-bold text-red-400">
                      {runStatus.summary.failed}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-400">No migrados</div>
                    <div className="text-2xl font-bold text-yellow-400">
                      {runStatus.summary.notMigrated}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-400">No disponibles</div>
                    <div className="text-2xl font-bold text-orange-400">
                      {runStatus.summary.notAvailable}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-400">Total</div>
                    <div className="text-2xl font-bold">
                      {runStatus.summary.total}
                    </div>
                  </div>
                </div>
                
                {/* Circuit Breaker Status */}
                {runStatus.summary.circuitBreakerState?.oecd && (
                  <div className="mt-4 p-4 bg-yellow-900/20 border border-yellow-700 rounded-lg">
                    <div className="text-sm font-semibold text-yellow-400 mb-2">
                      ⚠️ Circuit Breaker OECD
                    </div>
                    <div className="text-xs text-gray-400">
                      {runStatus.summary.circuitBreakerState.oecd.isOpen ? (
                        <>
                          Estado: <span className="text-red-400">ABIERTO</span> (cooldown 60s)
                          <br />
                          Fallos: {runStatus.summary.circuitBreakerState.oecd.failures}
                        </>
                      ) : (
                        <>
                          Estado: <span className="text-green-400">CERRADO</span>
                          <br />
                          Fallos: {runStatus.summary.circuitBreakerState.oecd.failures}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Panel de Eventos/Logs */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Eventos / Logs</h2>
            <div className="flex gap-2">
              <select
                value={eventFilter.country || ''}
                onChange={(e) => setEventFilter({ ...eventFilter, country: e.target.value || undefined })}
                className="px-3 py-1 bg-gray-700 rounded border border-gray-600 text-sm"
              >
                <option value="">Todos los países</option>
                <option value="ca">CA</option>
                <option value="nz">NZ</option>
                <option value="ch">CH</option>
              </select>
              <select
                value={eventFilter.level || ''}
                onChange={(e) => setEventFilter({ ...eventFilter, level: e.target.value || undefined })}
                className="px-3 py-1 bg-gray-700 rounded border border-gray-600 text-sm"
              >
                <option value="">Todos los niveles</option>
                <option value="info">Info</option>
                <option value="warn">Warning</option>
                <option value="error">Error</option>
              </select>
            </div>
          </div>
          <div className="bg-black rounded p-4 font-mono text-sm h-96 overflow-y-auto">
            {events.length === 0 ? (
              <div className="text-gray-500">No hay eventos recientes</div>
            ) : (
              events.map((event, idx) => (
                <div key={idx} className="mb-2">
                  <span className="text-gray-500">
                    {(() => {
                      const d = safeDate(event.timestamp)
                      return `[${d ? d.toLocaleTimeString('es-ES') : '—'}]`
                    })()}
                  </span>
                  <span className={`ml-2 ${
                    event.level === 'error' ? 'text-red-400' :
                    event.level === 'warn' ? 'text-yellow-400' :
                    'text-gray-300'
                  }`}>
                    {event.message}
                  </span>
                  {event.meta?.indicatorId && (
                    <span className="text-gray-500 ml-2">
                      ({event.meta.indicatorId})
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Panel de Errores Actuales */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Indicadores con Problemas</h2>
          <div className="text-gray-400 text-sm mb-4">
            <span className="text-red-400">● failed</span> = Error técnico
            <span className="ml-4 text-orange-400">● not_available</span> = No disponible en fuente
            <span className="ml-4 text-yellow-400">● not_migrated</span> = Aún en TradingEconomics
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left p-2">Indicador</th>
                  <th className="text-left p-2">País</th>
                  <th className="text-left p-2">Status</th>
                  <th className="text-left p-2">Error Type</th>
                  <th className="text-left p-2">Mensaje</th>
                </tr>
              </thead>
              <tbody>
                {errors.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-gray-500">
                      No hay indicadores con problemas
                    </td>
                  </tr>
                ) : (
                  errors.map((error, idx) => (
                    <tr key={idx} className="border-b border-gray-700">
                      <td className="p-2 font-mono text-xs">{error.indicatorId}</td>
                      <td className="p-2">{error.country}</td>
                      <td className="p-2">
                        <span className={`px-2 py-1 rounded text-xs ${
                          error.status === 'failed' ? 'bg-red-900 text-red-300' :
                          error.status === 'not_available' ? 'bg-orange-900 text-orange-300' :
                          'bg-yellow-900 text-yellow-300'
                        }`}>
                          {error.status}
                        </span>
                      </td>
                      <td className="p-2 text-gray-400 text-xs">{error.errorType}</td>
                      <td className="p-2 text-gray-300 text-xs">{error.message}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Panel de Indicadores OK */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Indicadores OK</h2>
          <div className="text-gray-400 text-sm mb-4">
            Indicadores con datos recientes (últimos 30 días) y funcionando correctamente.
            Total: {indicatorsOK.length}
          </div>
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-800">
                <tr className="border-b border-gray-700">
                  <th className="text-left p-2">Indicador</th>
                  <th className="text-left p-2">Último Valor</th>
                  <th className="text-left p-2">Fecha</th>
                  <th className="text-left p-2">Fuente</th>
                  <th className="text-left p-2">Estado</th>
                </tr>
              </thead>
              <tbody>
                {indicatorsOK.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-gray-500">
                      No hay indicadores con datos recientes
                    </td>
                  </tr>
                ) : (
                  indicatorsOK.map((indicator, idx) => (
                    <tr key={idx} className="border-b border-gray-700 hover:bg-gray-700">
                      <td className="p-2 font-mono text-xs">{indicator.indicatorId}</td>
                      <td className="p-2">
                        {/* FIX 6.3: Validar lastValue antes de toFixed */}
                        {isFiniteNumber(indicator.lastValue) 
                          ? indicator.lastValue.toFixed(2)
                          : '—'}
                      </td>
                      <td className="p-2 text-gray-400 text-xs">
                        {(() => {
                          const d = safeDate(indicator.date)
                          return d
                            ? d.toLocaleDateString('es-ES', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                              })
                            : '—'
                        })()}
                      </td>
                      <td className="p-2">
                        <span className="px-2 py-1 rounded text-xs bg-blue-900 text-blue-300">
                          {indicator.source}
                        </span>
                      </td>
                      <td className="p-2">
                        <span className="px-2 py-1 rounded text-xs bg-green-900 text-green-300">
                          {indicator.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
