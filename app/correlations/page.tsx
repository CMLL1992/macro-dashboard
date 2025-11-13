export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { getCorrelations } from "@/domain/corr-dashboard";
import CorrelationTooltip from "@/components/CorrelationTooltip";
import { usdBias } from "@/domain/bias";
import { getAllLatest } from "@/lib/fred";

export default async function CorrelationsPage() {
  const rows = await getCorrelations().catch((e) => {
    return { __error: String(e) } as any;
  });

  if ((rows as any).__error) {
    return (
      <div className="mx-auto max-w-7xl p-6">
        <h1 className="text-4xl font-bold mb-4">Correlaciones con USD Amplio</h1>
        <div className="rounded-lg border p-4 text-sm text-red-600 bg-red-50">
          Error cargando correlaciones: {(rows as any).__error}
        </div>
      </div>
    );
  }

  // Obtener sesgo USD para los tooltips
  const latestPoints = await getAllLatest()
  const usd = usdBias(latestPoints)

  const formatCorrCell = (value: number | null | undefined, window: '3m' | '6m' | '12m' | '24m', symbol: string, row: any) => {
    if (value == null || typeof value !== 'number') {
      return <span className="text-muted-foreground">n/a</span>
    }
    return (
      <CorrelationTooltip 
        correlation={value} 
        symbol={symbol} 
        window={window} 
        usdBias={usd}
        corr12m={row.corr12}
        corr3m={row.corr3}
      >
        <span className="cursor-help">{value.toFixed(2)}</span>
      </CorrelationTooltip>
    )
  }

  return (
    <div className="mx-auto max-w-7xl p-6 space-y-8">
      {/* Header con explicación extensa */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight mb-4">Correlaciones con USD Amplio</h1>
        <p className="text-lg text-muted-foreground mb-6">
          Análisis detallado de las correlaciones entre activos financieros y el dólar estadounidense (DXY)
        </p>

        {/* Sección explicativa principal */}
        <div className="rounded-lg border bg-card p-6 mb-6 space-y-4">
          <h2 className="text-2xl font-semibold mb-4">¿Qué son las Correlaciones?</h2>
          
          <div className="space-y-4 text-sm">
            <p className="text-foreground leading-relaxed">
              La correlación mide qué tan relacionado está el movimiento de un activo con el movimiento del dólar estadounidense (USD). Es un valor entre -1 y +1 que indica la fuerza y dirección de la relación.
            </p>

            <div className="grid md:grid-cols-3 gap-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="font-semibold text-green-900 mb-2">Correlación Positiva (+)</h3>
                <p className="text-green-800 text-sm leading-relaxed mb-2">
                  El activo se mueve en la misma dirección que el USD:
                </p>
                <ul className="text-xs text-green-700 space-y-1 list-disc list-inside">
                  <li>USD sube → Activo sube</li>
                  <li>USD baja → Activo baja</li>
                  <li>Valor cercano a +1 = correlación muy fuerte</li>
                </ul>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h3 className="font-semibold text-red-900 mb-2">Correlación Negativa (-)</h3>
                <p className="text-red-800 text-sm leading-relaxed mb-2">
                  El activo se mueve en dirección opuesta al USD:
                </p>
                <ul className="text-xs text-red-700 space-y-1 list-disc list-inside">
                  <li>USD sube → Activo baja</li>
                  <li>USD baja → Activo sube</li>
                  <li>Valor cercano a -1 = correlación inversa muy fuerte</li>
                </ul>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-2">Correlación Cero (0)</h3>
                <p className="text-gray-800 text-sm leading-relaxed mb-2">
                  No hay relación entre el activo y el USD:
                </p>
                <ul className="text-xs text-gray-700 space-y-1 list-disc list-inside">
                  <li>Los movimientos son independientes</li>
                  <li>El USD no afecta al activo</li>
                  <li>Valor cercano a 0 = sin correlación</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Ventanas temporales */}
        <div className="rounded-lg border bg-card p-6 mb-6 space-y-4">
          <h2 className="text-2xl font-semibold mb-4">Ventanas Temporales de Correlación</h2>
          
          <div className="space-y-4 text-sm">
            <p className="text-foreground leading-relaxed">
              Las correlaciones se calculan en diferentes períodos de tiempo. Cada ventana temporal proporciona información diferente sobre la relación entre el activo y el USD.
            </p>

            <div className="grid md:grid-cols-4 gap-4">
              <div className="border rounded-lg p-4 bg-muted/30">
                <h3 className="font-semibold mb-2 text-blue-700">3 Meses</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Correlación a corto plazo. Refleja movimientos recientes y puede ser más volátil. Útil para identificar cambios rápidos en la relación.
                </p>
              </div>

              <div className="border rounded-lg p-4 bg-muted/30">
                <h3 className="font-semibold mb-2 text-blue-700">6 Meses</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Correlación a medio plazo. Balance entre estabilidad y actualidad. Refleja tendencias intermedias.
                </p>
              </div>

              <div className="border rounded-lg p-4 bg-muted/30">
                <h3 className="font-semibold mb-2 text-blue-700">12 Meses</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Correlación a largo plazo. Más estable y refleja la relación estructural entre el activo y el USD. Es la más importante para decisiones estratégicas.
                </p>
              </div>

              <div className="border rounded-lg p-4 bg-muted/30">
                <h3 className="font-semibold mb-2 text-blue-700">24 Meses</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Correlación a muy largo plazo. Muestra la relación histórica fundamental. Útil para identificar cambios estructurales a largo plazo.
                </p>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-4">
              <h4 className="font-semibold text-yellow-900 mb-2">Interpretación de Divergencias</h4>
              <p className="text-yellow-800 text-sm leading-relaxed">
                Cuando la correlación a 3 meses difiere significativamente de la correlación a 12 meses, puede indicar:
              </p>
              <ul className="text-xs text-yellow-700 space-y-1 list-disc list-inside mt-2">
                <li>Un cambio estructural en la relación (si 3m se aleja de 12m de forma sostenida)</li>
                <li>Un movimiento temporal o de corrección (si 3m vuelve a alinearse con 12m)</li>
                <li>Una oportunidad de trading si el cambio es significativo</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Interpretación de señales */}
        <div className="rounded-lg border bg-card p-6 mb-6 space-y-4">
          <h2 className="text-2xl font-semibold mb-4">Interpretación de Señales</h2>
          
          <div className="space-y-4 text-sm">
            <p className="text-foreground leading-relaxed">
              La columna "Señal" proporciona una interpretación automática de la correlación basada en múltiples factores. Entender estas señales te ayuda a tomar mejores decisiones de trading.
            </p>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="border rounded-lg p-4 bg-emerald-50 border-emerald-200">
                <h3 className="font-semibold text-emerald-900 mb-2">Señales Alcistas</h3>
                <p className="text-emerald-800 text-sm leading-relaxed mb-2">
                  Indican que el activo tiene probabilidad de subir cuando:
                </p>
                <ul className="text-xs text-emerald-700 space-y-1 list-disc list-inside">
                  <li>El USD está débil y la correlación es negativa</li>
                  <li>El USD está fuerte y la correlación es positiva (menos común)</li>
                  <li>La correlación es estable y consistente entre ventanas</li>
                </ul>
              </div>

              <div className="border rounded-lg p-4 bg-rose-50 border-rose-200">
                <h3 className="font-semibold text-rose-900 mb-2">Señales Bajistas</h3>
                <p className="text-rose-800 text-sm leading-relaxed mb-2">
                  Indican que el activo tiene probabilidad de caer cuando:
                </p>
                <ul className="text-xs text-rose-700 space-y-1 list-disc list-inside">
                  <li>El USD está fuerte y la correlación es negativa</li>
                  <li>El USD está débil y la correlación es positiva (menos común)</li>
                  <li>Hay divergencias significativas entre ventanas temporales</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Uso práctico */}
        <div className="rounded-lg border bg-card p-6 space-y-4">
          <h2 className="text-2xl font-semibold mb-4">Uso Práctico de las Correlaciones</h2>
          
          <div className="space-y-4 text-sm">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2">1. Filtrar Operaciones</h3>
              <p className="text-blue-800 leading-relaxed">
                Usa las correlaciones para filtrar qué activos operar. Si el USD está fuerte y un activo tiene correlación negativa alta (-0.7 o más), es probable que ese activo caiga. Esto te ayuda a enfocarte en las operaciones con mayor probabilidad de éxito.
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2">2. Gestionar Riesgo</h3>
              <p className="text-blue-800 leading-relaxed">
                Si operas múltiples activos, entiende sus correlaciones para evitar sobre-exposición. Si varios activos tienen correlaciones similares, estás tomando esencialmente la misma posición múltiples veces, lo que aumenta el riesgo.
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2">3. Anticipar Movimientos</h3>
              <p className="text-blue-800 leading-relaxed">
                Cuando sabes que un indicador macro importante va a publicarse (como NFP o CPI), puedes anticipar cómo reaccionarán diferentes activos basándote en sus correlaciones con el USD. Esto te da una ventaja para posicionarte antes del evento.
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2">4. Confirmar Señales</h3>
              <p className="text-blue-800 leading-relaxed">
                Usa las correlaciones para confirmar señales de otros análisis. Si tu análisis técnico sugiere una dirección y la correlación con el USD la confirma, tienes mayor confianza en la operación.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabla de correlaciones */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">Tabla de Correlaciones</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Pasa el ratón sobre cada valor para ver una interpretación detallada. Los valores se actualizan automáticamente con datos mensuales.
        </p>
        <div className="overflow-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-semibold">Activo</th>
                <th className="text-left p-3 font-semibold">3m</th>
                <th className="text-left p-3 font-semibold">6m</th>
                <th className="text-left p-3 font-semibold">12m</th>
                <th className="text-left p-3 font-semibold">24m</th>
                <th className="text-left p-3 font-semibold">Señal</th>
                <th className="text-left p-3 font-semibold">Comentario</th>
              </tr>
            </thead>
            <tbody>
              {(rows as any[]).map((r, i) => (
                <tr key={i} className="border-t hover:bg-muted/30 transition-colors">
                  <td className="p-3 font-medium">{r.activo}</td>
                  <td className="p-3">{formatCorrCell(r.corr3, '3m', r.activo, r)}</td>
                  <td className="p-3">{formatCorrCell(r.corr6, '6m', r.activo, r)}</td>
                  <td className="p-3">{formatCorrCell(r.corr12, '12m', r.activo, r)}</td>
                  <td className="p-3">{formatCorrCell(r.corr24, '24m', r.activo, r)}</td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      r.señal?.toLowerCase().includes('alcista') ? 'bg-emerald-100 text-emerald-800' :
                      r.señal?.toLowerCase().includes('bajista') ? 'bg-rose-100 text-rose-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {r.señal || 'N/A'}
                    </span>
                  </td>
                  <td className="p-3 text-muted-foreground text-xs">{r.comentario || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Notas finales */}
      <div className="rounded-lg border bg-card p-6 mt-8">
        <h2 className="text-2xl font-semibold mb-4">Notas Importantes</h2>
        
        <div className="space-y-3 text-sm">
          <div className="flex items-start gap-3">
            <span className="text-primary font-bold">•</span>
            <p className="text-foreground leading-relaxed">
              <strong>Las correlaciones no son garantía:</strong> Una correlación alta no garantiza que el activo se moverá en la dirección esperada. Siempre confirma con price action y otros indicadores.
            </p>
          </div>

          <div className="flex items-start gap-3">
            <span className="text-primary font-bold">•</span>
            <p className="text-foreground leading-relaxed">
              <strong>Las correlaciones cambian:</strong> Las relaciones entre activos pueden cambiar con el tiempo, especialmente durante crisis o cambios de régimen macroeconómico. Revisa las correlaciones regularmente.
            </p>
          </div>

          <div className="flex items-start gap-3">
            <span className="text-primary font-bold">•</span>
            <p className="text-foreground leading-relaxed">
              <strong>Fuentes de datos:</strong> Las correlaciones se calculan usando datos de FRED (Federal Reserve), Stooq y Binance. Los datos se actualizan mensualmente.
            </p>
          </div>

          <div className="flex items-start gap-3">
            <span className="text-primary font-bold">•</span>
            <p className="text-foreground leading-relaxed">
              <strong>Correlación no implica causalidad:</strong> Que dos activos se muevan juntos no significa que uno cause el movimiento del otro. Ambos pueden estar reaccionando a los mismos factores macroeconómicos.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
