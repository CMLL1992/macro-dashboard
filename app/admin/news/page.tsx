'use client'

import { useState } from 'react'

export default function NewsAdminPage() {
  const [formData, setFormData] = useState({
    id_fuente: '',
    fuente: '',
    pais: '',
    tema: '',
    titulo: '',
    impacto: 'med' as 'low' | 'med' | 'high',
    published_at: new Date().toISOString(),
    resumen: '',
    valor_publicado: '',
    valor_esperado: '',
  })
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')
  const [result, setResult] = useState<string>('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('sending')
    setResult('')

    try {
      const token = prompt('Ingresa CRON_TOKEN:')
      if (!token) {
        setStatus('idle')
        return
      }

      const payload = {
        ...formData,
        valor_publicado: formData.valor_publicado ? parseFloat(formData.valor_publicado) : undefined,
        valor_esperado: formData.valor_esperado ? parseFloat(formData.valor_esperado) : undefined,
      }

      const res = await fetch('/api/news/insert', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (res.ok && data.success) {
        setStatus('success')
        setResult(`Noticia insertada. Notificada: ${data.notified ? 'Sí' : 'No'}`)
        // Reset form
        setFormData({
          id_fuente: '',
          fuente: '',
          pais: '',
          tema: '',
          titulo: '',
          impacto: 'med',
          published_at: new Date().toISOString(),
          resumen: '',
          valor_publicado: '',
          valor_esperado: '',
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
        <h1 className="text-2xl font-bold mb-2">Insertar Noticia</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Inserta una noticia manualmente. Se enviará notificación automáticamente si es nueva.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              ID Fuente <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.id_fuente}
              onChange={(e) => setFormData({ ...formData, id_fuente: e.target.value })}
              className="w-full px-3 py-2 border rounded"
              placeholder="123"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Fuente <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.fuente}
              onChange={(e) => setFormData({ ...formData, fuente: e.target.value })}
              className="w-full px-3 py-2 border rounded"
              placeholder="BLS"
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
              <label className="block text-sm font-medium mb-1">Tema</label>
              <input
                type="text"
                value={formData.tema}
                onChange={(e) => setFormData({ ...formData, tema: e.target.value })}
                className="w-full px-3 py-2 border rounded"
                placeholder="Inflación"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Título <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.titulo}
              onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
              className="w-full px-3 py-2 border rounded"
              placeholder="CPI m/m (oct)"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Impacto <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={formData.impacto}
              onChange={(e) => setFormData({ ...formData, impacto: e.target.value as any })}
              className="w-full px-3 py-2 border rounded"
            >
              <option value="low">Low</option>
              <option value="med">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Published At (UTC) <span className="text-red-500">*</span>
            </label>
            <input
              type="datetime-local"
              required
              value={formData.published_at.slice(0, 16)}
              onChange={(e) => setFormData({ ...formData, published_at: new Date(e.target.value).toISOString() })}
              className="w-full px-3 py-2 border rounded"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Valor Publicado</label>
              <input
                type="number"
                step="0.01"
                value={formData.valor_publicado}
                onChange={(e) => setFormData({ ...formData, valor_publicado: e.target.value })}
                className="w-full px-3 py-2 border rounded"
                placeholder="0.5"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Valor Esperado</label>
              <input
                type="number"
                step="0.01"
                value={formData.valor_esperado}
                onChange={(e) => setFormData({ ...formData, valor_esperado: e.target.value })}
                className="w-full px-3 py-2 border rounded"
                placeholder="0.3"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Resumen</label>
            <textarea
              value={formData.resumen}
              onChange={(e) => setFormData({ ...formData, resumen: e.target.value })}
              className="w-full px-3 py-2 border rounded"
              rows={3}
              placeholder="Breve resumen de la noticia..."
            />
          </div>

          <button
            type="submit"
            disabled={status === 'sending'}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {status === 'sending' ? 'Insertando...' : 
             status === 'success' ? 'Insertado' :
             status === 'error' ? 'Error' :
             'Insertar Noticia'}
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


