'use client'

/**
 * Client component for displaying formatted dates
 * SSR-safe date formatting
 */

type DateDisplayProps = {
  isoString: string | null | undefined
  format?: 'datetime' | 'date'
  label?: string
  showTimezone?: boolean
  className?: string
}

export default function DateDisplay({
  isoString,
  format = 'date',
  label,
  showTimezone = false,
  className = '',
}: DateDisplayProps) {
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

    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()

    if (format === 'date') {
      const formatted = `${day}/${month}/${year}`
      return (
        <span className={className}>
          {label && `${label}: `}
          <strong>{formatted}</strong>
        </span>
      )
    }

    // datetime format
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    const formatted = `${day}/${month}/${year} ${hours}:${minutes}`

    // UTC for tooltip
    const utcDay = String(date.getUTCDate()).padStart(2, '0')
    const utcMonth = String(date.getUTCMonth() + 1).padStart(2, '0')
    const utcYear = date.getUTCFullYear()
    const utcHours = String(date.getUTCHours()).padStart(2, '0')
    const utcMinutes = String(date.getUTCMinutes()).padStart(2, '0')
    const utcFormatted = `${utcYear}-${utcMonth}-${utcDay} ${utcHours}:${utcMinutes}`

    // Timezone offset
    const timeZoneOffset = -date.getTimezoneOffset() / 60
    const offsetSign = timeZoneOffset >= 0 ? '+' : ''
    const timeZoneLabel = timeZoneOffset !== 0 ? `UTC${offsetSign}${timeZoneOffset}` : 'UTC'

    return (
      <span
        className={className}
        title={showTimezone ? `UTC: ${utcFormatted} (${timeZoneLabel})` : undefined}
      >
        {label && `${label}: `}
        <strong>{formatted} {showTimezone && '(hora local)'}</strong>
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





