import { Accordion } from '@/components/ui/accordion'

export function MacroOverviewIntroCard() {
  return (
    <Accordion
      title="ℹ️ ¿Cómo funciona esta página?"
      description="Guía rápida para interpretar el régimen macro, los indicadores clave y la fortaleza por moneda."
      defaultOpen={false}
    >
      <div className="space-y-6 text-sm text-foreground">
        {/* 1) Panorama global (Regime) */}
        <section>
          <h3 className="font-semibold mb-2">1) Panorama global (Régimen macro)</h3>
          <p className="mb-2">
            El bloque superior resume el <strong>régimen macro global</strong> a partir de los principales
            indicadores de crecimiento, inflación y política monetaria.
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong>Risk</strong>: indica si el entorno favorece <em>Risk ON</em> (activos de riesgo),
              <em>Risk OFF</em> (refugio) o está <em>Neutral</em>.
            </li>
            <li>
              <strong>Growth trend</strong>: si el crecimiento agregado está{' '}
              <em>acelerando</em>, <em>desacelerando</em> o <em>estable</em>.
            </li>
            <li>
              <strong>Inflation trend</strong>: misma idea pero aplicada a la inflación.
            </li>
            <li>
              <strong>USD direction</strong>: sesgo estructural del dólar (Fuerte / Débil / Neutral).
            </li>
            <li>
              <strong>De dónde sale</strong>: se construye en el backend y llega desde{' '}
              <code>/api/overview → regimeGlobal</code>.
            </li>
          </ul>
        </section>

        {/* 2) Core Indicators */}
        <section>
          <h3 className="font-semibold mb-2">2) Core Indicators</h3>
          <p className="mb-2">
            La tabla central muestra los <strong>indicadores macro clave</strong> para cada bloque
            (crecimiento, empleo, inflación, tipos), comparando el dato actual con el anterior.
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong>Value vs Previous</strong>: <em>value</em> es el último dato disponible y{' '}
              <em>previous</em> el dato anterior real (periodo previo). Si no hay histórico fiable,{' '}
              <em>previous</em> se muestra como “—”.
            </li>
            <li>
              <strong>Fechas</strong>: <em>date</em> y <em>date_previous</em> indican el periodo de cada
              dato (mes, trimestre, etc.). Son críticas para interpretar si el cambio es reciente o
              viene de atrás.
            </li>
            <li>
              <strong>Trend</strong>: resume el movimiento reciente:
              <ul className="list-disc pl-6 mt-1 space-y-1">
                <li>
                  <em>acelera</em>: el indicador se mueve en la dirección del sesgo (ej. PIB sube,
                  desempleo baja).
                </li>
                <li>
                  <em>desacelera</em>: pierde fuerza o gira en contra.
                </li>
                <li>
                  <em>estable</em>: cambios pequeños o ruido.
                </li>
              </ul>
            </li>
            <li>
              <strong>Importance</strong>: refleja solo el <em>peso estructural</em> del indicador en el
              modelo, no su fiabilidad:
              <ul className="list-disc pl-6 mt-1 space-y-1">
                <li>
                  <em>Alta</em>: peso ≥ 0.08 en <code>config/weights.json</code>.
                </li>
                <li>
                  <em>Media</em>: peso ≥ 0.04 y &lt; 0.08.
                </li>
                <li>
                  <em>Baja</em>: peso &lt; 0.04.
                </li>
              </ul>
            </li>
            <li>
              <strong>De dónde sale</strong>: se calcula en el backend y se expone como{' '}
              <code>/api/overview → coreIndicators</code>.
            </li>
          </ul>
        </section>

        {/* 3) Fortaleza macro por moneda */}
        <section>
          <h3 className="font-semibold mb-2">3) Fortaleza macro por moneda</h3>
          <p className="mb-2">
            El bloque de <strong>Fortaleza macro por moneda</strong> resume, para cada divisa, cómo de
            favorable es el entorno macro actual (crecimiento, inflación, empleo y política monetaria).
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong>Score</strong>: número entre aproximadamente -3 y +3 que agrega las señales macro
              para esa moneda.
            </li>
            <li>
              <strong>Status</strong>:
              <ul className="list-disc pl-6 mt-1 space-y-1">
                <li>
                  <em>Fuerte</em>: entorno estructuralmente positivo para esa divisa (sesgo alcista).
                </li>
                <li>
                  <em>Débil</em>: entorno macro adverso (sesgo bajista).
                </li>
                <li>
                  <em>Neutro</em>: sin ventaja clara o datos incompletos → score cercano a 0.
                </li>
              </ul>
            </li>
            <li>
              <strong>Origen de los datos</strong>: se basa en los{' '}
              <em>regímenes macro por moneda</em> calculados en el motor de diagnóstico y resumidos en{' '}
              <code>/api/overview → currencyScoreboard</code>.
            </li>
          </ul>
        </section>

        {/* 4) Cobertura por país */}
        <section>
          <h3 className="font-semibold mb-2">4) Cobertura por país</h3>
          <p className="mb-2">
            La franja inferior muestra la <strong>cobertura de datos</strong> por país/moneda, para que
            sepas dónde el modelo está bien alimentado y dónde conviene ser más prudente.
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong>available / total</strong>: cuántos indicadores relevantes tienen datos válidos
              frente al total esperado para ese país.
            </li>
            <li>
              <strong>staleCount</strong>: número de indicadores con datos antiguos (más de un umbral
              de días definido por tipo de serie).
            </li>
            <li>
              <strong>Status</strong>:
              <ul className="list-disc pl-6 mt-1 space-y-1">
                <li>
                  <em>OK</em>: cobertura ≥ 80% y <strong>sin</strong> datos obsoletos (
                  <code>staleCount === 0</code>).
                </li>
                <li>
                  <em>PARTIAL</em>: cobertura media (≥ 40%) o existe algún dato stale.
                </li>
                <li>
                  <em>LOW</em>: cobertura baja (&lt; 40%) o muy pocos indicadores con datos.
                </li>
              </ul>
            </li>
            <li>
              <strong>De dónde sale</strong>: se calcula a partir de los indicadores del dashboard y se
              expone como <code>/api/overview → countryCoverage</code>.
            </li>
          </ul>
        </section>
      </div>
    </Accordion>
  )
}

