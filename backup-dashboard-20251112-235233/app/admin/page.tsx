'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface NotificationStatus {
  initialized: boolean
  validation: {
    valid: boolean
    bot_ok: boolean
    chat_ok: boolean
    errors: string[]
    warnings: string[]
  } | null
  currentNarrative: string
  bot_ok: boolean
  chat_ok: boolean
  enabled: boolean
  counters: {
    sent_total: number
    failed_total: number
    rate_limited_total: number
  }
  weeklyLastSent: string | null
  weekly_next_run: string | null
}

interface RecentNews {
  id: number
  titulo: string
  fuente: string
  impacto: string
  published_at: string
  notificado_at: string | null
}

interface RecentEvent {
  id: number
  fecha: string
  evento: string
  importancia: string
}

export default function AdminPage() {
  const [status, setStatus] = useState<NotificationStatus | null>(null)
  const [recentNews, setRecentNews] = useState<RecentNews[]>([])
  const [recentEvents, setRecentEvents] = useState<RecentEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [weeklyStatus, setWeeklyStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 30000)
    return () => clearInterval(interval)
  }, [])

  const loadData = async () => {
    try {
      const [statusRes, newsRes, eventsRes] = await Promise.all([
        fetch('/api/notifications/status', { cache: 'no-store' }),
        fetch('/api/admin/news/recent?limit=5', { cache: 'no-store' }),
        fetch('/api/admin/calendar/recent?limit=5', { cache: 'no-store' }),
      ])

      if (statusRes.ok) {
        const data = await statusRes.json()
        setStatus(data)
      }

      if (newsRes.ok) {
        const data = await newsRes.json()
        setRecentNews(data.news || [])
      }

      if (eventsRes.ok) {
        const data = await eventsRes.json()
        setRecentEvents(data.events || [])
      }
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
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
        },
      })

      const data = await res.json()
      if (res.ok && data.success) {
        setWeeklyStatus('success')
        setTimeout(() => {
          setWeeklyStatus('idle')
          loadData()
        }, 3000)
      } else {
        setWeeklyStatus('error')
        setTimeout(() => setWeeklyStatus('idle'), 5000)
      }
    } catch (error) {
      setWeeklyStatus('error')
      setTimeout(() => setWeeklyStatus('idle'), 5000)
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <p>Cargando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold mb-2">Panel de Administración</h1>
          <p className="text-sm text-muted-foreground">
            Gestión completa del sistema de notificaciones Telegram
          </p>
        </div>

        {/* Navigation */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Link
            href="/admin"
            className="p-4 rounded-lg border bg-card hover:bg-accent transition-colors"
          >
            <h3 className="font-semibold mb-1">📊 Dashboard</h3>
            <p className="text-xs text-muted-foreground">Vista general</p>
          </Link>
          <Link
            href="/admin/news"
            className="p-4 rounded-lg border bg-card hover:bg-accent transition-colors"
          >
            <h3 className="font-semibold mb-1">📰 Noticias</h3>
            <p className="text-xs text-muted-foreground">Gestionar noticias</p>
          </Link>
          <Link
            href="/admin/calendar"
            className="p-4 rounded-lg border bg-card hover:bg-accent transition-colors"
          >
            <h3 className="font-semibold mb-1">📅 Calendario</h3>
            <p className="text-xs text-muted-foreground">Gestionar eventos</p>
          </Link>
          <Link
            href="/admin/notifications"
            className="p-4 rounded-lg border bg-card hover:bg-accent transition-colors"
          >
            <h3 className="font-semibold mb-1">🔔 Notificaciones</h3>
            <p className="text-xs text-muted-foreground">Historial y estado</p>
          </Link>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-lg border bg-card p-4">
            <div className="text-sm text-muted-foreground mb-1">Bot Telegram</div>
            <div className={`text-2xl font-bold ${status?.bot_ok ? 'text-green-600' : 'text-red-600'}`}>
              {status?.bot_ok ? '✅ OK' : '❌ Error'}
            </div>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="text-sm text-muted-foreground mb-1">Chat</div>
            <div className={`text-2xl font-bold ${status?.chat_ok ? 'text-green-600' : 'text-red-600'}`}>
              {status?.chat_ok ? '✅ OK' : '❌ Error'}
            </div>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="text-sm text-muted-foreground mb-1">Notificaciones</div>
            <div className={`text-2xl font-bold ${status?.enabled ? 'text-green-600' : 'text-yellow-600'}`}>
              {status?.enabled ? '✅ Activas' : '⚠️ Inactivas'}
            </div>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="text-sm text-muted-foreground mb-1">Narrativa</div>
            <div className="text-2xl font-bold text-blue-600">
              {status?.currentNarrative || 'NEUTRAL'}
            </div>
          </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-lg border bg-card p-4">
            <div className="text-sm text-muted-foreground mb-1">Enviados</div>
            <div className="text-2xl font-bold text-green-600">
              {status?.counters.sent_total || 0}
            </div>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="text-sm text-muted-foreground mb-1">Fallidos</div>
            <div className="text-2xl font-bold text-red-600">
              {status?.counters.failed_total || 0}
            </div>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="text-sm text-muted-foreground mb-1">Rate Limited</div>
            <div className="text-2xl font-bold text-yellow-600">
              {status?.counters.rate_limited_total || 0}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="rounded-lg border bg-card p-6">
          <h2 className="text-lg font-semibold mb-4">Acciones Rápidas</h2>
          <div className="flex flex-wrap gap-4">
            <Link
              href="/admin/news"
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              ➕ Insertar Noticia
            </Link>
            <Link
              href="/admin/calendar"
              className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
            >
              ➕ Insertar Evento
            </Link>
            <button
              onClick={handleWeekly}
              disabled={weeklyStatus === 'sending'}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {weeklyStatus === 'sending' ? 'Enviando...' :
               weeklyStatus === 'success' ? '✅ Enviado' :
               weeklyStatus === 'error' ? '❌ Error' :
               '📅 Enviar Weekly'}
            </button>
            <Link
              href="/api/notifications/verify"
              target="_blank"
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
            >
              🔍 Verificar Sistema
            </Link>
          </div>
        </div>

        {/* Recent News */}
        <div className="rounded-lg border bg-card p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Noticias Recientes</h2>
            <Link
              href="/admin/news"
              className="text-sm text-blue-600 hover:underline"
            >
              Ver todas →
            </Link>
          </div>
          {recentNews.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay noticias aún</p>
          ) : (
            <div className="space-y-2">
              {recentNews.map((news) => (
                <div
                  key={news.id}
                  className="flex items-center justify-between p-3 rounded border"
                >
                  <div className="flex-1">
                    <div className="font-medium text-sm">{news.titulo}</div>
                    <div className="text-xs text-muted-foreground">
                      {news.fuente} • {new Date(news.published_at).toLocaleDateString('es-ES')}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded text-xs ${
                      news.impacto === 'high' ? 'bg-red-100 text-red-800' :
                      news.impacto === 'med' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {news.impacto}
                    </span>
                    {news.notificado_at ? (
                      <span className="text-green-600 text-xs">✅</span>
                    ) : (
                      <span className="text-gray-400 text-xs">⏳</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Events */}
        <div className="rounded-lg border bg-card p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Eventos Próximos</h2>
            <Link
              href="/admin/calendar"
              className="text-sm text-blue-600 hover:underline"
            >
              Ver todos →
            </Link>
          </div>
          {recentEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay eventos próximos</p>
          ) : (
            <div className="space-y-2">
              {recentEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between p-3 rounded border"
                >
                  <div className="flex-1">
                    <div className="font-medium text-sm">{event.evento}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(event.fecha).toLocaleDateString('es-ES', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short'
                      })}
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs ${
                    event.importancia === 'high' ? 'bg-red-100 text-red-800' :
                    event.importancia === 'med' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {event.importancia}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Weekly Status */}
        {status && (
          <div className="rounded-lg border bg-card p-6">
            <h2 className="text-lg font-semibold mb-4">Previa Semanal</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Último envío:</span>
                <span className="text-muted-foreground">
                  {status.weeklyLastSent
                    ? new Date(status.weeklyLastSent).toLocaleString('es-ES')
                    : 'Nunca'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Próximo envío:</span>
                <span className="text-muted-foreground">
                  {status.weekly_next_run
                    ? new Date(status.weekly_next_run).toLocaleString('es-ES')
                    : 'No programado'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
