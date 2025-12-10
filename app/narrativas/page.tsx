import getBiasState from '@/domain/macro-engine/bias'
import getCorrelationState from '@/domain/macro-engine/correlations'
import { Accordion } from '@/components/ui/accordion'
import { NarrativasSearch } from '@/components/NarrativasSearch'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type NarrativeRow = {
  par: string
  tactico: string
  accion: string
  confianza: string
  motivo: string
  corrRef: string
  corr12m: number | null
  corr3m: number | null
}

const normalizeSymbol = (symbol?: string | null) =>
  symbol ? symbol.replace('/', '').toUpperCase() : ''

function buildNarrativeRows(tableTactical: any[], correlationShifts: any[]): NarrativeRow[] {
  const shiftBySymbol = new Map<string, any>()

  for (const shift of correlationShifts) {
    const symbolKey = normalizeSymbol(shift?.symbol)
    if (!symbolKey) continue
    shiftBySymbol.set(symbolKey, shift)
  }

  return tableTactical.map((row) => {
    const normalized = normalizeSymbol(row?.pair || row?.symbol)
    const shift = normalized ? shiftBySymbol.get(normalized) : undefined

    return {
      par: row?.pair ?? row?.symbol ?? shift?.symbol ?? '—',
      tactico: row?.trend ?? row?.tactico ?? 'Neutral',
      accion: row?.action ?? row?.accion ?? 'Rango/táctico',
      confianza: row?.confidence ?? row?.confianza ?? 'Media',
      motivo: row?.motive ?? row?.motivo ?? 'Sin narrativa disponible.',
      corrRef: shift?.benchmark ?? row?.benchmark ?? 'DXY',
      corr12m: row?.corr12m ?? shift?.corr12m ?? null,
      corr3m: row?.corr3m ?? shift?.corr3m ?? null,
    }
  })
}

const USD_LABELS: Record<string, 'Fuerte' | 'Débil' | 'Neutral'> = {
  Bullish: 'Fuerte',
  Bearish: 'Débil',
  Neutral: 'Neutral',
}

