'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'

export default function MacroOverviewInfoPanel() {
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
            <span>¿Cómo funciona Macro Overview?</span>
            <svg
              className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </summary>
          <div className="mt-4 space-y-4 text-sm text-muted-foreground">
            <div>
              <h3 className="text-base font-semibold text-foreground mb-2">
                📘 ¿Cómo funciona Macro Overview?
              </h3>
              <p className="mb-3">
                Macro Overview resume el estado macroeconómico actual utilizando datos oficiales y actualizados de las principales economías.
              </p>
              <p className="mb-3">
                Su objetivo es ofrecer una visión clara del entorno económico global y facilitar la interpretación del contexto de mercado.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-foreground mb-2">🌍 1. Régimen Global</h4>
                <p className="mb-2">
                  El Régimen Global indica el entorno macro dominante:
                </p>
                <ul className="list-disc list-inside ml-2 space-y-1 mb-2">
                  <li><strong>Risk ON</strong> → Crecimiento sólido y mayor apetito por riesgo</li>
                  <li><strong>Risk OFF</strong> → Desaceleración económica o tensiones macro</li>
                  <li><strong>Neutral</strong> → Señales mixtas o falta de dirección clara</li>
                </ul>
                <p className="mb-2">
                  El régimen se calcula a partir de:
                </p>
                <ul className="list-disc list-inside ml-2 space-y-1 mb-2">
                  <li>Crecimiento económico</li>
                  <li>Inflación</li>
                  <li>Política monetaria</li>
                  <li>Empleo</li>
                </ul>
                <div className="text-xs space-y-1 mt-2">
                  <p>🔹 El marco mensual es el más importante (tendencia estructural).</p>
                  <p>🔹 Los marcos diario y semanal reflejan cambios de corto plazo.</p>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-foreground mb-2">📊 2. Indicadores Macro (Drivers)</h4>
                <p className="mb-2">
                  Muestra los principales indicadores económicos que influyen en el ciclo económico:
                </p>
                <ul className="list-disc list-inside ml-2 space-y-1 mb-2">
                  <li>PIB</li>
                  <li>Inflación</li>
                  <li>Empleo</li>
                  <li>Producción</li>
                  <li>Actividad económica</li>
                </ul>
                <p className="mb-2">
                  Cada indicador incluye:
                </p>
                <ul className="list-disc list-inside ml-2 space-y-1 mb-2">
                  <li>Dato actual</li>
                  <li>Dato anterior</li>
                  <li>Variación</li>
                  <li>Tendencia</li>
                  <li>Importancia</li>
                </ul>
                <div className="text-xs space-y-1 mt-2">
                  <p><strong>Notas:</strong></p>
                  <p>"N/A" → el dato no está disponible o no aplica</p>
                  <p>"–" → no existe valor previo comparable</p>
                  <p>Las unidades varían según el indicador:</p>
                  <ul className="list-disc list-inside ml-4 space-y-0.5">
                    <li><strong>%</strong> → variación porcentual</li>
                    <li><strong>K</strong> → miles</li>
                    <li><strong>M</strong> → millones</li>
                    <li><strong>Index</strong> → valor índice (PMI, ISM…)</li>
                  </ul>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-foreground mb-2">💱 3. Fortaleza por Moneda</h4>
                <p className="mb-2">
                  Muestra la fortaleza relativa de cada divisa según su entorno macroeconómico.
                </p>
                <p className="mb-2">
                  Incluye únicamente:
                </p>
                <ul className="list-disc list-inside ml-2 space-y-1 mb-2">
                  <li>🇺🇸 USD</li>
                  <li>🇪🇺 EUR</li>
                  <li>🇬🇧 GBP</li>
                  <li>🇯🇵 JPY</li>
                </ul>
                <p className="mb-2">
                  La fortaleza se calcula combinando:
                </p>
                <ul className="list-disc list-inside ml-2 space-y-1 mb-2">
                  <li>Crecimiento</li>
                  <li>Inflación</li>
                  <li>Política monetaria</li>
                  <li>Datos de empleo</li>
                </ul>
                <p className="mb-2">
                  El resultado se expresa como:
                </p>
                <ul className="list-disc list-inside ml-2 space-y-1">
                  <li><strong>Fuerte</strong></li>
                  <li><strong>Neutro</strong></li>
                  <li><strong>Débil</strong></li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-foreground mb-2">🗓 4. Macro Events</h4>
                <p className="mb-2">
                  Recoge los eventos macroeconómicos más relevantes:
                </p>
                <div className="ml-2 space-y-2 mb-2">
                  <div>
                    <p className="font-medium">🔹 Upcoming</p>
                    <p className="text-xs ml-4">Eventos futuros con impacto potencial en el mercado.</p>
                  </div>
                  <div>
                    <p className="font-medium">🔹 Releases</p>
                    <p className="text-xs ml-4">Datos ya publicados con:</p>
                    <ul className="list-disc list-inside ml-6 text-xs space-y-0.5">
                      <li>Valor real</li>
                      <li>Previsión</li>
                      <li>Sorpresa (diferencia entre ambos)</li>
                    </ul>
                  </div>
                </div>
                <div className="text-xs space-y-1 mt-2">
                  <p>⚠️ Solo se muestran eventos:</p>
                  <ul className="list-disc list-inside ml-4 space-y-0.5">
                    <li>oficiales</li>
                    <li>relevantes</li>
                    <li>con datos válidos</li>
                  </ul>
                  <p className="mt-2">
                    Si no hay eventos visibles, significa que:
                  </p>
                  <ul className="list-disc list-inside ml-4 space-y-0.5">
                    <li>no hay publicaciones recientes, o</li>
                    <li>el proveedor no ha publicado datos nuevos aún.</li>
                  </ul>
                </div>
              </div>

              <div className="pt-2 border-t">
                <h4 className="font-semibold text-foreground mb-2">🔗 Fuentes de datos</h4>
                <p className="mb-2">
                  Todos los datos proceden de fuentes oficiales como:
                </p>
                <ul className="list-disc list-inside ml-2 space-y-1 mb-2">
                  <li>Bureau of Economic Analysis (BEA)</li>
                  <li>Bureau of Labor Statistics (BLS)</li>
                  <li>Federal Reserve (FED)</li>
                  <li>Eurostat</li>
                  <li>ECB / BOE</li>
                  <li>ISM / PMI</li>
                </ul>
                <p className="text-xs">
                  Cada indicador incluye un enlace directo a su fuente original.
                </p>
              </div>

              <div className="pt-2 border-t">
                <h4 className="font-semibold text-foreground mb-2">ℹ️ Importante</h4>
                <ul className="list-disc list-inside ml-2 space-y-1 text-xs">
                  <li>Los datos no son predicciones.</li>
                  <li>No se generan señales automáticas.</li>
                  <li>El objetivo es ofrecer contexto macro fiable.</li>
                  <li>El análisis debe combinarse con otros factores (técnicos, riesgo, timing).</li>
                </ul>
              </div>
            </div>
          </div>
        </details>
      </CardContent>
    </Card>
  )
}
