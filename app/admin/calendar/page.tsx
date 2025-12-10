'use client'

import { useState } from 'react'

export default function CalendarAdminPage() {
  const [formData, setFormData] = useState({
    fecha: new Date().toISOString().split('T')[0],
    hora_local: '',
    pais: '',
    tema: '',
    evento: '',
    importancia: 'med' as 'low' | 'med' | 'high',
    consenso: '',
  })
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')
  const [result, setResult] = useState<string>('')

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

      const res = await fetch('/api/calendar/insert', {
        method: 'POST',
        headers: {
          // En desarrollo aceptamos tanto INGEST_KEY como CRON_TOKEN vía X-INGEST-KEY
          'X-INGEST-KEY': token || '',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      const data = await res.json()
      if (res.ok && data.success) {
        setStatus('success')
        setResult('Evento insertado correctamente')
        // Reset form
        setFormData({
          fecha: new Date().toISOString().split('T')[0],
          hora_local: '',
          pais: '',
          tema: '',
          evento: '',
          importancia: 'med',
          consenso: '',
        })
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
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">Insertar Evento Calendario</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Inserta un evento en el calendario macro. Se incluirá en la previa semanal.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Fecha <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              required
              value={formData.fecha}
              onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
              className="w-full px-3 py-2 border rounded"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Hora Local (HH:mm)</label>
            <input
              type="time"
              value={formData.hora_local}
              onChange={(e) => setFormData({ ...formData, hora_local: e.target.value })}
              className="w-full px-3 py-2 border rounded"
              placeholder="14:30"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">País</label>
              <input
                type="text"
                value={formData.pais}
                onChange={(e) => setFormData({ ...formData, pais: e.target.value })}
                className="w-full px-3 py-2 border rounded"
                placeholder="US"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Tema <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.tema}
                onChange={(e) => setFormData({ ...formData, tema: e.target.value })}
                className="w-full px-3 py-2 border rounded"
                placeholder="Inflación"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Evento <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.evento}
              onChange={(e) => setFormData({ ...formData, evento: e.target.value })}
              className="w-full px-3 py-2 border rounded"
              placeholder="CPI m/m"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Importancia <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={formData.importancia}
              onChange={(e) => setFormData({ ...formData, importancia: e.target.value as any })}
              className="w-full px-3 py-2 border rounded"
            >
              <option value="low">Low</option>
              <option value="med">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Consenso</label>
            <input
              type="text"
              value={formData.consenso}
              onChange={(e) => setFormData({ ...formData, consenso: e.target.value })}
              className="w-full px-3 py-2 border rounded"
              placeholder="0.3%"
            />
          </div>

          <button
            type="submit"
            disabled={status === 'sending'}
            className="w-full px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
          >
            {status === 'sending' ? 'Insertando...' : 
             status === 'success' ? 'Insertado' :
             status === 'error' ? 'Error' :
             'Insertar Evento'}
          </button>

          {result && (
            <div className={`p-3 rounded text-sm ${
              status === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
            }`}>
              {result}
            </div>
          )}
        </form>
      </div>
    </div>
  )
}


