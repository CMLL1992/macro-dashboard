/**
 * Error Panel Component
 * 
 * Standardized error display with requestId for correlation.
 * Shows error message, requestId (copyable), and optional CTA.
 */

'use client'

import React, { useState } from 'react'

interface ErrorPanelProps {
  title?: string
  message: string
  requestId: string
  issues?: Array<{ path: string; message: string }>
  onRetry?: () => void
  showReportButton?: boolean
  className?: string
}

export default function ErrorPanel({
  title = 'Error',
  message,
  requestId,
  issues,
  onRetry,
  showReportButton = false,
  className = '',
}: ErrorPanelProps) {
  const [copied, setCopied] = useState(false)

  const copyRequestId = async () => {
    try {
      await navigator.clipboard.writeText(requestId)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = requestId
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className={`rounded-lg border bg-red-50 dark:bg-red-950/20 p-6 text-red-800 dark:text-red-300 ${className}`}>
      <h1 className="text-xl font-semibold mb-2">{title}</h1>
      <p className="text-sm mt-1 font-mono mb-4">{message}</p>

      {/* Request ID (copyable) */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs text-red-600 dark:text-red-400">
          <strong>Request ID:</strong>
        </span>
        <code className="text-xs bg-red-100 dark:bg-red-900/30 px-2 py-1 rounded font-mono">
          {requestId}
        </code>
        <button
          onClick={copyRequestId}
          className="text-xs text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 underline"
        >
          {copied ? 'Copiado' : 'Copiar'}
        </button>
      </div>

      {/* Issues (if validation errors) */}
      {issues && issues.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-xs font-semibold">
            Ver issues de validación ({issues.length})
          </summary>
          <ul className="mt-2 text-xs space-y-1 bg-red-100 dark:bg-red-900/30 p-2 rounded">
            {issues.map((issue, idx) => (
              <li key={idx}>
                <strong>{issue.path}:</strong> {issue.message}
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 mt-4">
        {onRetry && (
          <button
            onClick={onRetry}
            className="text-xs px-3 py-1.5 bg-red-600 dark:bg-red-700 text-white rounded hover:bg-red-700 dark:hover:bg-red-800"
          >
            Reintentar
          </button>
        )}
        {showReportButton && (
          <a
            href={`mailto:support@example.com?subject=Error Report&body=Request ID: ${requestId}%0AError: ${message}`}
            className="text-xs px-3 py-1.5 bg-red-600 dark:bg-red-700 text-white rounded hover:bg-red-700 dark:hover:bg-red-800"
          >
            Reportar
          </a>
        )}
      </div>

      <p className="text-xs mt-4 text-red-600 dark:text-red-400">
        Por favor, verifica los logs del servidor con este requestId para más información.
      </p>
    </div>
  )
}

