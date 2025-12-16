'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { MAIN_REGIONS, REGION_NAMES, type RegionCode } from '@/config/calendar-countries'

interface CalendarFiltersProps {
  onFiltersChange: (filters: {
    range: 'today' | '7d' | '30d'
    regions: RegionCode[]
    impacts: ('low' | 'medium' | 'high')[]
    query: string
  }) => void
}

export function CalendarFilters({ onFiltersChange }: CalendarFiltersProps) {
  const [range, setRange] = useState<'today' | '7d' | '30d'>('7d')
  const [regions, setRegions] = useState<RegionCode[]>(MAIN_REGIONS)
  const [impacts, setImpacts] = useState<('low' | 'medium' | 'high')[]>(['high', 'medium'])
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')

  // Debounce para el buscador
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query)
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  // Notificar cambios de filtros
  useEffect(() => {
    onFiltersChange({
      range,
      regions,
      impacts,
      query: debouncedQuery,
    })
  }, [range, regions, impacts, debouncedQuery, onFiltersChange])

  const toggleRegion = (region: RegionCode) => {
    setRegions(prev => {
      if (prev.includes(region)) {
        const filtered = prev.filter(r => r !== region)
        return filtered.length > 0 ? filtered : MAIN_REGIONS // Si se deselecciona todo, seleccionar todas
      } else {
        return [...prev, region]
      }
    })
  }

  const toggleImpact = (impact: 'low' | 'medium' | 'high') => {
    setImpacts(prev => {
      if (prev.includes(impact)) {
        const filtered = prev.filter(i => i !== impact)
        return filtered.length > 0 ? filtered : ['high', 'medium'] // Por defecto: high y medium
      } else {
        return [...prev, impact]
      }
    })
  }

  return (
    <Card className="mb-6">
      <div className="p-4 space-y-4">
        {/* Rango de fechas */}
        <div>
          <label className="text-sm font-medium mb-2 block">Rango de fechas</label>
          <div className="flex gap-2 flex-wrap">
            {(['today', '7d', '30d'] as const).map(r => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-4 py-2 rounded-md text-sm border transition-colors ${
                  range === r
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background hover:bg-muted border-border'
                }`}
              >
                {r === 'today' ? 'Hoy' : r === '7d' ? 'Próximos 7 días' : 'Próximos 30 días'}
              </button>
            ))}
          </div>
        </div>

        {/* Regiones */}
        <div>
          <label className="text-sm font-medium mb-2 block">Zona / Región</label>
          <div className="flex gap-2 flex-wrap">
            {MAIN_REGIONS.map(region => (
              <button
                key={region}
                onClick={() => toggleRegion(region)}
                className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
                  regions.includes(region)
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background hover:bg-muted border-border'
                }`}
              >
                {REGION_NAMES[region]}
              </button>
            ))}
          </div>
        </div>

        {/* Impacto */}
        <div>
          <label className="text-sm font-medium mb-2 block">Importancia</label>
          <div className="flex gap-2 flex-wrap">
            {(['high', 'medium', 'low'] as const).map(impact => (
              <label
                key={impact}
                className="flex items-center gap-2 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={impacts.includes(impact)}
                  onChange={() => toggleImpact(impact)}
                  className="w-4 h-4"
                />
                <span className="text-sm">
                  {impact === 'high' ? 'Alta' : impact === 'medium' ? 'Media' : 'Baja'}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Buscador */}
        <div>
          <label className="text-sm font-medium mb-2 block">Buscar</label>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por evento, país o divisa..."
            className="w-full px-4 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>
    </Card>
  )
}







