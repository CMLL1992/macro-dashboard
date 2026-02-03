'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

type TelegramPreferences = {
  dailySummary: boolean
  dailySummaryTime: string
  weeklySummary: boolean
  weeklySummaryDay: string
  weeklySummaryTime: string
  autoAlerts: boolean
}

const DEFAULT_PREFERENCES: TelegramPreferences = {
  dailySummary: true,
  dailySummaryTime: '08:00',
  weeklySummary: true,
  weeklySummaryDay: 'sunday',
  weeklySummaryTime: '09:00',
  autoAlerts: true,
}

export default function TelegramSettingsClient() {
  const [preferences, setPreferences] = useState<TelegramPreferences>(DEFAULT_PREFERENCES)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    // Cargar preferencias desde el servidor
    fetch('/api/settings/telegram/preferences')
      .then((res) => res.json())
      .then((data) => {
        if (data.preferences) {
          setPreferences({ ...DEFAULT_PREFERENCES, ...data.preferences })
        }
        setLoading(false)
      })
      .catch(() => {
        setLoading(false)
      })
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)
    try {
      const res = await fetch('/api/settings/telegram/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferences }),
      })
      if (res.ok) {
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      }
    } catch (error) {
      console.error('Error saving preferences:', error)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">Cargando configuración...</p>
        </CardContent>
      </Card>
    )
  }

  const dayLabel = {
    monday: 'Lunes',
    tuesday: 'Martes',
    wednesday: 'Miércoles',
    thursday: 'Jueves',
    friday: 'Viernes',
    saturday: 'Sábado',
    sunday: 'Domingo',
  }[preferences.weeklySummaryDay] || 'Domingo'

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tus notificaciones</CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Diario: 08:00 Europe/Madrid · Semanal: Domingo 09:00 Europe/Madrid · Post-dato: automático cuando hay publicación
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Resumen diario (08:00) */}
        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={preferences.dailySummary}
              onChange={(e) => setPreferences({ ...preferences, dailySummary: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300"
            />
            <div className="flex-1">
              <span className="text-sm font-medium">✅ Resumen diario (08:00)</span>
              <p className="text-xs text-muted-foreground mt-1">
                Régimen, liquidez, eventos del día y publicaciones nuevas. Hora por defecto: 08:00 Europe/Madrid.
              </p>
            </div>
          </label>
          {preferences.dailySummary && (
            <div className="ml-7 space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <span>Hora:</span>
                <input
                  type="time"
                  value={preferences.dailySummaryTime}
                  onChange={(e) => setPreferences({ ...preferences, dailySummaryTime: e.target.value })}
                  className="px-2 py-1 border rounded text-sm"
                />
              </label>
            </div>
          )}
        </div>

        {/* Resumen semanal (Domingo 09:00) */}
        <div className="space-y-3 pt-4 border-t">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={preferences.weeklySummary}
              onChange={(e) => setPreferences({ ...preferences, weeklySummary: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300"
            />
            <div className="flex-1">
              <span className="text-sm font-medium">✅ Resumen semanal ({dayLabel} 09:00)</span>
              <p className="text-xs text-muted-foreground mt-1">
                Régimen semanal, liquidez, USD y drivers. Por defecto: Domingo 09:00 Europe/Madrid.
              </p>
            </div>
          </label>
          {preferences.weeklySummary && (
            <div className="ml-7 space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <span>Día:</span>
                <select
                  value={preferences.weeklySummaryDay}
                  onChange={(e) => setPreferences({ ...preferences, weeklySummaryDay: e.target.value })}
                  className="px-2 py-1 border rounded text-sm"
                >
                  <option value="monday">Lunes</option>
                  <option value="tuesday">Martes</option>
                  <option value="wednesday">Miércoles</option>
                  <option value="thursday">Jueves</option>
                  <option value="friday">Viernes</option>
                  <option value="saturday">Sábado</option>
                  <option value="sunday">Domingo</option>
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <span>Hora:</span>
                <input
                  type="time"
                  value={preferences.weeklySummaryTime}
                  onChange={(e) => setPreferences({ ...preferences, weeklySummaryTime: e.target.value })}
                  className="px-2 py-1 border rounded text-sm"
                />
              </label>
            </div>
          )}
        </div>

        {/* Alertas post-dato */}
        <div className="space-y-3 pt-4 border-t">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={preferences.autoAlerts}
              onChange={(e) => setPreferences({ ...preferences, autoAlerts: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300"
            />
            <div className="flex-1">
              <span className="text-sm font-medium">✅ Alertas informativas post-dato (cuando hay publicación)</span>
              <p className="text-xs text-muted-foreground mt-1">
                Se envía solo cuando hay publicación relevante: cambio de régimen, liquidez, publicación macro CORE, correlaciones.
              </p>
            </div>
          </label>
        </div>

        {/* Botón guardar */}
        <div className="pt-4 border-t flex items-center justify-between">
          <div>
            {saved && (
              <Badge variant="outline" className="bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/40">
                ✓ Guardado
              </Badge>
            )}
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar configuración'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
