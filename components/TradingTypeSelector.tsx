'use client'

import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'

type TradingType = 'swing' | 'intraday' | 'scalping' | null

export default function TradingTypeSelector() {
  const [selectedType, setSelectedType] = useState<TradingType>(null)

  const getFocusAreas = (type: TradingType) => {
    switch (type) {
      case 'swing':
        return ['Régimen + Sesgos']
      case 'intraday':
        return ['Sesgos + Correlaciones + Eventos']
      case 'scalping':
        return ['Eventos + Flags + Técnica']
      default:
        return []
    }
  }

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="text-xl">🔁 ¿Qué tipo de trading vas a hacer hoy?</CardTitle>
        <CardDescription>
          Selecciona tu estilo para enfocar el análisis
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-3 mb-4">
          <button
            onClick={() => setSelectedType(selectedType === 'swing' ? null : 'swing')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              selectedType === 'swing'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted hover:bg-muted/80'
            }`}
          >
            Swing / Posiciones largas
          </button>
          <button
            onClick={() => setSelectedType(selectedType === 'intraday' ? null : 'intraday')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              selectedType === 'intraday'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted hover:bg-muted/80'
            }`}
          >
            Intradía / 5m - 15m
          </button>
          <button
            onClick={() => setSelectedType(selectedType === 'scalping' ? null : 'scalping')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              selectedType === 'scalping'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted hover:bg-muted/80'
            }`}
          >
            Scalping / 1m
          </button>
        </div>
        {selectedType && (
          <div className="mt-4 p-4 bg-primary/10 rounded-lg border border-primary/20">
            <p className="text-sm font-semibold mb-2">Enfócate en:</p>
            <p className="text-sm text-muted-foreground">
              {getFocusAreas(selectedType).join(' + ')}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}


