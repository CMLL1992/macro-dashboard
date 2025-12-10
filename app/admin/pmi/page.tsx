'use client'

import { useState, useEffect } from 'react'

interface PMIEntry {
  date: string
  value: number
}

export default function PMIAdminPage() {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    value: '',
  })
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')
  const [result, setResult] = useState<string>('')
  const [recentEntries, setRecentEntries] = useState<PMIEntry[]>([])
  const [loading, setLoading] = useState(false)

  // Cargar entradas recientes
  useEffect(() => {
    loadRecentEntries()
  }, [])

  const loadRecentEntries = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/pmi/recent')
      if (response.ok) {
        const data = await response.json()
        setRecentEntries(data.entries || [])
      }
    } catch (error) {
      console.error('Error loading recent PMI entries:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('sending')
    setResult('')

    try {
      const token = prompt('Ingresa INGEST_KEY o CRON_TOKEN:')
      if (!token) {
        setStatus('idle')
        return
      }

      const res = await fetch('/api/admin/pmi/insert', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          date: formData.date,
          value: parseFloat(formData.value),
        }),
      })

      const data = await res.json()
      if (res.ok && data.success) {
        setStatus('success')
        setResult(`PMI insertado correctamente: ${data.value} para ${data.date}`)
        // Reset form
        setFormData({
          date: new Date().toISOString().split('T')[0],
          value: '',
        })
        // Recargar entradas recientes
        await loadRecentEntries()
        setTimeout(() => setStatus('idle'), 3000)
      } else {
        setStatus('error')
        setResult(`Error: ${data.error || 'Unknown'}`)
        setTimeout(() => setStatus('idle'), 5000)
      }
    } catch (error) {
      setStatus('error')
      setResult(`Excepción: ${error instanceof Error ? error.message : String(error)}`)
      setTimeout(() => setStatus('idle'), 5000)
    }
  }

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold mb-2">Insertar PMI Manufacturero</h1>
          <p className="text-sm text-muted-foreground mb-2">
            Inserta el valor del ISM Manufacturing PMI cuando se publique mensualmente.
          </p>
          <p className="text-xs text-muted-foreground">
            El PMI se publica el primer día hábil de cada mes a las 10:00 AM EST.
            Fuente oficial: <a href="https://www.ismworld.org/supply-management-news-and-reports/reports/ism-pmi-reports/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">ISM Reports</a>
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Formulario */}
          <div className="rounded-lg border bg-card p-6">
            <h2 className="text-lg font-semibold mb-4">Nuevo Valor PMI</h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Fecha <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Fecha de publicación del PMI (normalmente el 1er día hábil del mes)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Valor PMI <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  step="0.1"
                  min="0"
                  max="100"
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="52.5"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Valor del PMI (típicamente entre 40-60). &gt;50 indica expansión, &lt;50 indica contracción.
                </p>
              </div>

              <button
                type="submit"
                disabled={status === 'sending'}
                className={`w-full px-4 py-2 rounded-md font-medium ${
                  status === 'sending'
                    ? 'bg-gray-400 cursor-not-allowed'
                    : status === 'success'
                    ? 'bg-green-600 hover:bg-green-700'
                    : status === 'error'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                } text-white transition-colors`}
              >
                {status === 'sending'
                  ? 'Insertando...'
                  : status === 'success'
                  ? '✓ Insertado'
                  : status === 'error'
                  ? '✗ Error'
                  : 'Insertar PMI'}
              </button>

              {result && (
                <div
                  className={`p-3 rounded-md text-sm ${
                    status === 'success'
                      ? 'bg-green-50 text-green-800 border border-green-200'
                      : 'bg-red-50 text-red-800 border border-red-200'
                  }`}
                >
                  {result}
                </div>
              )}
            </form>
          </div>

          {/* Entradas recientes */}
          <div className="rounded-lg border bg-card p-6">
            <h2 className="text-lg font-semibold mb-4">Valores Recientes</h2>
            
            {loading ? (
              <p className="text-sm text-muted-foreground">Cargando...</p>
            ) : recentEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay valores de PMI en la base de datos.
              </p>
            ) : (
              <div className="space-y-2">
                {recentEntries.map((entry, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded border bg-background"
                  >
                    <div>
                      <div className="font-medium">{entry.value}</div>
                      <div className="text-xs text-muted-foreground">{entry.date}</div>
                    </div>
                    <div
                      className={`text-xs px-2 py-1 rounded ${
                        entry.value >= 50
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {entry.value >= 50 ? 'Expansión' : 'Contracción'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Información adicional */}
        <div className="rounded-lg border bg-card p-6">
          <h2 className="text-lg font-semibold mb-3">Información sobre el PMI</h2>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              <strong>¿Qué es el PMI?</strong> El Purchasing Managers' Index (PMI) es un indicador
              de la actividad económica en el sector manufacturero. Se publica mensualmente por el
              Institute for Supply Management (ISM).
            </p>
            <p>
              <strong>Interpretación:</strong>
            </p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li><strong>&gt; 50:</strong> Expansión en el sector manufacturero (Hawkish para el USD)</li>
              <li><strong>= 50:</strong> Sin cambio (Neutral)</li>
              <li><strong>&lt; 50:</strong> Contracción en el sector manufacturero (Dovish para el USD)</li>
            </ul>
            <p>
              <strong>Publicación:</strong> El primer día hábil de cada mes a las 10:00 AM EST.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}









