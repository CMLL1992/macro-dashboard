'use client'

import { useState, useEffect } from 'react'

interface NotificationPreference {
  id: string
  name: string
  description: string
  enabled: boolean
  type: 'news' | 'narrative' | 'weekly' | 'daily'
}

const DEFAULT_PREFERENCES: NotificationPreference[] = [
  {
    id: 'news_high',
    name: 'Noticias de Alto Impacto',
    description: 'Recibir notificaciones cuando se publiquen noticias económicas de alto impacto (NFP, CPI, etc.)',
    enabled: true,
    type: 'news',
  },
  {
    id: 'news_medium',
    name: 'Noticias de Impacto Medio',
    description: 'Recibir notificaciones de noticias económicas de impacto medio',
    enabled: true,
    type: 'news',
  },
  {
    id: 'narrative_changes',
    name: 'Cambios de Narrativa',
    description: 'Recibir notificaciones cuando cambie la narrativa macroeconómica (RISK_ON, RISK_OFF, etc.)',
    enabled: true,
    type: 'narrative',
  },
  {
    id: 'weekly_ahead',
    name: 'Resumen Semanal',
    description: 'Recibir un resumen semanal cada domingo con los eventos importantes de la próxima semana',
    enabled: true,
    type: 'weekly',
  },
  {
    id: 'daily_digest',
    name: 'Resumen Diario',
    description: 'Recibir un resumen diario con las noticias y eventos más importantes del día',
    enabled: false,
    type: 'daily',
  },
]