export default async function NarrativasPage() {
  let biasState: Awaited<ReturnType<typeof getBiasState>> | null = null
  let correlationState: Awaited<ReturnType<typeof getCorrelationState>> | null = null
  let error: string | null = null

  try {
    const results = await Promise.all([
      getBiasState().catch((err) => {
        console.error('[NarrativasPage] getBiasState failed', { error: err instanceof Error ? err.message : String(err) })
        throw err
      }),
      getCorrelationState().catch((err) => {
        console.error('[NarrativasPage] getCorrelationState failed', { error: err instanceof Error ? err.message : String(err) })
        throw err
      }),
    ])
    biasState = results[0]
    correlationState = results[1]
  } catch (err) {
    error = err instanceof Error ? err.message : 'Error desconocido al cargar datos'
    console.error('[NarrativasPage] Failed to load data', { error })
  }

  if (error || !biasState || !correlationState) {
    return (
      <main className="p-6 max-w-7xl mx-auto">
        {/* Explicación de la página Narrativas */}
        <section className="rounded-lg border bg-card p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            📚 ¿Qué muestra esta página?
          </h2>
          <div className="space-y-4 text-sm text-foreground">
            <div>
              <h3 className="font-semibold mb-2">1️⃣ ¿Qué es una Narrativa Macro?</h3>
              <p className="mb-2">
                Una narrativa macro es una explicación del "por qué" detrás de los movimientos del mercado. 
                Combina múltiples indicadores y eventos para crear una historia coherente del contexto macro actual.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">2️⃣ Columnas de la Tabla</h3>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Par:</strong> El activo analizado (ej: EURUSD, XAUUSD)</li>
                <li><strong>Táctico:</strong> Sesgo macro (Alcista/Bajista/Neutral)</li>
                <li><strong>Acción:</strong> Qué hacer según el sesgo (Buscar compras/Buscar ventas/Rango)</li>
                <li><strong>Confianza:</strong> Alta/Media/Baja - qué tan fuerte es la señal</li>
                <li><strong>Motivo:</strong> La narrativa completa explicando el razonamiento</li>
                <li><strong>Correlación:</strong> Relación histórica con el benchmark (DXY)</li>
              </ul>
            </div>
          </div>
        </section>

        <div className="mb-8">
          <h1 className="text-4xl font-bold tracking-tight mb-4">Narrativas Macroeconómicas</h1>
          <p className="text-lg text-muted-foreground mb-6">
            Análisis detallado de las narrativas macroeconómicas que impulsan los movimientos de los activos financieros
          </p>
        </div>
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 p-6">
          <h2 className="text-lg font-semibold text-red-900 dark:text-red-200 mb-2">Error al cargar datos</h2>
          <p className="text-sm text-red-800 dark:text-red-300">{error || 'Error desconocido'}</p>
          <p className="text-xs text-red-700 dark:text-red-400 mt-2">Por favor, intenta recargar la página o contacta al administrador.</p>
        </div>
      </main>
    )
  }

  const tacticalRows = Array.isArray(biasState.tableTactical) ? biasState.tableTactical : []
  const rows: NarrativeRow[] = buildNarrativeRows(tacticalRows, correlationState.shifts)
  const usd = USD_LABELS[biasState.regime.usd_direction] ?? biasState.regime.usd_direction
  const quad = biasState.regime.quad
  const overallRegime = biasState.regime.overall
  const liquidity = biasState.regime.liquidity
  const credit = biasState.regime.credit
  const risk = biasState.regime.risk

  if (!rows.length) {
    return (
      <main className="p-6 max-w-7xl mx-auto">
        {/* Explicación de la página Narrativas */}
        <section className="rounded-lg border bg-card p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            📚 ¿Qué muestra esta página?
          </h2>
          <div className="space-y-4 text-sm text-foreground">
            <div>
              <h3 className="font-semibold mb-2">1️⃣ ¿Qué es una Narrativa Macro?</h3>
              <p className="mb-2">
                Una narrativa macro es una explicación del "por qué" detrás de los movimientos del mercado. 
                Combina múltiples indicadores y eventos para crear una historia coherente del contexto macro actual.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">2️⃣ Columnas de la Tabla</h3>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Par:</strong> El activo analizado (ej: EURUSD, XAUUSD)</li>
                <li><strong>Táctico:</strong> Sesgo macro (Alcista/Bajista/Neutral)</li>
                <li><strong>Acción:</strong> Qué hacer según el sesgo (Buscar compras/Buscar ventas/Rango)</li>
                <li><strong>Confianza:</strong> Alta/Media/Baja - qué tan fuerte es la señal</li>
                <li><strong>Motivo:</strong> La narrativa completa explicando el razonamiento</li>
                <li><strong>Correlación:</strong> Relación histórica con el benchmark (DXY)</li>
              </ul>
            </div>
            <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mt-4">
              <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-200 mb-2">🔒 Recordatorio</p>
              <p className="text-xs text-yellow-800 dark:text-yellow-300">
                Las narrativas explican el contexto macro, no generan señales de entrada. 
                Tú decides tus operaciones combinando esta información con análisis técnico y gestión de riesgo.
              </p>
            </div>
          </div>
        </section>

        <div className="mb-8">
          <h1 className="text-4xl font-bold tracking-tight mb-4">Narrativas Macroeconómicas</h1>
          <p className="text-lg text-muted-foreground mb-6">
            Análisis detallado de las narrativas macroeconómicas que impulsan los movimientos de los activos financieros
          </p>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <p className="text-muted-foreground">No hay narrativas disponibles. Los datos se actualizan automáticamente con el cálculo de bias.</p>
        </div>
      </main>
    )
  }

  return (
    <main className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Explicación de la página Narrativas */}
      <Accordion 
        title="📚 ¿Qué muestra esta página?"
        description="Guía completa para entender las narrativas macroeconómicas y cómo interpretarlas"
      >
        <div className="space-y-4 text-sm text-foreground">
          <div>
            <h3 className="font-semibold mb-2">1️⃣ ¿Qué es una Narrativa Macro?</h3>
            <p className="mb-2">
              Una narrativa macro es una explicación del "por qué" detrás de los movimientos del mercado. 
              Combina múltiples indicadores y eventos para crear una historia coherente del contexto macro actual.
            </p>
            <p className="text-xs text-muted-foreground">
              <strong>Ejemplo:</strong> "El USD se fortalece porque los datos de empleo e inflación superan expectativas, 
              lo que mantiene a la Fed en postura hawkish. Esto presiona a los pares con correlación negativa como EURUSD."
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">2️⃣ Columnas de la Tabla</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Par:</strong> El activo analizado (ej: EURUSD, XAUUSD)</li>
              <li><strong>Táctico:</strong> Sesgo macro (Alcista/Bajista/Neutral)</li>
              <li><strong>Acción:</strong> Qué hacer según el sesgo (Buscar compras/Buscar ventas/Rango)</li>
              <li><strong>Confianza:</strong> Alta/Media/Baja - qué tan fuerte es la señal</li>
              <li><strong>Motivo:</strong> La narrativa completa explicando el razonamiento</li>
              <li><strong>Correlación:</strong> Relación histórica con el benchmark (DXY)</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold mb-2">3️⃣ Cómo Interpretar las Narrativas</h3>
            <p className="mb-2">
              Cada narrativa explica:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>El contexto macro actual:</strong> Régimen, USD direction, cuadrante</li>
              <li><strong>Los indicadores clave:</strong> Qué datos están impulsando el movimiento</li>
              <li><strong>La relación con correlaciones:</strong> Cómo se transmite el contexto al precio</li>
              <li><strong>La dirección sugerida:</strong> Por qué el sesgo es Alcista/Bajista/Neutral</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold mb-2">4️⃣ Niveles de Confianza</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Alta:</strong> Múltiples factores macro alineados, correlaciones fuertes y consistentes</li>
              <li><strong>Media:</strong> Señales presentes pero con algunas contradicciones menores</li>
              <li><strong>Baja:</strong> Señales débiles o contradictorias, mejor usar análisis técnico</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold mb-2">5️⃣ Cómo Usar las Narrativas</h3>
            <ol className="list-decimal pl-6 space-y-1">
              <li>Lee la narrativa para entender el contexto macro</li>
              <li>Verifica el nivel de confianza</li>
              <li>Revisa las correlaciones para validar la transmisión al precio</li>
              <li>Combina con tu análisis técnico para timing de entrada</li>
              <li>Usa la narrativa para explicar tu estrategia a otros traders</li>
            </ol>
          </div>
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mt-4">
            <p className="text-sm font-semibold text-yellow-900 dark:text-yellow-300 mb-2">🔒 Recordatorio</p>
            <p className="text-xs text-yellow-800 dark:text-yellow-200">
              Las narrativas explican el contexto macro, no generan señales de entrada. 
              Tú decides tus operaciones combinando esta información con análisis técnico y gestión de riesgo.
            </p>
          </div>
        </div>
      </Accordion>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight mb-4">Narrativas Macroeconómicas</h1>
        <p className="text-lg text-muted-foreground mb-6">
          Análisis detallado de las narrativas macroeconómicas que impulsan los movimientos de los activos financieros
        </p>
      </div>

      {/* Contexto macro actual */}
      <div className="rounded-lg border bg-card p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Contexto Macroeconómico Actual</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-muted/30 rounded-lg p-4">
            <div className="text-xs text-muted-foreground mb-1">Régimen General</div>
            <div className="text-lg font-semibold">{overallRegime}</div>
          </div>
          <div className="bg-muted/30 rounded-lg p-4">
            <div className="text-xs text-muted-foreground mb-1">USD</div>
            <div className="text-lg font-semibold">{usd}</div>
          </div>
          <div className="bg-muted/30 rounded-lg p-4">
            <div className="text-xs text-muted-foreground mb-1">Cuadrante</div>
            <div className="text-lg font-semibold">{quad}</div>
          </div>
          <div className="bg-muted/30 rounded-lg p-4">
            <div className="text-xs text-muted-foreground mb-1">Liquidez</div>
            <div className="text-lg font-semibold">{liquidity}</div>
          </div>
          <div className="bg-muted/30 rounded-lg p-4">
            <div className="text-xs text-muted-foreground mb-1">Crédito</div>
            <div className="text-lg font-semibold">{credit}</div>
          </div>
          <div className="bg-muted/30 rounded-lg p-4">
            <div className="text-xs text-muted-foreground mb-1">Apetito de Riesgo</div>
            <div className="text-lg font-semibold">{risk}</div>
          </div>
        </div>
        <div className="mt-4 text-xs text-muted-foreground">
          Última actualización: {biasState.updatedAt ? new Date(biasState.updatedAt).toLocaleString('es-ES') : 'N/A'}
        </div>
      </div>


      {/* Grid de narrativas */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">Narrativas por Activo</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Haz clic en cualquier activo para ver el análisis detallado de su narrativa macroeconómica
        </p>

        <NarrativasSearch rows={rows} />
      </div>

    </main>
  )
}
