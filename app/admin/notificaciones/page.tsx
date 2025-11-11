'use client'

import { useState, useEffect } from 'react'

interface NotificationStatus {
  initialized: boolean
  validation: {
    valid: boolean
    errors: string[]
    warnings: string[]
  } | null
  currentNarrative: string
  recentNotifications: Array<{
    tipo: string
    status: string
    sent_at: string | null
    created_at: string
  }>
  weeklyLastSent: string | null
  weeklyNextRun: string | null
  enabled: boolean
}

export default function NotificationsAdminPage() {
  const [status, setStatus] = useState<NotificationStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [testStatus, setTestStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')
  const [testResult, setTestResult] = useState<string>('')
  const [weeklyStatus, setWeeklyStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')

  useEffect(() => {
    loadStatus()
    const interval = setInterval(loadStatus, 30000) // Refresh every 30s
    return () => clearInterval(interval)
  }, [])

  const loadStatus = async () => {
    try {
      const res = await fetch('/api/notifications/status', { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        setStatus(data)
      }
    } catch (error) {
      console.error('Failed to load status:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleTest = async () => {
    setTestStatus('sending')
    setTestResult('')
    try {
      const res = await fetch('/api/alerts/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      })
      const data = await res.json()
      if (res.ok && (data.ok || data.success)) {
        setTestStatus('success')
        setTestResult(`✅ Mensaje enviado. ID: ${data.messageId || '—'}`)
      } else {
        setTestStatus('error')
        setTestResult(`❌ Error: ${data.details || data.error || 'Unknown'}`)
      }
    } catch (error) {
      setTestStatus('error')
      setTestResult(`❌ Excepción: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  const handleWeekly = async () => {
    setWeeklyStatus('sending')
    try {
      const token = prompt('Ingresa CRON_TOKEN:')
      if (!token) {
        setWeeklyStatus('idle')
        return
      }
      const res = await fetch('/api/jobs/weekly', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setWeeklyStatus('success')
        setTimeout(() => {
          setWeeklyStatus('idle')
          loadStatus()
        }, 2000)
      } else {
        setWeeklyStatus('error')
        setTimeout(() => setWeeklyStatus('idle'), 3000)
      }
    } catch (error) {
      setWeeklyStatus('error')
      setTimeout(() => setWeeklyStatus('idle'), 3000)
    }
  }

  if (loading || !status) {
    return (
      <div className="p-6">
        <div className="max-w-4xl mx-auto">
          <p>Cargando estado...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold mb-2">Admin - Notificaciones Telegram</h1>
          <p className="text-sm text-muted-foreground">
            Gestión del sistema de notificaciones MVP
          </p>
        </div>

        {/* Estado del Sistema */}
        <div className="rounded-lg border bg-card p-6">
          <h2 className="text-lg font-semibold mb-4">Estado del Sistema</h2>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Inicializado:</span>
              <span className={status.initialized ? 'text-green-600' : 'text-red-600'}>
                {status.initialized ? '✅ Sí' : '❌ No'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm">Notificaciones:</span>
              <span className={status.enabled ? 'text-green-600' : 'text-yellow-600'}>
                {status.enabled ? '✅ Activadas' : '⚠️ Desactivadas'}
              </span>
            </div>

            {status.validation && (
              <div className="mt-4 p-3 rounded border">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Validación:</span>
                  <span className={status.validation.valid ? 'text-green-600' : 'text-red-600'}>
                    {status.validation.valid ? '✅ Válida' : '❌ Inválida'}
                  </span>
                </div>
                {status.validation.errors.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-medium text-red-600">Errores:</p>
                    <ul className="text-xs text-red-700 list-disc list-inside">
                      {status.validation.errors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {status.validation.warnings.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-medium text-yellow-600">Advertencias:</p>
                    <ul className="text-xs text-yellow-700 list-disc list-inside">
                      {status.validation.warnings.map((warn, i) => (
                        <li key={i}>{warn}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="text-sm">Narrativa Actual:</span>
              <span className="font-medium">{status.currentNarrative || 'NEUTRAL'}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm">Último Weekly:</span>
              <span className="text-sm">
                {status.weeklyLastSent 
                  ? new Date(status.weeklyLastSent).toLocaleString('es-ES')
                  : 'Nunca'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm">Próximo Weekly:</span>
              <span className="text-sm">
                {status.weeklyNextRun 
                  ? new Date(status.weeklyNextRun).toLocaleString('es-ES')
                  : 'N/A'}
              </span>
            </div>
          </div>
        </div>

        {/* Test Message */}
        <div className="rounded-lg border bg-card p-6">
          <h2 className="text-lg font-semibold mb-4">Mensaje de Prueba</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Envía un mensaje de prueba para verificar la configuración.
          </p>
          <div className="flex items-center gap-4">
            <button
              onClick={handleTest}
              disabled={testStatus === 'sending'}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {testStatus === 'sending' ? 'Enviando...' : 'Enviar mensaje de prueba'}
            </button>
            {testStatus === 'success' && <span className="text-green-600">✅</span>}
            {testStatus === 'error' && <span className="text-red-600">❌</span>}
          </div>
          {testResult && (
            <div className={`mt-3 p-3 rounded text-sm ${
              testStatus === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
            }`}>
              {testResult}
            </div>
          )}
        </div>

        {/* Weekly Manual */}
        <div className="rounded-lg border bg-card p-6">
          <h2 className="text-lg font-semibold mb-4">Previa Semanal</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Ejecutar manualmente el envío de previa semanal.
          </p>
          <button
            onClick={handleWeekly}
            disabled={weeklyStatus === 'sending'}
            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
          >
            {weeklyStatus === 'sending' ? 'Enviando...' : 
             weeklyStatus === 'success' ? '✅ Enviado' :
             weeklyStatus === 'error' ? '❌ Error' :
             'Ejecutar Weekly Manual'}
          </button>
        </div>

        {/* Historial */}
        <div className="rounded-lg border bg-card p-6">
          <h2 className="text-lg font-semibold mb-4">Últimas 20 Notificaciones</h2>
          {status.recentNotifications.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay notificaciones aún</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Tipo</th>
                    <th className="text-left p-2">Estado</th>
                    <th className="text-left p-2">Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {status.recentNotifications.map((notif, i) => (
                    <tr key={i} className="border-b">
                      <td className="p-2">
                        <span className="px-2 py-1 rounded text-xs bg-blue-100 text-blue-800">
                          {notif.tipo}
                        </span>
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
          )}
        </div>
      </div>
    </div>
  )
}

