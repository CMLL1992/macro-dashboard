'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'

export default function TelegramPreview() {
  const [preview, setPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [type, setType] = useState<'daily' | 'weekly' | 'alert'>('daily')

  useEffect(() => {
    const fetchPreview = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/settings/telegram/preview?type=${type}`)
        if (res.ok) {
          const data = await res.json()
          setPreview(data.message)
        }
      } catch (error) {
        console.error('Error fetching preview:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchPreview()
  }, [type])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">Tipo:</span>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as 'daily' | 'weekly' | 'alert')}
          className="px-2 py-1 border rounded text-sm"
        >
          <option value="daily">Resumen Diario</option>
          <option value="weekly">Resumen Semanal</option>
          <option value="alert">Alerta Automática</option>
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Generando preview...</p>
      ) : preview ? (
        <div className="bg-muted rounded-lg p-4 font-mono text-sm whitespace-pre-line">{preview}</div>
      ) : (
        <p className="text-sm text-muted-foreground">No se pudo generar el preview.</p>
      )}

      <p className="text-xs text-muted-foreground">
        Este preview usa el mismo builder que se usará para enviar los mensajes reales. El contenido se genera desde el macro stack (CORE/regime/liquidity/correlations).
      </p>
    </div>
  )
}
