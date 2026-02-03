'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'

export default function PreMarketInfoPanel() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <Card>
      <CardContent className="pt-6">
        <details
          open={isOpen}
          onToggle={(e) => setIsOpen(e.currentTarget.open)}
          className="group"
        >
          <summary className="cursor-pointer list-none flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            <span className="text-base">📘</span>
            <span>¿Cómo usar Pre-Market Macro?</span>
            <svg
              className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </summary>
          <div className="mt-4 space-y-4 text-sm text-muted-foreground whitespace-pre-line">
            {`Esta página resume el contexto macro antes de analizar gráficos.
Mensual define el contexto estructural (régimen base).
Semanal ayuda a confirmar cambios o transiciones.
Diario no redefine el régimen: solo informa de publicaciones recientes dentro del set CORE.
Liquidez describe si el entorno es expansivo, neutral o restrictivo.
Correlaciones muestran relaciones históricas frente al benchmark (normalmente DXY).

Es contexto descriptivo; no constituye señal ni recomendación de inversión.
Pre-Market Macro es contexto. La decisión operativa la toma el usuario.`}
          </div>
        </details>
      </CardContent>
    </Card>
  )
}
