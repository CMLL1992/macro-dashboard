'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'

export default function AdminLoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  // Check if already authenticated (only once on mount)
  useEffect(() => {
    let mounted = true
    
    fetch('/api/auth/login')
      .then(res => res.json())
      .then(data => {
        if (mounted && data.authenticated) {
          router.replace('/admin')
        }
      })
      .catch(() => {})
    
    return () => {
      mounted = false
    }
  }, []) // Empty deps - only run once

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })

      const data = await res.json()

      if (data.success) {
        router.push('/admin')
        router.refresh()
      } else {
        setError(data.error || 'Contraseña incorrecta')
      }
    } catch (err) {
      setError('Error al conectar con el servidor')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md">
        <div className="bg-card border rounded-lg p-8 shadow-lg">
          <h1 className="text-2xl font-bold mb-2">Acceso Administrador</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Ingresa la contraseña para acceder al panel de administración
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-2">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Ingresa la contraseña"
                autoFocus
                disabled={loading}
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-3 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !password}
              className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Verificando...' : 'Acceder'}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t">
            <p className="text-xs text-muted-foreground text-center">
              Solo usuarios autorizados pueden acceder a esta sección
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

