'use client'

/**
 * Client component for formatting dates
 * Handles SSR-safe date formatting
 */

type DateFormatterProps = {
  isoString: string | null | undefined
  format?: 'datetime' | 'date'
  showTimezone?: boolean
  fallback?: string
}

export function formatDateLocal(isoString: string | null | undefined, format: 'datetime' | 'date' = 'date'): string {
  if (!isoString) return '—'
  
  try {
    const date = new Date(isoString)
    if (isNaN(date.getTime())) return '—'
    
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()
    
    if (format === 'date') {
      return `${day}/${month}/${year}`
    }
    
    // datetime format
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${day}/${month}/${year} ${hours}:${minutes}`
  } catch {
    return '—'
  }
}

export function formatDateUTC(isoString: string | null | undefined): string {
  if (!isoString) return '—'
  
  try {
    const date = new Date(isoString)
    if (isNaN(date.getTime())) return '—'
    
    const day = String(date.getUTCDate()).padStart(2, '0')
    const month = String(date.getUTCMonth() + 1).padStart(2, '0')
    const year = date.getUTCFullYear()
    const hours = String(date.getUTCHours()).padStart(2, '0')
    const minutes = String(date.getUTCMinutes()).padStart(2, '0')
    
    return `${day}/${month}/${year} ${hours}:${minutes} UTC`
  } catch {
    return '—'
  }
}

export default function DateFormatter({ isoString, format = 'date', showTimezone = false, fallback = '—' }: DateFormatterProps) {
  if (!isoString) return <span>{fallback}</span>
  
  const formatted = formatDateLocal(isoString, format)
  const utcFormatted = showTimezone ? formatDateUTC(isoString) : null
  
  if (showTimezone && utcFormatted) {
    return (
      <span title={utcFormatted}>
        {formatted} {format === 'datetime' && '(hora local)'}
      </span>
    )
  }
  
  return <span>{formatted}</span>
}





