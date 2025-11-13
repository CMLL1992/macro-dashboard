'use client'

import { useEffect } from 'react'

type ErrorProps = {
  error: Error & { digest?: string }
  reset: () => void
}

export default function DashboardError({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log error to console for observability
    console.error('[Dashboard Error]', {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    })
  }, [error])

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center p-6">
      <div className="max-w-md rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <h2 className="mb-2 text-xl font-semibold text-red-900">Error al cargar el dashboard</h2>
        <p className="mb-4 text-sm text-red-700">
          {error.message || 'Ocurrió un error inesperado al cargar los datos macroeconómicos.'}
        </p>
        {error.digest && (
          <p className="mb-4 text-xs text-red-600">Código de error: {error.digest}</p>
        )}
        <button
          onClick={reset}
          className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
        >
          Reintentar
        </button>
      </div>
    </div>
  )
}





