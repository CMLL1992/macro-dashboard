'use client'

import { useState, useEffect } from 'react'

type LogEntry = {
  timestamp: string
  type: 'success' | 'error' | 'info' | 'warning'
  message: string
}

interface NotificationHistoryItem {
  tipo: string
  status: string
  sent_at: string | null
  created_at: string
  id_fuente?: string | null
  fuente?: string | null
}

function NotificationsHistory() {
  const [notifications, setNotifications] = useState<NotificationHistoryItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadHistory()
    const interval = setInterval(loadHistory, 30000) // Refresh every 30s
    return () => clearInterval(interval)
  }, [])

  const loadHistory = async () => {
    try {
      const res = await fetch('/api/notifications/status', { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        setNotifications(data.recentNotifications || [])
      }
    } catch (error) {
      console.error('Failed to load history:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Cargando...</p>
  }

  if (notifications.length === 0) {
    return <p className="text-sm text-muted-foreground">No hay notificaciones aún</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left p-2">Tipo</th>
            <th className="text-left p-2">Fuente</th>
            <th className="text-left p-2">Estado</th>
            <th className="text-left p-2">Fecha</th>
          </tr>
        </thead>
        <tbody>
          {notifications.map((notif, i) => (
            <tr key={i} className="border-b">
              <td className="p-2">
                <span className="px-2 py-1 rounded text-xs bg-blue-100 text-blue-800">
                  {notif.tipo}
                </span>
              </td>
              <td className="p-2 text-xs">
                {notif.fuente && (
                  <div>
                    <div className="font-medium">{notif.fuente}</div>
                    {notif.id_fuente && (
                      <div className="text-muted-foreground">{notif.id_fuente}</div>
                    )}
                  </div>
                )}
              </td>
              <td className="p-2">
                <span className={`px-2 py-1 rounded text-xs ${
                  notif.status === 'sent' ? 'bg-green-100 text-green-800' :
                  notif.status === 'failed' ? 'bg-red-100 text-red-800' :
                  'bg-yellow-100 text-yellow-800'
                }`}>
                  {notif.status}
                </span>
              </td>
              <td className="p-2 text-xs text-muted-foreground">
                {notif.sent_at 
                  ? new Date(notif.sent_at).toLocaleString('es-ES')
                  : new Date(notif.created_at).toLocaleString('es-ES')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function AdminPage() {
  const [mounted, setMounted] = useState(false)
  const [testStatus, setTestStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')
  const [testResult, setTestResult] = useState<string>('')
  const [lastTestTime, setLastTestTime] = useState<string | null>(null)
  const [simulateType, setSimulateType] = useState<'usd' | 'correlations' | 'macro'>('usd')
  const [simulateStatus, setSimulateStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')
  const [testsEnabled, setTestsEnabled] = useState(false)
  const [testChatId, setTestChatId] = useState<string | null>(null)
  const [isProduction, setIsProduction] = useState(false)
  const [logs, setLogs] = useState<LogEntry[]>([])

  // Mount component only on client after hydration
  useEffect(() => {
    setMounted(true)
    
    // Check if tests are enabled (client-side only)
    const enabled = process.env.NEXT_PUBLIC_ENABLE_TELEGRAM_TESTS === 'true'
    const chatId = process.env.NEXT_PUBLIC_TELEGRAM_TEST_CHAT_ID || null
    const prod = process.env.NEXT_PUBLIC_NODE_ENV === 'production'
    setTestsEnabled(enabled)
    setTestChatId(chatId)
    setIsProduction(prod)

    // Add initial log
    if (enabled) {
      setLogs([{
        timestamp: new Date().toISOString(),
        type: 'info',
        message: 'Modo TEST activo - Los mensajes se enviarán al chat de pruebas',
      }])
    }
  }, [])

  const addLog = (type: LogEntry['type'], message: string) => {
    setLogs(prev => [{
      timestamp: new Date().toISOString(),
      type,
      message,
    }, ...prev].slice(0, 20)) // Keep last 20 logs
  }

  const handleTest = async () => {
    if (!testsEnabled) {
      addLog('error', 'Tests deshabilitados')
      return
    }

    setTestStatus('sending')
    setTestResult('')
    addLog('info', 'Iniciando envío de mensaje de prueba...')

    try {
      // Send request with credentials to include cookies (same-origin)
      // No token required - endpoint validates same-origin from /admin
      const response = await fetch('/api/alerts/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies for same-origin requests
      })

      const data = await response.json()

      if (response.ok && (data.ok || data.success)) {
        setTestStatus('success')
        setTestResult(`Message sent! ID: ${data.messageId || '—'}`)
        setLastTestTime(new Date().toLocaleString())
        addLog('success', `Mensaje enviado exitosamente. ID: ${data.messageId || '—'}`)
      } else {
        setTestStatus('error')
        // Show detailed error message if available (especially for Telegram errors)
        const errorMsg = data.details || data.error || 'Unknown error'
        setTestResult(errorMsg)
        addLog('error', `Error: ${errorMsg}`)
      }
    } catch (error) {
      setTestStatus('error')
      const errorMsg = error instanceof Error ? error.message : String(error)
      setTestResult(errorMsg)
      addLog('error', `Excepción: ${errorMsg}`)
    }
  }

  const handleSimulate = async () => {
    if (!testsEnabled) {
      addLog('error', 'Tests deshabilitados')
      return
    }

    setSimulateStatus('sending')
    addLog('info', `Simulando trigger: ${simulateType}`)

    try {
      // No token required - endpoint validates same-origin from /admin
      let payload: any = {}

      switch (simulateType) {
        case 'usd':
          payload = {
            type: 'usd',
            persist: false,
            prevUSD: 'Neutral',
            currentUSD: 'Débil',
            regime: 'Neutral',
            score: -0.30,
            latestDataDate: new Date().toISOString().split('T')[0],
            categoryChips: 'Test: 1 · Test: 2',
          }
          break
        case 'correlations':
          payload = {
            type: 'correlations',
            persist: false,
            correlations: [
              { symbol: 'EURUSD', corr12m: 0.65, corr3m: 0.70 },
              { symbol: 'GBPUSD', corr12m: 0.55, corr3m: 0.60 },
            ],
          }
          break
        case 'macro':
          payload = {
            type: 'macro',
            persist: false,
            observations: [
              {
                seriesId: 'CPIAUCSL',
                label: 'CPI YoY',
                value: 3.02,
                valuePrevious: 3.08,
                date: new Date().toISOString().split('T')[0],
                datePrevious: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                trend: 'Mejora',
                posture: 'Dovish',
              },
            ],
          }
          break
      }

      const response = await fetch('/api/alerts/simulate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setSimulateStatus('success')
        addLog('success', `Trigger ${simulateType} simulado exitosamente`)
      } else {
        setSimulateStatus('error')
        addLog('error', `Error en simulación: ${data.error || 'Unknown'}`)
      }
    } catch (error) {
      setSimulateStatus('error')
      const errorMsg = error instanceof Error ? error.message : String(error)
      addLog('error', `Excepción en simulación: ${errorMsg}`)
    }
  }

  // During SSR, render only a stable placeholder
  // This ensures server and client HTML match during hydration
  // Use static structure that matches what will be rendered
  if (!mounted) {
    return (
      <div className="p-6">
        <div className="max-w-4xl mx-auto">
          <div>
            <h1 className="text-2xl font-bold mb-2">Admin - Telegram Alerts</h1>
            <div className="rounded-lg border bg-card p-6">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // After hydration, render the actual panel based on client-side flags
  // Render disabled state
  if (!testsEnabled) {
    return (
      <div className="p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-bold mb-2">Admin - Telegram Alerts</h1>
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
              <p className="text-yellow-800 font-medium">
                ⚠️ <strong>Modo test DESACTIVADO</strong>
              </p>
              <p className="text-yellow-700 text-sm mt-2">
                Telegram tests are disabled. Set <code className="bg-yellow-100 px-1 rounded">ENABLE_TELEGRAM_TESTS=true</code> to enable.
              </p>
              {isProduction && (
                <p className="text-yellow-700 text-xs mt-2 italic">
                  Entorno: Producción - Los controles de test están deshabilitados por seguridad.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Render enabled state
  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold mb-2">Admin - Telegram Alerts</h1>
          <div className="rounded-lg border border-green-200 bg-green-50 p-4">
            <p className="text-green-800 font-medium">
              ✅ <strong>Modo test ACTIVO</strong>
            </p>
            <p className="text-green-700 text-sm mt-1">
              Los mensajes se enviarán al chat de pruebas ({testChatId ? `ID: ${testChatId}` : 'No configurado'})
            </p>
            {isProduction && (
              <p className="text-green-700 text-xs mt-2 italic">
                ⚠️ Entorno: Producción - Solo se usará el chat de pruebas, nunca el chat de producción.
              </p>
            )}
          </div>
        </div>

        {/* Test Message Section */}
        <div className="rounded-lg border bg-card p-6">
          <h2 className="text-lg font-semibold mb-4">Mensaje de Prueba</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Envía un mensaje de prueba para verificar la configuración de Telegram.
          </p>
          <div className="flex items-center gap-4">
            <button
              onClick={handleTest}
              disabled={testStatus === 'sending'}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {testStatus === 'sending' ? 'Enviando...' : 'Enviar mensaje de prueba'}
            </button>
            {testStatus === 'success' && (
              <span className="text-green-600 font-medium">✅ Enviado</span>
            )}
            {testStatus === 'error' && (
              <span className="text-red-600 font-medium">❌ Error</span>
            )}
          </div>
          {testResult && (
            <div className={`mt-3 p-3 rounded text-sm ${
              testStatus === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
            }`}>
              {testResult}
            </div>
          )}
          {lastTestTime && (
            <p className="mt-2 text-xs text-muted-foreground">
              Último test: <strong>{lastTestTime}</strong>
            </p>
          )}
        </div>

        {/* Simulate Triggers Section */}
        <div className="rounded-lg border bg-card p-6">
          <h2 className="text-lg font-semibold mb-4">Simular Triggers</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Simula la ejecución de triggers sin afectar el estado persistido (persist=false).
          </p>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Tipo de trigger:</label>
            <select
              value={simulateType}
              onChange={(e) => setSimulateType(e.target.value as any)}
              className="px-3 py-2 border rounded w-full max-w-xs"
            >
              <option value="usd">USD Change (Trigger A)</option>
              <option value="correlations">Correlaciones (Trigger B)</option>
              <option value="macro">Datos Macro (Trigger C)</option>
            </select>
          </div>

          <div className="mb-4 p-3 bg-gray-50 rounded text-xs font-mono">
            <p className="font-semibold mb-1">Payload de ejemplo ({simulateType}):</p>
            <pre className="text-xs overflow-x-auto">
              {simulateType === 'usd' && JSON.stringify({
                type: 'usd',
                persist: false,
                prevUSD: 'Neutral',
                currentUSD: 'Débil',
                regime: 'Neutral',
                score: -0.30,
              }, null, 2)}
              {simulateType === 'correlations' && JSON.stringify({
                type: 'correlations',
                persist: false,
                correlations: [{ symbol: 'EURUSD', corr12m: 0.65, corr3m: 0.70 }],
              }, null, 2)}
              {simulateType === 'macro' && JSON.stringify({
                type: 'macro',
                persist: false,
                observations: [{
                  seriesId: 'CPIAUCSL',
                  label: 'CPI YoY',
                  value: 3.02,
                  date: new Date().toISOString().split('T')[0],
                }],
              }, null, 2)}
            </pre>
          </div>

          <button
            onClick={handleSimulate}
            disabled={simulateStatus === 'sending'}
            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {simulateStatus === 'sending' ? 'Simulando...' : 'Simular trigger'}
          </button>

          {simulateStatus === 'success' && (
            <p className="mt-2 text-green-600 font-medium">✅ Simulación completada</p>
          )}
          {simulateStatus === 'error' && (
            <p className="mt-2 text-red-600 font-medium">❌ Error en simulación</p>
          )}
        </div>

        {/* Status Section */}
        <div className="rounded-lg border bg-card p-6">
          <h2 className="text-lg font-semibold mb-4">Estado del Sistema</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between items-center">
              <span>Tests habilitados:</span>
              <span className={`font-medium ${testsEnabled ? 'text-green-600' : 'text-red-600'}`}>
                {testsEnabled ? '✅ Sí' : '❌ No'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span>Chat de pruebas:</span>
              <span className={testChatId ? 'text-green-600' : 'text-red-600'}>
                {testChatId ? `✅ Configurado (${testChatId})` : '❌ No configurado'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span>Entorno:</span>
              <span className={isProduction ? 'text-orange-600 font-medium' : 'text-blue-600'}>
                {isProduction ? '⚠️ Producción' : '🔧 Desarrollo'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span>Dry-run:</span>
              <span className={process.env.NEXT_PUBLIC_DRY_RUN_TELEGRAM === 'true' ? 'text-blue-600' : 'text-muted-foreground'}>
                {process.env.NEXT_PUBLIC_DRY_RUN_TELEGRAM === 'true' ? '✅ Activado (solo loguea)' : '❌ Desactivado'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span>Último envío:</span>
              <span className="text-muted-foreground text-xs">
                {lastTestTime || 'Nunca'}
              </span>
            </div>
          </div>
        </div>

        {/* Últimos Envíos Section */}
        <div className="rounded-lg border bg-card p-6">
          <h2 className="text-lg font-semibold mb-4">Últimos Envíos</h2>
          <NotificationsHistory />
        </div>

        {/* Logs Section */}
        {logs.length > 0 && (
          <div className="rounded-lg border bg-card p-6">
            <h2 className="text-lg font-semibold mb-4">Logs Recientes</h2>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {logs.map((log, idx) => (
                <div
                  key={idx}
                  className={`text-xs p-2 rounded border-l-4 ${
                    log.type === 'success' ? 'bg-green-50 border-green-500 text-green-800' :
                    log.type === 'error' ? 'bg-red-50 border-red-500 text-red-800' :
                    log.type === 'warning' ? 'bg-yellow-50 border-yellow-500 text-yellow-800' :
                    'bg-gray-50 border-gray-500 text-gray-800'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span className="font-mono">{log.message}</span>
                    <span className="text-xs opacity-70 ml-2">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
