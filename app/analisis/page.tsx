export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const metadata = {
  title: 'Análisis Diario | CM11 Trading',
  description: 'Guía diaria de análisis macro antes de operar',
  robots: { index: false },
}

import { getBiasState } from '@/domain/macro-engine/bias'
import { getDashboardData } from '@/lib/dashboard-data'
import { calculateReliabilityScore } from '@/domain/macro-engine/reliability'
import { calculateOpportunitiesRadar } from '@/domain/macro-engine/opportunities'
import JobStatusIndicator from '@/components/JobStatusIndicator'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import DateDisplay from '@/components/DateDisplay'
import ChecklistItem from '@/components/ChecklistItem'
import TradingTypeSelector from '@/components/TradingTypeSelector'
import ReliabilityTrafficLight from '@/components/ReliabilityTrafficLight'
import OpportunitiesRadar from '@/components/OpportunitiesRadar'
// Button component - using simple HTML button for now

export default async function AnalisisPage() {
  const [bias, dashboardData, reliabilityScore, opportunities] = await Promise.all([
    getBiasState(),
    getDashboardData(),
    calculateReliabilityScore(),
    calculateOpportunitiesRadar(),
  ])

  const updatedAt = bias.updatedAt ? bias.updatedAt.toISOString() : new Date().toISOString()

  return (
    <main className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header con estado del sistema */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Análisis Diario</h1>
            <p className="text-muted-foreground mt-1">
              Guía completa para revisar el mercado antes de operar
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <JobStatusIndicator />
            <small className="text-xs text-muted-foreground">
              Sesgos actualizados:{' '}
              <DateDisplay
                isoString={updatedAt}
                format="datetime"
                showTimezone={false}
              />
            </small>
          </div>
        </div>

        {/* Selector de tipo de trading */}
        <TradingTypeSelector />

        {/* Semáforo de Fiabilidad del Sistema */}
        <ReliabilityTrafficLight
          status={reliabilityScore.status}
          message={reliabilityScore.message}
          details={reliabilityScore.details}
        />

        {/* Radar de Oportunidades */}
        <OpportunitiesRadar opportunities={opportunities} />

        {/* Sección 1: Régimen global del mercado */}
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="text-2xl">🧠 Régimen global del mercado</CardTitle>
            <CardDescription>
              Qué interpretar antes de tomar una decisión
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                <strong>Dónde revisar:</strong> Dashboard principal → Sección "Régimen de Riesgo"
              </p>
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <p className="font-semibold">Régimen actual: {dashboardData.regime?.overall || 'N/A'}</p>
                <p className="text-sm">
                  <strong>Interpretación:</strong> El régimen global te indica si el mercado está en modo
                  <span className="font-semibold text-green-600"> RISK ON</span> (apetito por riesgo) o
                  <span className="font-semibold text-red-600"> RISK OFF</span> (aversión al riesgo).
                </p>
                <ul className="text-sm list-disc list-inside space-y-1 mt-2">
                  <li><strong>RISK ON:</strong> Favorece activos de riesgo (acciones, commodities, pares de riesgo)</li>
                  <li><strong>RISK OFF:</strong> Favorece activos refugio (USD, bonos, oro)</li>
                </ul>
              </div>
            </div>
            <div className="border-t pt-4">
              <p className="text-sm">
                <strong>Decisión:</strong> Si el régimen está a favor de tu operación, aumenta la probabilidad de éxito.
                Si está en contra, considera reducir el tamaño de posición o esperar mejor momento.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Sección 2: Estado de las monedas principales */}
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="text-2xl">💱 Estado de las monedas principales</CardTitle>
            <CardDescription>
              Dirección del USD y su impacto en los pares
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                <strong>Dónde revisar:</strong> Dashboard → Sección "USD Bias" o página Sesgos
              </p>
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <p className="font-semibold">
                  Dirección USD: {bias.regime?.usd_direction || 'N/A'}
                </p>
                <p className="text-sm">
                  <strong>Interpretación:</strong> Un USD fuerte generalmente debilita pares como EUR/USD, GBP/USD.
                  Un USD débil los fortalece.
                </p>
                <ul className="text-sm list-disc list-inside space-y-1 mt-2">
                  <li><strong>USD Fuerte:</strong> Busca oportunidades en ventas de EUR/USD, GBP/USD, AUD/USD</li>
                  <li><strong>USD Débil:</strong> Busca oportunidades en compras de EUR/USD, GBP/USD, AUD/USD</li>
                  <li><strong>USD Neutral:</strong> El mercado está indeciso, espera señales más claras</li>
                </ul>
              </div>
            </div>
            <div className="border-t pt-4">
              <p className="text-sm">
                <strong>Decisión:</strong> Alinea tu operación con la dirección del USD. Si quieres comprar EUR/USD
                pero el USD está fuerte, reconsidera o espera una mejor entrada.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Sección 3: Sesgos tácticos por par */}
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="text-2xl">🎯 Sesgos tácticos por par</CardTitle>
            <CardDescription>
              Recomendaciones específicas para cada instrumento
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                <strong>Dónde revisar:</strong> Página Sesgos → Tabla "Sesgos Tácticos"
              </p>
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <p className="text-sm">
                  <strong>Interpretación:</strong> Los sesgos tácticos te indican la dirección preferida y el nivel
                  de confianza para cada par basado en el análisis macro actual.
                </p>
                <ul className="text-sm list-disc list-inside space-y-1 mt-2">
                  <li><strong>Convicción Alta:</strong> Señal fuerte, considera operaciones más grandes</li>
                  <li><strong>Convicción Media:</strong> Señal moderada, tamaño de posición normal</li>
                  <li><strong>Convicción Baja:</strong> Señal débil, considera esperar o reducir tamaño</li>
                </ul>
              </div>
            </div>
            <div className="border-t pt-4">
              <p className="text-sm">
                <strong>Decisión:</strong> Prioriza operaciones en pares con sesgo táctico alineado con tu dirección
                y con convicción Media o Alta. Evita operar contra el sesgo táctico.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Sección 4: Correlaciones con el benchmark */}
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="text-2xl">📊 Correlaciones con el benchmark</CardTitle>
            <CardDescription>
              Cómo se mueve tu par respecto al DXY (índice del dólar)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                <strong>Dónde revisar:</strong> Página Correlaciones → Tabla de correlaciones
              </p>
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <p className="text-sm">
                  <strong>Interpretación:</strong> Las correlaciones te muestran qué tan ligado está tu par al movimiento
                  del dólar. Una correlación fuerte significa que el par sigue al USD de cerca.
                </p>
                <ul className="text-sm list-disc list-inside space-y-1 mt-2">
                  <li><strong>Correlación fuerte (|ρ| ≥ 0.60):</strong> El par se mueve en sincronía con el USD</li>
                  <li><strong>Correlación moderada (0.30 ≤ |ρ| &lt; 0.60):</strong> Relación parcial con el USD</li>
                  <li><strong>Correlación débil (|ρ| &lt; 0.30):</strong> El par es independiente del USD</li>
                </ul>
                <p className="text-sm mt-2">
                  <strong>Importante:</strong> Compara la correlación a 12 meses vs 3 meses. Si difieren mucho,
                  puede indicar un cambio de régimen.
                </p>
              </div>
            </div>
            <div className="border-t pt-4">
              <p className="text-sm">
                <strong>Decisión:</strong> Si tu par tiene correlación fuerte negativa con DXY y el USD está débil,
                es una señal alcista para el par. Si la correlación es positiva y el USD está fuerte, también es alcista.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Sección 5: Agenda macro del día */}
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="text-2xl">📅 Agenda macro del día</CardTitle>
            <CardDescription>
              Eventos económicos que pueden mover el mercado hoy
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                <strong>Dónde revisar:</strong> Página Calendario → Eventos del día
              </p>
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <p className="text-sm">
                  <strong>Interpretación:</strong> Los eventos macro de alto impacto pueden causar volatilidad extrema
                  y movimientos inesperados. Es crucial saber qué eventos están programados.
                </p>
                <ul className="text-sm list-disc list-inside space-y-1 mt-2">
                  <li><strong>Alto impacto:</strong> NFP, CPI, decisiones de la Fed, PIB</li>
                  <li><strong>Medio impacto:</strong> PMI, ventas minoristas, confianza del consumidor</li>
                  <li><strong>Bajo impacto:</strong> Datos secundarios, encuestas</li>
                </ul>
              </div>
            </div>
            <div className="border-t pt-4">
              <p className="text-sm">
                <strong>Decisión:</strong> Si hay eventos de alto impacto en las próximas horas, considera:
              </p>
              <ul className="text-sm list-disc list-inside space-y-1 mt-2">
                <li>Reducir el tamaño de posición antes del evento</li>
                <li>Evitar nuevas operaciones justo antes del evento</li>
                <li>Estar preparado para volatilidad extrema</li>
                <li>Esperar a que pase el evento para operar con más claridad</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Sección 6: Flags de riesgo */}
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="text-2xl">⚠️ Flags de riesgo</CardTitle>
            <CardDescription>
              Señales de alerta que debes considerar
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                <strong>Dónde revisar:</strong> Dashboard → Sección "Escenarios" y "Flags de Riesgo"
              </p>
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <p className="text-sm">
                  <strong>Interpretación:</strong> Los flags de riesgo te alertan sobre condiciones de mercado
                  que pueden ser peligrosas para operar.
                </p>
                <ul className="text-sm list-disc list-inside space-y-1 mt-2">
                  <li><strong>Estanflación:</strong> Inflación alta + crecimiento débil = mercado difícil</li>
                  <li><strong>Empleo enfriando:</strong> Puede indicar recesión próxima</li>
                  <li><strong>Correlaciones rotas:</strong> Cambio de régimen, alta incertidumbre</li>
                  <li><strong>VIX alto:</strong> Miedo en el mercado, volatilidad extrema</li>
                </ul>
              </div>
            </div>
            <div className="border-t pt-4">
              <p className="text-sm">
                <strong>Decisión:</strong> Si hay flags rojos activos:
              </p>
              <ul className="text-sm list-disc list-inside space-y-1 mt-2">
                <li>Reduce el tamaño de posición</li>
                <li>Considera esperar a que se resuelvan</li>
                <li>Evita operaciones de alto riesgo</li>
                <li>Mantén stops más ajustados</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Sección 7: Confirmación técnica */}
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="text-2xl">📈 Confirmación técnica</CardTitle>
            <CardDescription>
              Validación final con análisis técnico
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                <strong>Dónde revisar:</strong> Tu plataforma de trading (TradingView, MetaTrader, etc.)
              </p>
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <p className="text-sm">
                  <strong>Interpretación:</strong> El análisis macro te da la dirección, pero el análisis técnico
                  te da el timing y los niveles de entrada precisos.
                </p>
                <ul className="text-sm list-disc list-inside space-y-1 mt-2">
                  <li><strong>Estructura:</strong> ¿Está el precio en una tendencia clara?</li>
                  <li><strong>Niveles clave:</strong> ¿Hay soportes/resistencias importantes cerca?</li>
                  <li><strong>Momentum:</strong> ¿El movimiento tiene fuerza o está agotándose?</li>
                  <li><strong>Señales:</strong> ¿Hay confirmación técnica (BOS, ChoCH, etc.)?</li>
                </ul>
              </div>
            </div>
            <div className="border-t pt-4">
              <p className="text-sm">
                <strong>Decisión:</strong> Solo opera si:
              </p>
              <ul className="text-sm list-disc list-inside space-y-1 mt-2">
                <li>El análisis macro y técnico están alineados</li>
                <li>Tienes un nivel de entrada claro</li>
                <li>El stop loss está bien definido</li>
                <li>El take profit es razonable (mínimo 1:2 risk/reward)</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Sección 8: Checklist final */}
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="text-2xl">✅ Checklist final antes de operar</CardTitle>
            <CardDescription>
              Marca cada condición antes de abrir una posición
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <ChecklistItem label="Régimen global a favor" />
              <ChecklistItem label="Moneda fuerte contra débil" />
              <ChecklistItem label="Sesgo táctico alineado" />
              <ChecklistItem label="Convicción mínima Media" />
              <ChecklistItem label="Correlación que refuerza" />
              <ChecklistItem label="Sin flags rojos" />
              <ChecklistItem label="No hay noticias inminentes" />
              <ChecklistItem label="Setup técnico claro" />
            </div>
            <div className="border-t pt-4">
              <p className="text-sm text-muted-foreground">
                <strong>Regla de oro:</strong> Si no puedes marcar al menos 6 de 8 condiciones,
                considera esperar un mejor momento para operar.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Botón de descarga PDF */}
        <Card className="shadow-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4">
              <p className="text-sm text-muted-foreground text-center">
                Descarga la guía completa en PDF para consultarla offline
              </p>
              <a
                href="/docs/Guia_Uso_Dashboard_Macro.pdf"
                download
                className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
              >
                📄 Descargar Guía en PDF (ES)
              </a>
              <p className="text-xs text-muted-foreground">
                Versión EN próximamente
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

