'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

export default function AyudaPage() {
  const [activeTab, setActiveTab] = useState<'educativo' | 'tecnico'>('tecnico')

  useEffect(() => {
    const hash = window.location.hash
    if (hash === '#tecnico') {
      setActiveTab('tecnico')
    } else if (hash === '#educativo') {
      setActiveTab('educativo')
    }
  }, [])

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const sections = [
    { id: 'regimen', label: 'Resumen del régimen' },
    { id: 'indicadores', label: 'Indicadores y lectura profesional' },
    { id: 'usd-y-sesgos', label: 'USD y transmisión al precio' },
    { id: 'correlaciones', label: 'Correlaciones con DXY (12m / 3m)' },
    { id: 'interpretacion-correlaciones', label: 'Interpretación técnica de correlaciones' },
    { id: 'confianza', label: 'Confianza de la señal' },
    { id: 'frescura', label: 'Frescura y calendarios' },
    { id: 'sesgo-por-par', label: 'Cómputo del sesgo por par' },
    { id: 'uso-semanal', label: 'Guía de uso semanal' },
    { id: 'glosario', label: 'Glosario macro' },
  ]

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Ayuda — Modo Técnico (Macroeconómico puro)</h1>
        <p className="text-muted-foreground">Guía de interpretación profesional de indicadores macro y sesgos</p>
      </div>

      <div className="border-b mb-6">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab('educativo')}
            className={`px-4 py-2 border-b-2 transition-colors ${
              activeTab === 'educativo'
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Modo educativo
          </button>
          <button
            onClick={() => setActiveTab('tecnico')}
            className={`px-4 py-2 border-b-2 transition-colors ${
              activeTab === 'tecnico'
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Modo técnico (macroeconómico)
          </button>
        </nav>
      </div>

      {activeTab === 'tecnico' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <aside className="lg:col-span-1">
            <div className="sticky top-6">
              <h2 className="font-semibold mb-3 text-sm uppercase tracking-wide">Índice</h2>
              <nav className="space-y-1">
                {sections.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => scrollToSection(section.id)}
                    className="block w-full text-left px-2 py-1 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
                  >
                    {section.label}
                  </button>
                ))}
              </nav>
            </div>
          </aside>

          <div className="lg:col-span-3 space-y-8">
            <section id="regimen" className="scroll-mt-6">
              <h2 className="text-2xl font-semibold mb-4">Resumen del régimen</h2>
              <div className="prose prose-sm max-w-none">
                <p className="mb-4">
                  El régimen clasifica el entorno combinando crecimiento, inflación, condiciones financieras (curva) y empleo.
                </p>
                <h3 className="text-lg font-semibold mt-6 mb-3">Cuadrantes típicos:</h3>
                <ul className="list-disc pl-6 space-y-2 mb-4">
                  <li><strong>Expansión:</strong> crecimiento ↑, inflación →/↑</li>
                  <li><strong>Sobrecalentamiento:</strong> crecimiento ↑, inflación ↑↑</li>
                  <li><strong>Desaceleración:</strong> crecimiento ↓, inflación ↓</li>
                  <li><strong>Estanflación:</strong> crecimiento ↓, inflación ↑</li>
                </ul>
                <h3 className="text-lg font-semibold mt-6 mb-3">Efecto típico:</h3>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Expansión/Risk-ON</strong> → acciones y cíclicos favorecidos; USD tiende a neutral/débil.</li>
                  <li><strong>Desaceleración/Risk-OFF</strong> → USD y bonos refugio favorecidos; riesgo presionado.</li>
                </ul>
              </div>
            </section>

            <section id="indicadores" className="scroll-mt-6">
              <h2 className="text-2xl font-semibold mb-4">Indicadores y lectura profesional</h2>
              <div className="prose prose-sm max-w-none space-y-6">
                <div className="border-l-4 border-primary pl-4">
                  <h3 className="font-semibold mb-2">Curva 10Y–2Y (spread %)</h3>
                  <p className="text-sm mb-1"><strong>Qué mide:</strong> Pendiente de tipos (10a–2a).</p>
                  <p className="text-sm mb-1"><strong>Por qué importa:</strong> Invertida = riesgo de desaceleración; normalizada = apetito riesgo.</p>
                  <p className="text-sm"><strong>Cómo afecta normalmente al USD:</strong> Inversión sostenida → USD refugio (↑). Normalización → USD neutral/débil.</p>
                </div>

                <div className="border-l-4 border-primary pl-4">
                  <h3 className="font-semibold mb-2">PIB (GDP) YoY / PIB QoQ anualizado</h3>
                  <p className="text-sm mb-1"><strong>Qué mide:</strong> Pulso de crecimiento económico.</p>
                  <p className="text-sm mb-1"><strong>Por qué importa:</strong> Alto y persistente = Fed hawkish (USD ↑). Flojo/negativo = refugio (USD ↑).</p>
                  <p className="text-sm"><strong>Cómo afecta normalmente al USD:</strong> Crecimiento fuerte → USD ↑ (Fed restrictiva). Crecimiento débil → USD ↑ (refugio) o ↓ (Fed dovish).</p>
                </div>

                <div className="border-l-4 border-primary pl-4">
                  <h3 className="font-semibold mb-2">Producción Industrial YoY</h3>
                  <p className="text-sm mb-1"><strong>Qué mide:</strong> Actividad manufacturera.</p>
                  <p className="text-sm mb-1"><strong>Por qué importa:</strong> Debilidad anticipa ciclo flojo.</p>
                  <p className="text-sm"><strong>Cómo afecta normalmente al USD:</strong> Caída persistente → USD refugio (↑). Fortaleza → USD neutral/débil.</p>
                </div>

                <div className="border-l-4 border-primary pl-4">
                  <h3 className="font-semibold mb-2">Ventas Minoristas YoY</h3>
                  <p className="text-sm mb-1"><strong>Qué mide:</strong> Consumo (70% del PIB USA).</p>
                  <p className="text-sm mb-1"><strong>Por qué importa:</strong> Flojo = demanda cede (Fed dovish; USD ↓).</p>
                  <p className="text-sm"><strong>Cómo afecta normalmente al USD:</strong> Consumo débil → USD ↓ (Fed dovish). Consumo fuerte → USD ↑ (Fed hawkish).</p>
                </div>

                <div className="border-l-4 border-primary pl-4">
                  <h3 className="font-semibold mb-2">NFP Δ (miles)</h3>
                  <p className="text-sm mb-1"><strong>Qué mide:</strong> Creación de empleo mensual.</p>
                  <p className="text-sm mb-1"><strong>Por qué importa:</strong> Alto = presión inflacionaria (Fed hawkish; USD ↑).</p>
                  <p className="text-sm"><strong>Cómo afecta normalmente al USD:</strong> NFP alto → USD ↑ (Fed restrictiva). NFP bajo → USD ↓ (Fed dovish).</p>
                </div>

                <div className="border-l-4 border-primary pl-4">
                  <h3 className="font-semibold mb-2">Desempleo U3</h3>
                  <p className="text-sm mb-1"><strong>Qué mide:</strong> Tasa de desempleo oficial.</p>
                  <p className="text-sm mb-1"><strong>Por qué importa:</strong> Subida persistente → recortes probables (USD ↓).</p>
                  <p className="text-sm"><strong>Cómo afecta normalmente al USD:</strong> Subida → USD ↓ (Fed dovish). Bajada → USD ↑ (Fed hawkish).</p>
                </div>

                <div className="border-l-4 border-primary pl-4">
                  <h3 className="font-semibold mb-2">Claims 4 semanas</h3>
                  <p className="text-sm mb-1"><strong>Qué mide:</strong> Media de solicitudes iniciales de subsidio por desempleo.</p>
                  <p className="text-sm mb-1"><strong>Por qué importa:</strong> Adelantado laboral; subida = enfriamiento (USD ↓ medio plazo).</p>
                  <p className="text-sm"><strong>Cómo afecta normalmente al USD:</strong> Subida → USD ↓ (enfriamiento). Bajada → USD ↑ (calentamiento).</p>
                </div>

                <div className="border-l-4 border-primary pl-4">
                  <h3 className="font-semibold mb-2">CPI / Core CPI / PCE / Core PCE / PPI YoY</h3>
                  <p className="text-sm mb-1"><strong>Qué mide:</strong> Inflación (consumidor, productor, gasto personal).</p>
                  <p className="text-sm mb-1"><strong>Por qué importa:</strong> Alta y pegajosa = USD ↑; desinflación = USD ↓.</p>
                  <p className="text-sm"><strong>Cómo afecta normalmente al USD:</strong> Inflación alta → USD ↑ (Fed restrictiva). Desinflación → USD ↓ (Fed dovish).</p>
                </div>

                <div className="border-l-4 border-primary pl-4">
                  <h3 className="font-semibold mb-2">VIX</h3>
                  <p className="text-sm mb-1"><strong>Qué mide:</strong> Índice de volatilidad implícita (miedo/riesgo).</p>
                  <p className="text-sm mb-1"><strong>Por qué importa:</strong> &gt;20–25 = riesgo alto (USD ↑); &lt;15 = riesgo bajo (USD ↓/neutral).</p>
                  <p className="text-sm"><strong>Cómo afecta normalmente al USD:</strong> VIX alto → USD ↑ (refugio). VIX bajo → USD neutral/débil.</p>
                </div>

                <div className="border-l-4 border-primary pl-4">
                  <h3 className="font-semibold mb-2">Tasa efectiva Fed Funds</h3>
                  <p className="text-sm mb-1"><strong>Qué mide:</strong> Nivel de restricción monetaria.</p>
                  <p className="text-sm mb-1"><strong>Por qué importa:</strong> Alto = condiciones duras (USD ↑).</p>
                  <p className="text-sm"><strong>Cómo afecta normalmente al USD:</strong> Tasa alta → USD ↑ (política restrictiva). Tasa baja → USD ↓ (política laxa).</p>
                </div>
              </div>
            </section>

            <section id="usd-y-sesgos" className="scroll-mt-6">
              <h2 className="text-2xl font-semibold mb-4">USD y transmisión al precio</h2>
              <div className="prose prose-sm max-w-none">
                <p className="mb-4">
                  <strong>USD fuerte:</strong> datos de crecimiento/empleo e inflación calientes → Fed hawkish → USD suele subir.
                </p>
                <p className="mb-4">
                  <strong>USD débil:</strong> desinflación + enfriamiento laboral → Fed dovish → USD suele bajar.
                </p>
                <p>
                  El USD actúa como canal de transmisión del contexto a los pares FX y a los activos riesgo.
                </p>
              </div>
            </section>

            <section id="correlaciones" className="scroll-mt-6">
              <h2 className="text-2xl font-semibold mb-4">Correlaciones con DXY (12m / 3m)</h2>
              <div className="prose prose-sm max-w-none">
                <p className="mb-4">
                  <strong>12m</strong> = referencia estructural; <strong>3m</strong> = reciente/condicional.
                </p>
                <h3 className="text-lg font-semibold mt-6 mb-3">Signo:</h3>
                <ul className="list-disc pl-6 space-y-2 mb-4">
                  <li><strong>Negativo</strong> (p. ej. EUR/USD): si DXY sube, el par tiende a caer.</li>
                  <li><strong>Positivo</strong> (p. ej. USD/JPY): si DXY sube, el par tiende a subir.</li>
                </ul>
                <p>
                  <strong>Coherencia:</strong> si 12m y 3m coinciden y son magnos (|r| ≥ 0.5), la relación es operativa. Si divergen, baja la confianza.
                </p>
              </div>
            </section>

            <section id="interpretacion-correlaciones" className="scroll-mt-6">
              <h2 className="text-2xl font-semibold mb-4">🧠 Interpretación técnica de la tabla de correlaciones con el USD (DXY)</h2>
              <div className="prose prose-sm max-w-none">
                <p className="mb-4">
                  La tabla de &quot;Correlaciones con USD amplio (mensual)&quot; muestra cómo se relacionan distintos activos con el dólar estadounidense medido a través del índice DXY. Esta sección es esencial para traders que necesitan entender cómo se transmite la fuerza o debilidad del USD hacia cada activo financiero.
                </p>

                <h3 className="text-lg font-semibold mt-6 mb-3">✅ Qué representa cada ventana temporal</h3>
                <ul className="list-disc pl-6 space-y-2 mb-4">
                  <li><strong>3m (corto plazo):</strong> sensibilidad reciente, reactividad a noticias y shocks.</li>
                  <li><strong>6m (medio plazo):</strong> comportamiento estabilizado.</li>
                  <li><strong>12m (tendencia macro predominante):</strong> relación histórica estable.</li>
                  <li><strong>24m (estructura extendida):</strong> ciclos largos de comportamiento.</li>
                </ul>

                <h3 className="text-lg font-semibold mt-6 mb-3">✅ Señal (Positiva / Negativa / Mixta)</h3>
                <ul className="list-disc pl-6 space-y-2 mb-4">
                  <li><strong>Positiva:</strong> el activo sube cuando sube el USD.</li>
                  <li><strong>Negativa:</strong> el activo cae cuando sube el USD.</li>
                  <li><strong>Mixta:</strong> relación inconsistente entre ventanas.</li>
                </ul>

                <h3 className="text-lg font-semibold mt-6 mb-3">✅ Interpretación de sensibilidad</h3>
                <ul className="list-disc pl-6 space-y-2 mb-4">
                  <li><strong>&gt; 0.60</strong> → sensibilidad alta</li>
                  <li><strong>0.30–0.60</strong> → sensibilidad media</li>
                  <li><strong>&lt; 0.30</strong> → sensibilidad baja o ruido</li>
                </ul>

                <h3 className="text-lg font-semibold mt-6 mb-3">✅ Cómo usar la correlación en tu análisis semanal</h3>
                <ol className="list-decimal pl-6 space-y-2 mb-4">
                  <li>Identifica el sesgo actual del USD (Fuerte / Débil / Neutral).</li>
                  <li>Mira la correlación a 12 meses → tendencia estructural.</li>
                  <li>Mira la correlación a 3 meses → confirmación o ruptura.</li>
                  <li>Si coinciden → alta confianza.</li>
                  <li>Si divergen → vigilar cambios de régimen.</li>
                  <li>Ajusta tu operativa según la sensibilidad.</li>
                </ol>

                <h3 className="text-lg font-semibold mt-6 mb-3">✅ Ejemplos prácticos</h3>
                <div className="bg-muted/50 border rounded-lg p-4 space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">Ejemplo 1 (EURUSD):</h4>
                    <p className="text-sm">
                      12m = -0.38 (relación inversa moderada).<br />
                      Si el USD se fortalece → probabilidad de caída en EURUSD.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Ejemplo 2 (USDCAD):</h4>
                    <p className="text-sm">
                      12m = 0.37 (relación directa).<br />
                      Si el USD se debilita → USDCAD tiende a caer.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Ejemplo 3 (GBPUSD divergente):</h4>
                    <p className="text-sm">
                      12m = -0.30 pero 3m = 0.77.<br />
                      Interpretación: hay fuerzas internas del Reino Unido que dominan en el corto plazo; no usar USD como referencia principal este mes.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section id="confianza" className="scroll-mt-6">
              <h2 className="text-2xl font-semibold mb-4">Confianza de la señal</h2>
              <div className="prose prose-sm max-w-none">
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Alta:</strong> USD claro (≠ neutral) + |corr12m| ≥ 0.70 y |corr3m| ≥ 0.50 y mismo signo.</li>
                  <li><strong>Media:</strong> USD claro pero una ventana es moderada (0.5–0.7) o 3m más débil.</li>
                  <li><strong>Baja:</strong> USD neutral o correlaciones flojas/contradictorias → preferir rango.</li>
                </ul>
              </div>
            </section>

            <section id="frescura" className="scroll-mt-6">
              <h2 className="text-2xl font-semibold mb-4">Frescura y calendarios</h2>
              <div className="prose prose-sm max-w-none">
                <p className="mb-4">
                  Cada indicador tiene frecuencia y SLA distintos:
                </p>
                <ul className="list-disc pl-6 space-y-2 mb-4">
                  <li><strong>Diario:</strong> 3 días hábiles (T10Y2Y, VIX)</li>
                  <li><strong>Semanal:</strong> 10 días naturales (Claims)</li>
                  <li><strong>Mensual:</strong> 60 días naturales (CPI, PCE, NFP, etc.)</li>
                  <li><strong>Trimestral:</strong> 150 días naturales (GDP)</li>
                </ul>
                <p>
                  El badge &quot;Desactualizado&quot; indica que el dato superó su ventana normal de publicación, no que sea inválido.
                </p>
              </div>
            </section>

            <section id="sesgo-por-par" className="scroll-mt-6">
              <h2 className="text-2xl font-semibold mb-4">Cómputo del sesgo por par</h2>
              <div className="prose prose-sm max-w-none">
                <p className="mb-4">
                  <strong>Tendencia (macro):</strong> deriva del estado USD + régimen + agregados de categorías.
                </p>
                <h3 className="text-lg font-semibold mt-6 mb-3">Acción:</h3>
                <ul className="list-disc pl-6 space-y-2 mb-4">
                  <li>Buscar compras si USD débil y corr(DXY, par) es negativa y significativa.</li>
                  <li>Buscar ventas si USD fuerte y corr es positiva y significativa.</li>
                  <li>Rango/táctico si USD neutral o correlaciones débiles/contradictorias.</li>
                </ul>
                <p className="mb-4">
                  <strong>Motivo:</strong> resume el driver (ej.: &quot;USD débil ⇒ Buscar compras&quot;).
                </p>
                <p>
                  <strong>Temporalidad:</strong> sesgo para 3–10 días (swing/semana), no intradía.
                </p>
              </div>
            </section>

            <section id="uso-semanal" className="scroll-mt-6">
              <h2 className="text-2xl font-semibold mb-4">Guía de uso semanal</h2>
              <div className="prose prose-sm max-w-none">
                <div className="bg-muted/50 border rounded-lg p-4">
                  <h3 className="text-lg font-semibold mb-3">Checklist de 5 pasos:</h3>
                  <ol className="list-decimal pl-6 space-y-2">
                    <li>Revisa USD (Débil/Fuerte/Neutral).</li>
                    <li>Mira correlaciones 12m/3m del par.</li>
                    <li>Valida Confianza (Alta/Media/Baja).</li>
                    <li>Alinea tu price action (D/H4) con la dirección.</li>
                    <li>Si USD neutral → prioriza rango/táctico.</li>
                  </ol>
                </div>
              </div>
            </section>

            <section id="glosario" className="scroll-mt-6">
              <h2 className="text-2xl font-semibold mb-4">Glosario macro</h2>
              <div className="prose prose-sm max-w-none">
                <dl className="space-y-3">
                  <div>
                    <dt className="font-semibold">Dovish/Hawkish:</dt>
                    <dd className="ml-4 text-muted-foreground">Laxa/restrictiva (política monetaria).</dd>
                  </div>
                  <div>
                    <dt className="font-semibold">YoY/QoQ:</dt>
                    <dd className="ml-4 text-muted-foreground">Interanual/intertrimestral (QoQ anualizado en GDP).</dd>
                  </div>
                  <div>
                    <dt className="font-semibold">Risk-ON/Risk-OFF:</dt>
                    <dd className="ml-4 text-muted-foreground">Apetito/aversión por riesgo.</dd>
                  </div>
                  <div>
                    <dt className="font-semibold">Spread 10Y–2Y:</dt>
                    <dd className="ml-4 text-muted-foreground">Pendiente curva; invertida = tensión macro futura.</dd>
                  </div>
                  <div>
                    <dt className="font-semibold">Core:</dt>
                    <dd className="ml-4 text-muted-foreground">Sin alimentos/energía (ruido menor).</dd>
                  </div>
                  <div>
                    <dt className="font-semibold">U3:</dt>
                    <dd className="ml-4 text-muted-foreground">Tasa de desempleo oficial.</dd>
                  </div>
                  <div>
                    <dt className="font-semibold">Claims:</dt>
                    <dd className="ml-4 text-muted-foreground">Nuevas solicitudes de subsidio por desempleo.</dd>
                  </div>
                  <div>
                    <dt className="font-semibold">PPI/CPI/PCE:</dt>
                    <dd className="ml-4 text-muted-foreground">Productor/consumidor/gasto personal (inflación).</dd>
                  </div>
                </dl>
              </div>
            </section>
          </div>
        </div>
      )}

      {activeTab === 'educativo' && (
        <div className="prose prose-sm max-w-none">
          <p className="text-muted-foreground">Contenido educativo en desarrollo...</p>
        </div>
      )}
    </div>
  )
}

