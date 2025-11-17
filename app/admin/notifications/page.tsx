'use client'

import { useState, useEffect } from 'react'

interface NotificationStatus {
  initialized: boolean
  validation: {
    valid: boolean
    bot_ok: boolean
    chat_ok: boolean
    errors: string[]
    warnings: string[]
    checked_at?: string
  } | null
  currentNarrative: string
  bot_ok: boolean
  chat_ok: boolean
  ingest_key_loaded: boolean
  enabled: boolean
  weeklyLastSent: string | null
  weekly_next_run: string | null
  daily_last_sent_at: string | null
  server_time_utc: string
  server_time_madrid: string
  timezone: string
  counters: {
    sent_total: number
    failed_total: number
    rate_limited_total: number
  }
}

interface NotificationHistory {
  id: number
  tipo: string
  titulo: string
  status: string
  error: string | null
  sent_at: string | null
  created_at: string
  hora_madrid: string
  fecha_madrid: string
}

interface NotificationSettings {
  key: string
  value: string
  min_value?: number
  max_value?: number
  description?: string
}

interface SettingsDefaults {
  [key: string]: {
    default: string
    min?: number
    max?: number
    description: string
  }
}

export default function NotificationsAdminPage() {
  const [status, setStatus] = useState<NotificationStatus | null>(null)
  const [history, setHistory] = useState<NotificationHistory[]>([])
  const [settings, setSettings] = useState<NotificationSettings[]>([])
  const [defaults, setDefaults] = useState<SettingsDefaults>({})
  const [loading, setLoading] = useState(true)
  
  // Actions
  const [testStatus, setTestStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')
  const [weeklyStatus, setWeeklyStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')
  const [digestStatus, setDigestStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Filters
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const [dateRange, setDateRange] = useState<'today' | '24h' | '7d' | 'custom'>('7d')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [pageSize, setPageSize] = useState(50)
  const [currentPage, setCurrentPage] = useState(0)

  // Settings form
  const [settingsForm, setSettingsForm] = useState<Record<string, string>>({})
  const [enableDailyDigest, setEnableDailyDigest] = useState(false)

  useEffect(() => {
    loadAll()
    const interval = setInterval(loadAll, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (settings.length > 0) {
      const form: Record<string, string> = {}
      settings.forEach(s => {
        form[s.key] = s.value
      })
      setSettingsForm(form)
      setEnableDailyDigest(process.env.NEXT_PUBLIC_ENABLE_DAILY_DIGEST === 'true' || form.ENABLE_DAILY_DIGEST === 'true')
    }
  }, [settings])

  useEffect(() => {
    loadHistory()
  }, [selectedTypes, dateRange, customFrom, customTo, pageSize, currentPage])

  const loadAll = async () => {
    await Promise.all([loadStatus(), loadSettings()])
  }

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

  const loadSettings = async () => {
    try {
      const res = await fetch('/api/notifications/settings', { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        setSettings(data.settings || [])
        setDefaults(data.defaults || {})
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
    }
  }

  const loadHistory = async () => {
    try {
      const params = new URLSearchParams()
      if (selectedTypes.length > 0) {
        params.set('type', selectedTypes.join(','))
      }

      const now = new Date()
      let from: string | null = null
      let to: string | null = null

      if (dateRange === 'today') {
        from = formatDate(now)
        to = formatDate(now)
      } else if (dateRange === '24h') {
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        from = formatDate(yesterday)
        to = formatDate(now)
      } else if (dateRange === '7d') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        from = formatDate(weekAgo)
        to = formatDate(now)
      } else if (dateRange === 'custom') {
        from = customFrom || null
        to = customTo || null
      }

      if (from) params.set('from', from)
      if (to) params.set('to', to)
      params.set('limit', String(pageSize))
      params.set('offset', String(currentPage * pageSize))

      const res = await fetch(`/api/notifications/history?${params}`)
      if (res.ok) {
        const data = await res.json()
        setHistory(data.notifications || [])
      }
    } catch (error) {
      console.error('Failed to load history:', error)
    }
  }

  const formatDate = (date: Date): string => {
    return date.toISOString().split('T')[0]
  }

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 5000)
  }

  const handleTest = async () => {
    setTestStatus('sending')
    try {
      const res = await fetch('/api/notifications/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setTestStatus('success')
        showToast('Mensaje de prueba enviado', 'success')
        setTimeout(() => setTestStatus('idle'), 2000)
      } else {
        setTestStatus('error')
        showToast(`Error: ${data.error || 'Unknown'}`, 'error')
        setTimeout(() => setTestStatus('idle'), 3000)
      }
    } catch (error) {
      setTestStatus('error')
        showToast(`Excepción: ${error instanceof Error ? error.message : String(error)}`, 'error')
      setTimeout(() => setTestStatus('idle'), 3000)
    }
  }

  const handleWeekly = async () => {
    setWeeklyStatus('sending')
    try {
      const res = await fetch('/api/jobs/weekly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setWeeklyStatus('success')
        showToast('Weekly enviado', 'success')
        loadAll()
        setTimeout(() => setWeeklyStatus('idle'), 2000)
      } else {
        setWeeklyStatus('error')
        showToast(`Error: ${data.error || 'Unknown'}`, 'error')
        setTimeout(() => setWeeklyStatus('idle'), 3000)
      }
    } catch (error) {
      setWeeklyStatus('error')
        showToast(`Excepción: ${error instanceof Error ? error.message : String(error)}`, 'error')
      setTimeout(() => setWeeklyStatus('idle'), 3000)
    }
  }

  const handleDigest = async () => {
    setDigestStatus('sending')
    try {
      const res = await fetch('/api/jobs/digest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setDigestStatus('success')
        showToast('Digest enviado', 'success')
        loadAll()
        setTimeout(() => setDigestStatus('idle'), 2000)
      } else {
        setDigestStatus('error')
        showToast(`${data.error || 'Unknown'}`, 'error')
        setTimeout(() => setDigestStatus('idle'), 3000)
      }
    } catch (error) {
      setDigestStatus('error')
        showToast(`Excepción: ${error instanceof Error ? error.message : String(error)}`, 'error')
      setTimeout(() => setDigestStatus('idle'), 3000)
    }
  }

  const handleSaveSettings = async () => {
    try {
      const updates = Object.entries(settingsForm).map(([key, value]) => ({
        key,
        value,
        ...defaults[key],
      }))

      for (const update of updates) {
        const res = await fetch('/api/notifications/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(update),
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Failed to save setting')
        }
      }

      showToast('Parámetros guardados', 'success')
      loadSettings()
    } catch (error) {
      showToast(`Error: ${error instanceof Error ? error.message : String(error)}`, 'error')
    }
  }

  const toggleType = (type: string) => {
    setSelectedTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    )
  }

  if (loading || !status) {
    return (
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <p>Cargando estado...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Toast */}
        {toast && (
          <div className={`fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 ${
            toast.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {toast.message}
          </div>
        )}

        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold mb-2">Admin - Notificaciones Telegram</h1>
          <p className="text-sm text-muted-foreground">
            Gestión y auditoría del sistema de notificaciones
          </p>
        </div>

        {/* Estado Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatusCard title="Bot" value={status.bot_ok ? 'OK' : 'Error'} />
          <StatusCard title="Chat" value={status.chat_ok ? 'OK' : 'Error'} />
          <StatusCard title="Notificaciones" value={status.enabled ? 'Activadas' : 'Desactivadas'} />
          <StatusCard title="INGEST_KEY" value={status.ingest_key_loaded ? 'Cargado' : 'Faltante'} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatusCard title="Timezone" value={status.timezone} />
          <StatusCard title="Server UTC" value={new Date(status.server_time_utc).toLocaleString('es-ES')} />
          <StatusCard title="Server Madrid" value={new Date(status.server_time_madrid).toLocaleString('es-ES')} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <StatusCard 
            title="Weekly" 
            value={status.weeklyLastSent ? new Date(status.weeklyLastSent).toLocaleString('es-ES') : 'Nunca'}
            subtitle={`Próximo: ${status.weekly_next_run ? new Date(status.weekly_next_run).toLocaleString('es-ES') : 'N/A'}`}
          />
          <StatusCard 
            title="Digest Diario" 
            value={status.daily_last_sent_at ? new Date(status.daily_last_sent_at).toLocaleString('es-ES') : 'Nunca'}
          />
        </div>

        {/* Contadores */}
        <div className="rounded-lg border bg-card p-6">
          <h2 className="text-lg font-semibold mb-4">Contadores</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Enviados</div>
              <div className="text-2xl font-bold text-green-600">{status.counters.sent_total}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Fallidos</div>
              <div className="text-2xl font-bold text-red-600">{status.counters.failed_total}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Rate Limited</div>
              <div className="text-2xl font-bold text-yellow-600">{status.counters.rate_limited_total}</div>
            </div>
          </div>
        </div>

        {/* Acciones */}
        <div className="rounded-lg border bg-card p-6">
          <h2 className="text-lg font-semibold mb-4">Acciones</h2>
          <div className="flex flex-wrap gap-4">
            <button
              onClick={handleTest}
              disabled={testStatus === 'sending'}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {testStatus === 'sending' ? 'Enviando...' : 'Enviar Test'}
            </button>
            <button
              onClick={handleWeekly}
              disabled={weeklyStatus === 'sending'}
              className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
            >
              {weeklyStatus === 'sending' ? 'Enviando...' : weeklyStatus === 'success' ? 'Enviado' : 'Enviar Weekly'}
            </button>
            <button
              onClick={handleDigest}
              disabled={digestStatus === 'sending'}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >
              {digestStatus === 'sending' ? 'Enviando...' : digestStatus === 'success' ? 'Enviado' : 'Enviar Digest'}
            </button>
          </div>
        </div>

        {/* Historial con Filtros */}
        <div className="rounded-lg border bg-card p-6">
          <h2 className="text-lg font-semibold mb-4">Últimos {pageSize} Envíos</h2>
          
          {/* Filtros */}
          <div className="mb-4 space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Tipo:</label>
              <div className="flex flex-wrap gap-2">
                {['news', 'narrative', 'weekly', 'digest'].map(type => (
                  <button
                    key={type}
                    onClick={() => toggleType(type)}
                    className={`px-3 py-1 rounded text-sm ${
                      selectedTypes.includes(type)
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {type.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Rango:</label>
              <div className="flex flex-wrap gap-2">
                {['today', '24h', '7d', 'custom'].map(range => (
                  <button
                    key={range}
                    onClick={() => setDateRange(range as any)}
                    className={`px-3 py-1 rounded text-sm ${
                      dateRange === range
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {range === 'today' ? 'Hoy' : range === '24h' ? '24h' : range === '7d' ? '7d' : 'Custom'}
                  </button>
                ))}
              </div>
            </div>

            {dateRange === 'custom' && (
              <div className="flex gap-2">
                <input
                  type="date"
                  value={customFrom}
                  onChange={e => setCustomFrom(e.target.value)}
                  className="px-3 py-1 border rounded"
                />
                <input
                  type="date"
                  value={customTo}
                  onChange={e => setCustomTo(e.target.value)}
                  className="px-3 py-1 border rounded"
                />
              </div>
            )}

            <div>
              <label className="text-sm font-medium mb-2 block">Tamaño página:</label>
              <select
                value={pageSize}
                onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(0) }}
                className="px-3 py-1 border rounded"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>

          {/* Tabla */}
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay notificaciones</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Hora (Madrid)</th>
                    <th className="text-left p-2">Tipo</th>
                    <th className="text-left p-2">Título</th>
                    <th className="text-left p-2">Status</th>
                    <th className="text-left p-2">Razón</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map(notif => (
                    <tr key={notif.id} className="border-b">
                      <td className="p-2">{notif.hora_madrid}</td>
                      <td className="p-2">
                        <span className="px-2 py-1 rounded text-xs bg-blue-100 text-blue-800">
                          {notif.tipo.toUpperCase()}
                        </span>
                      </td>
                      <td className="p-2 max-w-md truncate">{notif.titulo}</td>
                      <td className="p-2">
                        <span className={`px-2 py-1 rounded text-xs ${
                          notif.status === 'sent' ? 'bg-green-100 text-green-800' :
                          notif.status === 'failed' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {notif.status}
                        </span>
                      </td>
                      <td className="p-2 text-xs text-muted-foreground">{notif.error || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Parámetros */}
        <div className="rounded-lg border bg-card p-6">
          <h2 className="text-lg font-semibold mb-4">Parámetros Ajustables</h2>
          <div className="space-y-4">
            {Object.entries(defaults).map(([key, def]) => (
              <div key={key}>
                <label className="block text-sm font-medium mb-1">
                  {key}
                  {def.description && <span className="text-xs text-muted-foreground ml-2">({def.description})</span>}
                </label>
                <input
                  type="number"
                  value={settingsForm[key] || def.default}
                  onChange={e => setSettingsForm({ ...settingsForm, [key]: e.target.value })}
                  min={def.min}
                  max={def.max}
                  step={key === 'DELTA_INFL_PP' ? 0.05 : 1}
                  className="w-full px-3 py-2 border rounded"
                />
                <div className="text-xs text-muted-foreground mt-1">
                  Rango: {def.min ?? '—'} - {def.max ?? '—'}
                </div>
              </div>
            ))}
            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={enableDailyDigest}
                  onChange={e => setEnableDailyDigest(e.target.checked)}
                />
                <span>ENABLE_DAILY_DIGEST</span>
              </label>
            </div>
            <button
              onClick={handleSaveSettings}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Guardar Parámetros
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatusCard({ title, value, subtitle }: { title: string; value: string; subtitle?: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-sm text-muted-foreground">{title}</div>
      <div className="text-lg font-semibold mt-1">{value}</div>
      {subtitle && <div className="text-xs text-muted-foreground mt-1">{subtitle}</div>}
    </div>
  )
}
