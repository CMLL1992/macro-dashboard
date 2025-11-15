'use client'

/**
 * Client component for displaying formatted dates
 * SSR-safe date formatting - uses UTC to avoid hydration mismatches
 * 
 * CAUSA RAÍZ DEL ERROR DE HIDRATACIÓN:
 * El componente usaba métodos de fecha locales (getDate(), getHours(), getTimezoneOffset())
 * que pueden diferir entre servidor y cliente si están en diferentes zonas horarias.
 * 
 * SOLUCIÓN:
 * Usar métodos UTC (getUTCDate(), getUTCHours()) para el formateo principal,
 * garantizando que servidor y cliente generen el mismo HTML.
 */

import { useEffect, useState } from 'react'

type DateDisplayProps = {
  isoString: string | null | undefined
  format?: 'datetime' | 'date'
  label?: string
  showTimezone?: boolean
  className?: string
}

// Helper function to format date using UTC (SSR-safe)
function formatDateUTC(isoString: string, format: 'datetime' | 'date'): string {
  const date = new Date(isoString)
  if (isNaN(date.getTime())) return '—'
  
  // Use UTC methods to ensure consistency between server and client
  const day = String(date.getUTCDate()).padStart(2, '0')
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const year = date.getUTCFullYear()
  
  if (format === 'date') {
    return `${day}/${month}/${year}`
  }
  
  // datetime format
  const hours = String(date.getUTCHours()).padStart(2, '0')
  const minutes = String(date.getUTCMinutes()).padStart(2, '0')
  return `${day}/${month}/${year} ${hours}:${minutes}`
}

export default function DateDisplay({
  isoString,
  format = 'date',
  label,
  showTimezone = false,
  className = '',
}: DateDisplayProps) {
  // Use state to ensure client-side rendering matches server
  const [mounted, setMounted] = useState(false)
  
  useEffect(() => {
    setMounted(true)
  }, [])
  
  if (!isoString) {
    return (
      <span className={className}>
        {label && `${label}: `}
        <strong>—</strong>
      </span>
    )
  }

  try {
    const date = new Date(isoString)
    if (isNaN(date.getTime())) {
      return (
        <span className={className}>
          {label && `${label}: `}
          <strong>—</strong>
        </span>
      )
    }

    // Always use UTC formatting for consistency (SSR-safe)
    const formatted = formatDateUTC(isoString, format)
    
    // For timezone display, calculate only on client after mount
    let timezoneInfo: string | undefined = undefined
    if (showTimezone && mounted && format === 'datetime') {
      const utcDay = String(date.getUTCDate()).padStart(2, '0')
      const utcMonth = String(date.getUTCMonth() + 1).padStart(2, '0')
      const utcYear = date.getUTCFullYear()
      const utcHours = String(date.getUTCHours()).padStart(2, '0')
      const utcMinutes = String(date.getUTCMinutes()).padStart(2, '0')
      const utcFormatted = `${utcYear}-${utcMonth}-${utcDay} ${utcHours}:${utcMinutes}`
      
      // Timezone offset - only calculate on client
      const timeZoneOffset = -date.getTimezoneOffset() / 60
      const offsetSign = timeZoneOffset >= 0 ? '+' : ''
      const timeZoneLabel = timeZoneOffset !== 0 ? `UTC${offsetSign}${timeZoneOffset}` : 'UTC'
      timezoneInfo = `UTC: ${utcFormatted} (${timeZoneLabel})`
    }

    return (
      <span
        className={className}
        title={timezoneInfo}
      >
        {label && `${label}: `}
        <strong>{formatted} {showTimezone && mounted && format === 'datetime' && '(hora local)'}</strong>
      </span>
    )
  } catch {
    return (
      <span className={className}>
        {label && `${label}: `}
        <strong>—</strong>
      </span>
    )
  }
}





