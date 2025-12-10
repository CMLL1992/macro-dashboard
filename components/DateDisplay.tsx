'use client'

import { useEffect, useState } from 'react'

type DateDisplayProps = {
  isoString: string | null | undefined
  format: 'datetime' | 'date'
  label?: string
  showTimezone?: boolean
}

/**
 * DateDisplay 100% seguro para hidratación:
 *
 * - En el servidor y en el primer render del cliente SIEMPRE muestra un placeholder estable ("—").
 * - Toda la lógica que usa Date, Intl, timezone, etc. se ejecuta SOLO dentro de useEffect.
 * - De este modo, el HTML inicial del servidor == HTML del primer render del cliente.
 */
export default function DateDisplay({
  isoString,
  format,
  label,
  showTimezone = false,
}: DateDisplayProps) {
  const [text, setText] = useState<string | null>(null)

  useEffect(() => {
    if (!isoString) {
      setText(null)
      return
    }

    try {
      const date = new Date(isoString)
      if (isNaN(date.getTime())) {
        setText(null)
        return
      }

      // Formato base (cliente) – solo se calcula DESPUÉS de hidratar
      let formatted: string
      if (format === 'datetime') {
        formatted = date.toLocaleString(undefined, {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        })
      } else {
        formatted = date.toLocaleDateString(undefined, {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        })
      }

      if (showTimezone) {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
        formatted = `${formatted} (hora local (${tz}))`
      }

      setText(formatted)
    } catch {
      setText(null)
    }
  }, [isoString, format, showTimezone])

  // IMPORTANTE:
  // - En el HTML del servidor y en el primer render del cliente, text === null,
  //   así que se muestra siempre el mismo contenido ("—").
  // - Después de hidratar, useEffect actualiza "text" y React re-renderiza el
  //   componente ya en el cliente (sin errores de hidratación).
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      {label && <span className="font-medium">{label}:</span>}
      <span suppressHydrationWarning>
        {text ?? '—'}
      </span>
    </span>
  )
}