export default function NotificacionesPage() {
  const [preferences, setPreferences] = useState<NotificationPreference[]>(DEFAULT_PREFERENCES)
  const [telegramChatId, setTelegramChatId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    loadPreferences()
  }, [])

  const loadPreferences = () => {
    // Load from localStorage
    const saved = localStorage.getItem('notification_preferences')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setPreferences(parsed.preferences || DEFAULT_PREFERENCES)
        setTelegramChatId(parsed.telegramChatId || '')
      } catch (e) {
        console.error('Error loading preferences:', e)
      }
    }
    setLoading(false)
  }

  const savePreferences = async () => {
    setSaving(true)
    setMessage(null)

    try {
      // Validate Telegram Chat ID if provided
      if (telegramChatId && !/^-?\d+$/.test(telegramChatId.trim())) {
        setMessage({ type: 'error', text: 'El Chat ID de Telegram debe ser un número' })
        setSaving(false)
        return
      }

      // Save to localStorage
      const data = {
        preferences,
        telegramChatId: telegramChatId.trim(),
        updatedAt: new Date().toISOString(),
      }
      localStorage.setItem('notification_preferences', JSON.stringify(data))

      // If Telegram Chat ID is provided, try to register it (optional API call)
      if (telegramChatId.trim()) {
        try {
          const res = await fetch('/api/notifications/user-config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chatId: telegramChatId.trim(),
              preferences: preferences.filter(p => p.enabled).map(p => p.id),
            }),
          })

          if (res.ok) {
            setMessage({ type: 'success', text: 'Preferencias guardadas correctamente' })
          } else {
            setMessage({ type: 'success', text: 'Preferencias guardadas localmente (servidor no disponible)' })
          }
        } catch (e) {
          // If API fails, still save locally
          setMessage({ type: 'success', text: 'Preferencias guardadas localmente' })
        }
      } else {
        setMessage({ type: 'success', text: 'Preferencias guardadas correctamente' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error al guardar las preferencias' })
    } finally {
      setSaving(false)
      setTimeout(() => setMessage(null), 5000)
    }
  }

  const togglePreference = (id: string) => {
    setPreferences(prev =>
      prev.map(p => (p.id === id ? { ...p, enabled: !p.enabled } : p))
    )
  }

  const sendTestMessage = async () => {
    setTesting(true)
    setMessage(null)

    try {
      const response = await fetch('/api/notifications/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (data.success) {
        setMessage({ 
          type: 'success', 
          text: '✅ Mensaje de prueba enviado correctamente. Revisa tu Telegram para confirmar que lo recibiste.' 
        })
      } else {
        setMessage({ 
          type: 'error', 
          text: `❌ Error al enviar mensaje: ${data.error || 'Error desconocido'}${data.details ? `\n\nDetalles: ${data.details}` : ''}` 
        })
      }
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: `❌ Error de conexión: ${error instanceof Error ? error.message : 'Error desconocido'}` 
      })
    } finally {
      setTesting(false)
      setTimeout(() => setMessage(null), 10000)
    }
  }

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="text-center">Cargando...</div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Configuración de Notificaciones</h1>
        <p className="text-muted-foreground">
          Personaliza qué notificaciones quieres recibir y cómo recibirlas
        </p>
      </div>

      {/* Botón de prueba destacado */}
      <div className="rounded-lg border-2 border-blue-200 bg-blue-50 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-blue-900 mb-1">🧪 Probar Notificaciones de Telegram</h2>
            <p className="text-sm text-blue-700">
              Envía un mensaje de prueba para verificar que Telegram está configurado correctamente
            </p>
          </div>
          <button
            onClick={sendTestMessage}
            disabled={testing}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium shadow-md transition-colors whitespace-nowrap"
          >
            {testing ? (
              <>
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Enviando...</span>
              </>
            ) : (
              <>
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                <span>Enviar Mensaje de Prueba</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Telegram Chat ID */}
      <div className="rounded-lg border bg-card p-6">
        <h2 className="text-xl font-semibold mb-4">📱 Telegram</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Para recibir notificaciones por Telegram, necesitas proporcionar tu Chat ID. 
          Si no lo tienes, puedes obtenerlo enviando un mensaje a tu bot y consultando la API de Telegram.
        </p>
        <div className="space-y-4">
          <div>
            <label htmlFor="chatId" className="block text-sm font-medium mb-2">
              Chat ID de Telegram
            </label>
            <input
              id="chatId"
              type="text"
              value={telegramChatId}
              onChange={(e) => setTelegramChatId(e.target.value)}
              placeholder="Ej: 123456789"
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="text-xs text-muted-foreground mt-2">
              Deja vacío si no quieres usar Telegram. Las preferencias se guardarán localmente.
            </p>
          </div>
          
          {/* Botón de prueba */}
          <div className="pt-4 mt-4 border-t border-gray-200">
            <h3 className="text-sm font-semibold mb-2">🧪 Probar Notificaciones</h3>
            <p className="text-xs text-muted-foreground mb-3">
              Envía un mensaje de prueba a Telegram para verificar que las notificaciones funcionan correctamente.
            </p>
            <button
              onClick={sendTestMessage}
              disabled={testing}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium shadow-sm transition-colors"
            >
              {testing ? (
                <>
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Enviando mensaje...</span>
                </>
              ) : (
                <>
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  <span>Enviar Mensaje de Prueba</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Preferencias de Notificaciones */}
      <div className="rounded-lg border bg-card p-6">
        <h2 className="text-xl font-semibold mb-4">Preferencias de Notificaciones</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Selecciona qué tipos de notificaciones quieres recibir
        </p>

        <div className="space-y-4">
          {preferences.map((pref) => (
            <div
              key={pref.id}
              className="flex items-start gap-4 p-4 border rounded-lg hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center h-5">
                <input
                  type="checkbox"
                  id={pref.id}
                  checked={pref.enabled}
                  onChange={() => togglePreference(pref.id)}
                  className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                />
              </div>
              <div className="flex-1">
                <label
                  htmlFor={pref.id}
                  className="text-sm font-medium cursor-pointer block mb-1"
                >
                  {pref.name}
                </label>
                <p className="text-xs text-muted-foreground">{pref.description}</p>
              </div>
              <div className="text-xs">
                <span className={`px-2 py-1 rounded ${
                  pref.type === 'news' ? 'bg-blue-100 text-blue-800' :
                  pref.type === 'narrative' ? 'bg-purple-100 text-purple-800' :
                  pref.type === 'weekly' ? 'bg-green-100 text-green-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {pref.type}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Mensaje de estado */}
      {message && (
        <div className={`rounded-lg p-4 whitespace-pre-line ${
          message.type === 'success' 
            ? 'bg-green-50 border border-green-200 text-green-800' 
            : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          <div className="flex items-start gap-2">
            <span className="text-lg">{message.type === 'success' ? '✅' : '❌'}</span>
            <div className="flex-1">{message.text}</div>
          </div>
        </div>
      )}

      {/* Botón Guardar */}
      <div className="flex justify-end">
        <button
          onClick={savePreferences}
          disabled={saving}
          className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Guardando...' : 'Guardar Preferencias'}
        </button>
      </div>

      {/* Información adicional */}
      <div className="rounded-lg border bg-muted/30 p-6">
        <h3 className="font-semibold mb-2">ℹ️ Información</h3>
        <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
          <li>Las preferencias se guardan en tu navegador (localStorage)</li>
          <li>Si proporcionas un Chat ID de Telegram, se intentará registrar en el servidor</li>
          <li>Puedes cambiar tus preferencias en cualquier momento</li>
          <li>Las notificaciones se envían según la configuración del sistema</li>
        </ul>
      </div>
    </div>
  )
}

