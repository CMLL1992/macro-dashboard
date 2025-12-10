export const dynamic = 'force-dynamic'

import { Accordion } from '@/components/ui/accordion'

export default function AyudaPage() {
  return (
    <main className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Guía Completa del Dashboard</h1>
        <p className="text-muted-foreground">Documentación exhaustiva de todas las funcionalidades y características del Macro Dashboard</p>
      </div>

      <div className="space-y-8">
        {/* 1) Introducción */}
        <section>
          <Accordion 
            title="📍 1. Introducción al Dashboard"
            description="¿Qué es el Macro Dashboard y qué ofrece?"
          >
            <div className="space-y-4 text-sm text-foreground">
              <div>
                <h3 className="font-semibold mb-2">¿Qué es el Macro Dashboard?</h3>
                <p className="mb-3">
                  El Macro Dashboard es una herramienta profesional diseñada para proporcionarte <strong>contexto macroeconómico en tiempo real</strong> y 
                  <strong> narrativa institucional</strong> que te ayude a tomar decisiones de trading informadas. 
                  Combina datos de múltiples fuentes oficiales (FRED, ECB, BoE, BoJ, RBA, FOMC) para darte una visión completa del panorama macro.
                </p>
              </div>
              
              <div>
                <h3 className="font-semibold mb-2">✅ Qué SÍ ofrece:</h3>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Contexto macro real-time:</strong> Indicadores económicos actualizados automáticamente tras cada release importante</li>
                  <li><strong>Narrativa institucional:</strong> Explicación del "por qué" detrás de los movimientos macro</li>
                  <li><strong>Sesgos tácticos:</strong> Dirección macro sugerida para cada activo (Alcista/Bajista/Neutral) con niveles de confianza</li>
                  <li><strong>Régimen global:</strong> Clasificación del entorno macro actual (Risk ON/OFF, USD Direction, Quad, Liquidez, Crédito)</li>
                  <li><strong>Regímenes por moneda:</strong> Análisis independiente para USD, EUR, GBP, JPY y AUD</li>
                  <li><strong>Correlaciones:</strong> Relación histórica entre activos y el dólar (DXY) en múltiples ventanas temporales</li>
                  <li><strong>Calendario económico:</strong> Eventos programados con escenarios what-if (mejor/peor/estable)</li>
                  <li><strong>Notificaciones automáticas:</strong> Alertas en Telegram para eventos importantes, cambios de confianza, releases, etc.</li>
                  <li><strong>Escenarios institucionales:</strong> Identificación automática de setups con alta/media confianza</li>
                </ul>
              </div>
              
              <div>
                <h3 className="font-semibold mb-2">❌ Qué NO ofrece:</h3>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Señales de entrada:</strong> No te dice cuándo comprar o vender</li>
                  <li><strong>Stop Loss / Take Profit:</strong> No proporciona niveles automáticos</li>
                  <li><strong>Ejecución automática:</strong> No ejecuta trades por ti</li>
                  <li><strong>Recomendaciones automáticas:</strong> Tú decides tus trades basándote en la información</li>
                </ul>
              </div>

              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mt-4">
                <p className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-2">💡 Filosofía del Dashboard</p>
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  "Información para traders inteligentes, decisiones para traders responsables."
                  El dashboard te empodera con contexto macro profundo, pero mantienes el control total sobre tus decisiones de trading.
                </p>
              </div>
            </div>
          </Accordion>
        </section>

        {/* 2) Página Dashboard */}
        <section>
          <Accordion 
            title="📊 2. Página Dashboard (Principal)"
            description="Vista general del régimen macro, indicadores, sesgos y escenarios"
          >
            <div className="space-y-4 text-sm text-foreground">
              <div>
                <h3 className="font-semibold mb-2">2.1 Régimen Global del Mercado</h3>
                <p className="mb-2">
                  El <strong>Régimen Global</strong> clasifica el entorno macroeconómico actual combinando múltiples factores. 
                  Te ayuda a entender el contexto general antes de analizar activos específicos.
                </p>
                <div className="bg-muted/50 dark:bg-muted/30 border rounded-lg p-4 space-y-3">
                  <div>
                    <h4 className="font-semibold mb-1">Risk ON / Risk OFF</h4>
                    <p className="text-sm mb-2"><strong>Risk ON:</strong> Apetito por riesgo alto. Los inversores buscan activos de riesgo (acciones, commodities, monedas de países emergentes).</p>
                    <p className="text-sm"><strong>Risk OFF:</strong> Aversión al riesgo. Los inversores buscan refugio seguro (USD, bonos, oro).</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      <strong>Interpretación:</strong> En Risk ON, el USD suele ser neutral o débil. En Risk OFF, el USD tiende a fortalecerse como refugio.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-1">USD Direction</h4>
                    <p className="text-sm mb-2">Indica la dirección macro del dólar estadounidense:</p>
                    <ul className="list-disc pl-6 space-y-1 text-sm">
                      <li><strong>Fuerte:</strong> Datos de crecimiento/empleo e inflación calientes → Fed hawkish → USD sube</li>
                      <li><strong>Débil:</strong> Desinflación + enfriamiento laboral → Fed dovish → USD baja</li>
                      <li><strong>Neutral:</strong> Señales mixtas o transición entre regímenes</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-1">Macro Quad (Cuadrante)</h4>
                    <p className="text-sm mb-2">Clasifica el entorno según crecimiento e inflación:</p>
                    <ul className="list-disc pl-6 space-y-1 text-sm">
                      <li><strong>Reflation:</strong> Crecimiento ↑, Inflación →/↑ (expansión económica)</li>
                      <li><strong>Stagflation:</strong> Crecimiento ↓, Inflación ↑ (estanflación - situación difícil)</li>
                      <li><strong>Recession:</strong> Crecimiento ↓, Inflación ↓ (desaceleración)</li>
                      <li><strong>Goldilocks:</strong> Crecimiento estable, Inflación controlada (zona ideal)</li>
                      <li><strong>Mixed:</strong> Señales mixtas o transición</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-1">Liquidity (Liquidez)</h4>
                    <p className="text-sm mb-2">Condiciones de liquidez del mercado:</p>
                    <ul className="list-disc pl-6 space-y-1 text-sm">
                      <li><strong>Alta:</strong> Condiciones monetarias laxas, dinero disponible → favorable para activos de riesgo</li>
                      <li><strong>Baja:</strong> Condiciones restrictivas, escasez de liquidez → presión sobre activos de riesgo</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-1">Credit (Crédito)</h4>
                    <p className="text-sm mb-2">Estado del crédito y condiciones financieras:</p>
                    <ul className="list-disc pl-6 space-y-1 text-sm">
                      <li><strong>Expansión:</strong> Crédito disponible, condiciones favorables → crecimiento económico</li>
                      <li><strong>Contracción:</strong> Crédito restringido, condiciones duras → desaceleración económica</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">2.2 Regímenes Macro por Moneda</h3>
                <p className="mb-2">
                  Cada moneda principal (USD, EUR, GBP, JPY, AUD) tiene su propio régimen macro calculado independientemente. 
                  Esto te permite comparar la fortaleza relativa de diferentes monedas.
                </p>
                <div className="bg-muted/50 dark:bg-muted/30 border rounded-lg p-4 space-y-3">
                  <div>
                    <h4 className="font-semibold mb-1">Scores Macro</h4>
                    <p className="text-sm">
                      Cada moneda tiene un <strong>score macro</strong> que resume la fortaleza o debilidad de sus fundamentos económicos. 
                      Este score se calcula combinando múltiples indicadores (inflación, crecimiento, empleo, política monetaria, etc.).
                    </p>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-1">Regímenes Posibles</h4>
                    <ul className="list-disc pl-6 space-y-1 text-sm">
                      <li><strong>🟠 Reflación:</strong> Crecimiento económico fuerte, inflación moderada o en aumento</li>
                      <li><strong>🔴 Estanflación:</strong> Crecimiento débil pero inflación alta (situación difícil)</li>
                      <li><strong>🔵 Recesión:</strong> Crecimiento negativo o muy débil, inflación baja</li>
                      <li><strong>🟢 Goldilocks:</strong> Crecimiento estable y sostenible, inflación controlada (ideal)</li>
                      <li><strong>⚪ Mixto:</strong> Señales mixtas, transición entre regímenes</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-1">Probabilidad</h4>
                    <p className="text-sm">
                      Cada régimen muestra un <strong>porcentaje de probabilidad</strong> que indica qué tan probable es que ese régimen sea el correcto según los datos actuales.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-1">Cómo Comparar Monedas</h4>
                    <p className="text-sm mb-2">
                      Compara los <strong>scores macro</strong> y <strong>regímenes</strong> de diferentes monedas para identificar:
                    </p>
                    <ul className="list-disc pl-6 space-y-1 text-sm">
                      <li><strong>Moneda macro fuerte:</strong> Score alto, régimen favorable (ej: Goldilocks, Reflation)</li>
                      <li><strong>Moneda macro débil:</strong> Score bajo, régimen desfavorable (ej: Recession, Stagflation)</li>
                    </ul>
                    <p className="text-xs text-muted-foreground mt-2">
                      <strong>Ejemplo:</strong> Si EUR tiene score 0.8 (Goldilocks) y GBP tiene score -0.3 (Recession), 
                      el EUR es macro más fuerte que el GBP. Esto sugiere que EURGBP podría tener sesgo alcista.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">2.3 Indicadores Económicos</h3>
                <p className="mb-2">
                  La tabla muestra los indicadores macro más importantes con información detallada sobre cada uno.
                </p>
                <div className="bg-muted/50 dark:bg-muted/30 border rounded-lg p-4 space-y-3">
                  <div>
                    <h4 className="font-semibold mb-1">Valor Actual</h4>
                    <p className="text-sm">El último valor publicado del indicador. Se actualiza automáticamente tras cada release económico.</p>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-1">Valor Previo</h4>
                    <p className="text-sm">El valor anterior del indicador. Te permite comparar si ha mejorado o empeorado.</p>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-1">Tendencia (Mejora / Empeora / Estable)</h4>
                    <p className="text-sm mb-2">
                      Indica la dirección del cambio respecto al valor anterior:
                    </p>
                    <ul className="list-disc pl-6 space-y-1 text-sm">
                      <li><strong>Mejora:</strong> El indicador ha mejorado (ej: desempleo baja, crecimiento sube)</li>
                      <li><strong>Empeora:</strong> El indicador ha empeorado (ej: desempleo sube, crecimiento baja)</li>
                      <li><strong>Estable:</strong> Sin cambios significativos</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-1">Postura (Hawkish / Neutral / Dovish)</h4>
                    <p className="text-sm mb-2">
                      Indica qué implica el valor actual para la política monetaria:
                    </p>
                    <ul className="list-disc pl-6 space-y-1 text-sm">
                      <li><strong>Hawkish:</strong> Presiona hacia política restrictiva (subir tasas) → normalmente fortalece la moneda</li>
                      <li><strong>Neutral:</strong> No presiona hacia cambios significativos</li>
                      <li><strong>Dovish:</strong> Presiona hacia política laxa (bajar tasas) → normalmente debilita la moneda</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-1">Peso</h4>
                    <p className="text-sm">
                      Indica qué tan importante es este indicador en el cálculo del score macro. 
                      Indicadores con mayor peso tienen más influencia en la dirección general.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-1">Score</h4>
                    <p className="text-sm">
                      Contribución de este indicador al score total de la moneda. 
                      Valores positivos fortalecen la moneda, valores negativos la debilitan.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">2.4 Últimos Eventos Macro</h3>
                <p className="mb-2">
                  Muestra los releases económicos más recientes y su impacto en los scores de las monedas.
                </p>
                <div className="bg-muted/50 dark:bg-muted/30 border rounded-lg p-4 space-y-3">
                  <div>
                    <h4 className="font-semibold mb-1">Información Mostrada</h4>
                    <ul className="list-disc pl-6 space-y-1 text-sm">
                      <li><strong>Evento:</strong> Nombre del indicador publicado (ej: NFP, CPI)</li>
                      <li><strong>Sorpresa:</strong> Diferencia entre el valor real y el consenso esperado</li>
                      <li><strong>Dirección:</strong> Positiva (mejor de lo esperado) o Negativa (peor de lo esperado)</li>
                      <li><strong>Score Antes/Después:</strong> Comparación del score macro antes y después del evento</li>
                      <li><strong>Impacto:</strong> Cuánto cambió el score de la moneda tras el release</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-1">Cómo Interpretarlo</h4>
                    <p className="text-sm">
                      Los eventos con sorpresas grandes y positivas fortalecen la moneda. 
                      Los eventos con sorpresas negativas la debilitan. 
                      El dashboard recalcula automáticamente los scores macro tras cada release importante.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">2.5 Escenarios Institucionales</h3>
                <p className="mb-2">
                  Identificación automática de setups con alta o media confianza basados en el contexto macro.
                </p>
                <div className="bg-muted/50 dark:bg-muted/30 border rounded-lg p-4 space-y-3">
                  <div>
                    <h4 className="font-semibold mb-1">Escenarios Activos (Confianza Alta)</h4>
                    <p className="text-sm mb-2">
                      Pares con bias fuerte y confianza Alta. Estos escenarios sugieren operar con tamaño normal.
                    </p>
                    <ul className="list-disc pl-6 space-y-1 text-sm">
                      <li>Muestran dirección (BUY/SELL) y razones macro</li>
                      <li>Incluyen setup recomendado basado en el contexto</li>
                      <li>Se actualizan automáticamente tras eventos macro importantes</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-1">Watchlist (Confianza Media)</h4>
                    <p className="text-sm mb-2">
                      Pares con bias fuerte pero confianza Media. Estos escenarios sugieren scalping o riesgo controlado.
                    </p>
                    <ul className="list-disc pl-6 space-y-1 text-sm">
                      <li>Requieren confirmación técnica adicional</li>
                      <li>Pueden evolucionar a escenarios activos si la confianza aumenta</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">2.6 Estado del Sistema (Semáforo)</h3>
                <p className="mb-2">
                  El semáforo muestra el estado de salud de los componentes clave del dashboard.
                </p>
                <div className="bg-muted/50 dark:bg-muted/30 border rounded-lg p-4 space-y-3">
                  <div>
                    <h4 className="font-semibold mb-1">🟢 Verde (Confiable)</h4>
                    <p className="text-sm">El componente está funcionando correctamente y actualizado. Puedes confiar en los datos.</p>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-1">🟡 Amarillo (Retrasado)</h4>
                    <p className="text-sm">El componente tiene algún retraso pero sigue funcionando. Los datos pueden estar ligeramente desactualizados.</p>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-1">🔴 Rojo (No usar macro)</h4>
                    <p className="text-sm">El componente tiene problemas serios. No confíes en los datos macro hasta que se resuelva.</p>
                  </div>
                </div>
              </div>
            </div>
          </Accordion>
        </section>

        {/* 3) Página Calendario */}
        <section>
          <Accordion 
            title="📅 3. Página Calendario Económico"
            description="Eventos programados y releases publicados con horarios en hora de Madrid"
          >
            <div className="space-y-4 text-sm text-foreground">
              <div>
                <h3 className="font-semibold mb-2">3.1 Próximos Eventos</h3>
                <p className="mb-2">
                  Muestra los eventos económicos programados para los próximos 14 días, todos en <strong>hora de Madrid (Europe/Madrid)</strong>.
                </p>
                <div className="bg-muted/50 dark:bg-muted/30 border rounded-lg p-4 space-y-3">
                  <div>
                    <h4 className="font-semibold mb-1">Información de Cada Evento</h4>
                    <ul className="list-disc pl-6 space-y-1 text-sm">
                      <li><strong>Nombre del Evento:</strong> Indicador económico que se publicará (ej: NFP, CPI, Fed Rate Decision)</li>
                      <li><strong>Importancia:</strong> Alta/Media/Baja - qué tan importante es este evento para los mercados</li>
                      <li><strong>Moneda/País:</strong> Qué moneda o país afecta este evento (USD, EUR, GBP, JPY, AUD)</li>
                      <li><strong>Hora:</strong> Cuándo se publicará el dato (en hora de Madrid)</li>
                      <li><strong>Consenso:</strong> Valor esperado por los analistas</li>
                      <li><strong>Valor Anterior:</strong> Último valor publicado de este indicador</li>
                      <li><strong>Rango Consenso:</strong> Rango esperado por los analistas (mínimo-máximo)</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-1">Cómo Usarlo</h4>
                    <p className="text-sm">
                      Revisa los eventos de <strong>Alta importancia</strong> para saber cuándo esperar volatilidad. 
                      Compara el valor real (cuando se publique) con el consenso para identificar sorpresas.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">3.2 Releases Recientes</h3>
                <p className="mb-2">
                  Muestra los datos económicos que ya se han publicado con información detallada sobre sorpresas e impacto.
                </p>
                <div className="bg-muted/50 dark:bg-muted/30 border rounded-lg p-4 space-y-3">
                  <div>
                    <h4 className="font-semibold mb-1">Información Mostrada</h4>
                    <ul className="list-disc pl-6 space-y-1 text-sm">
                      <li><strong>Valor Real:</strong> El dato que realmente se publicó</li>
                      <li><strong>Consenso:</strong> Lo que esperaban los analistas</li>
                      <li><strong>Valor Anterior:</strong> El dato del mes/trimestre anterior</li>
                      <li><strong>Sorpresa:</strong> Diferencia entre el valor real y el consenso</li>
                      <li><strong>Dirección:</strong> Positiva (mejor de lo esperado) o Negativa (peor de lo esperado)</li>
                      <li><strong>Score de Sorpresa:</strong> Qué tan grande fue la sorpresa (normalizado)</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-1">Cómo Interpretarlo</h4>
                    <p className="text-sm">
                      Sorpresas positivas grandes normalmente fortalecen la moneda afectada. 
                      Sorpresas negativas grandes la debilitan. El dashboard recalcula automáticamente los scores macro tras cada release importante.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">3.3 Importancia de los Eventos</h3>
                <ul className="list-disc pl-6 space-y-2 text-sm">
                  <li><strong>Alta:</strong> Eventos que causan alta volatilidad (NFP, CPI, decisiones de bancos centrales)</li>
                  <li><strong>Media:</strong> Eventos importantes pero con menor impacto (PMI, ventas minoristas)</li>
                  <li><strong>Baja:</strong> Eventos con impacto limitado (datos secundarios) - estos eventos no se muestran en el dashboard</li>
                </ul>
              </div>
            </div>
          </Accordion>
        </section>

        {/* 4) Página Correlaciones */}
        <section>
          <Accordion 
            title="🔗 4. Página Correlaciones"
            description="Relación histórica entre activos y el dólar (DXY) en múltiples ventanas temporales"
          >
            <div className="space-y-4 text-sm text-foreground">
              <div>
                <h3 className="font-semibold mb-2">4.1 ¿Qué son las Correlaciones?</h3>
                <p className="mb-2">
                  Las correlaciones muestran cómo se relaciona históricamente cada activo con el dólar (DXY). 
                  Una correlación positiva significa que cuando el USD sube, el activo tiende a subir. 
                  Una correlación negativa significa que cuando el USD sube, el activo tiende a bajar.
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-2">4.2 Ventanas Temporales</h3>
                <div className="bg-muted/50 dark:bg-muted/30 border rounded-lg p-4 space-y-3">
                  <div>
                    <h4 className="font-semibold mb-1">3 Meses</h4>
                    <p className="text-sm">Correlación a corto plazo. Refleja la relación más reciente entre el activo y el USD.</p>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-1">6 Meses</h4>
                    <p className="text-sm">Correlación a medio plazo. Balance entre tendencia reciente y tendencia histórica.</p>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-1">12 Meses</h4>
                    <p className="text-sm">Correlación a largo plazo. Refleja la relación estructural entre el activo y el USD.</p>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-1">24 Meses</h4>
                    <p className="text-sm">Correlación a muy largo plazo. Muestra la relación histórica más amplia.</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">4.3 Cambios de Correlación (Shifts)</h3>
                <p className="mb-2">
                  Los cambios de correlación muestran si la relación entre el activo y el USD se está fortaleciendo, debilitando o rompiendo.
                </p>
                <div className="bg-muted/50 dark:bg-muted/30 border rounded-lg p-4 space-y-3">
                  <div>
                    <h4 className="font-semibold mb-1">Rompimiento (Break)</h4>
                    <p className="text-sm">La correlación histórica se ha roto. El activo se está desconectando del USD.</p>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-1">Reforzando (Reinforcing)</h4>
                    <p className="text-sm">La correlación se está fortaleciendo. La relación histórica se mantiene o se intensifica.</p>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-1">Estable (Stable)</h4>
                    <p className="text-sm">La correlación se mantiene sin cambios significativos.</p>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-1">Débil (Weak)</h4>
                    <p className="text-sm">La correlación es débil o inconsistente.</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">4.4 Cómo Usar las Correlaciones</h3>
                <p className="mb-2">
                  Las correlaciones te ayudan a entender cómo reaccionará un activo cuando el USD se mueva:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-sm">
                  <li>Si el USD es <strong>fuerte</strong> y la correlación es <strong>negativa y fuerte</strong> → sesgo bajista para el par</li>
                  <li>Si el USD es <strong>débil</strong> y la correlación es <strong>negativa y fuerte</strong> → sesgo alcista para el par</li>
                  <li>Si la correlación es <strong>débil o se ha roto</strong> → factores específicos del activo están dominando sobre el contexto USD</li>
                </ul>
              </div>
            </div>
          </Accordion>
        </section>

        {/* 5) Página Narrativas */}
        <section>
          <Accordion 
            title="📚 5. Página Narrativas Macro"
            description="Explicación del 'por qué' detrás de los movimientos macro para cada par"
          >
            <div className="space-y-4 text-sm text-foreground">
              <div>
                <h3 className="font-semibold mb-2">5.1 ¿Qué es una Narrativa Institucional?</h3>
                <p className="mb-2">
                  Una <strong>narrativa macro</strong> es una explicación del "por qué" detrás de los movimientos del mercado. 
                  Combina múltiples indicadores y eventos para crear una historia coherente del contexto macro actual para cada par de divisas.
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-2">5.2 Información Mostrada</h3>
                <div className="bg-muted/50 dark:bg-muted/30 border rounded-lg p-4 space-y-3">
                  <div>
                    <h4 className="font-semibold mb-1">Par</h4>
                    <p className="text-sm">El par de divisas analizado (ej: EURUSD, GBPUSD, XAUUSD).</p>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-1">Sesgo Táctico</h4>
                    <p className="text-sm">Dirección macro sugerida: Alcista, Bajista o Neutral.</p>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-1">Acción</h4>
                    <p className="text-sm">Recomendación de acción: Long, Short, o Rango/táctico.</p>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-1">Convicción</h4>
                    <p className="text-sm">Nivel de confianza en la señal: Alta, Media o Baja.</p>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-1">Motivo</h4>
                    <p className="text-sm">Explicación detallada del contexto macro que justifica el sesgo.</p>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-1">Correlación con DXY</h4>
                    <p className="text-sm">Correlación histórica a 12 meses y 3 meses con el dólar.</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">5.3 Buscador de Pares</h3>
                <p className="mb-2">
                  La página incluye un buscador en la parte superior que te permite encontrar rápidamente el par que deseas analizar.
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-2">5.4 Página Detallada por Par</h3>
                <p className="mb-2">
                  Al hacer clic en un par, puedes ver una página detallada con información adicional sobre ese par específico.
                </p>
              </div>
            </div>
          </Accordion>
        </section>

        {/* 6) Página Sesgos */}
        <section>
          <Accordion 
            title="🧩 6. Página Sesgos Tácticos"
            description="Sesgos macro por activo con niveles de confianza y flags de riesgo"
          >
            <div className="space-y-4 text-sm text-foreground">
              <div>
                <h3 className="font-semibold mb-2">6.1 ¿Qué es el Macro Bias?</h3>
                <p className="mb-2">
                  El <strong>macro bias</strong> (sesgo macro) es la dirección sugerida para un activo basada en el contexto macroeconómico actual. 
                  Combina el régimen global, los scores de las monedas y las correlaciones históricas.
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-2">6.2 Direcciones Posibles</h3>
                <div className="bg-muted/50 dark:bg-muted/30 border rounded-lg p-4 space-y-3">
                  <div>
                    <h4 className="font-semibold mb-1">Alcista (Long)</h4>
                    <p className="text-sm">El contexto macro sugiere que el activo podría subir.</p>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-1">Bajista (Short)</h4>
                    <p className="text-sm">El contexto macro sugiere que el activo podría bajar.</p>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-1">Neutral</h4>
                    <p className="text-sm">El contexto macro no sugiere una dirección clara (rango/táctico).</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">6.3 Niveles de Convicción</h3>
                <div className="bg-muted/50 dark:bg-muted/30 border rounded-lg p-4 space-y-3">
                  <div>
                    <h4 className="font-semibold mb-1">Alta</h4>
                    <p className="text-sm">Señales macro muy claras y consistentes. Puedes operar con tamaño normal.</p>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-1">Media</h4>
                    <p className="text-sm">Señales moderadas, algunas contradicciones menores. Considera scalping o riesgo controlado.</p>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-1">Baja</h4>
                    <p className="text-sm">Señales débiles o contradictorias. Prioriza análisis técnico y rango.</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">6.4 Flags de Riesgo</h3>
                <p className="mb-2">
                  Los flags de riesgo son alertas que indican situaciones que requieren atención especial.
                </p>
                <div className="bg-muted/50 dark:bg-muted/30 border rounded-lg p-4 space-y-3">
                  <div>
                    <h4 className="font-semibold mb-1">Correlation Break</h4>
                    <p className="text-sm">La correlación histórica entre el activo y el DXY se ha roto o invertido.</p>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-1">Liquidez Ajustada</h4>
                    <p className="text-sm">Las condiciones de liquidez del mercado están restringidas.</p>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-1">Sesgo Desactualizado</h4>
                    <p className="text-sm">El sesgo táctico no se ha actualizado recientemente tras eventos macro importantes.</p>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-1">Confianza Baja</h4>
                    <p className="text-sm">La confianza en la señal macro es baja debido a correlaciones débiles o señales contradictorias.</p>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mt-4">
                <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-200 mb-2">⚠️ Importante</p>
                <p className="text-sm text-yellow-800 dark:text-yellow-300">
                  Los sesgos tácticos <strong>NO son señales de trading</strong>. Son contexto macro que debes combinar 
                  con tu análisis técnico, gestión de riesgo y criterio personal. Tú decides tus trades.
                </p>
              </div>
            </div>
          </Accordion>
        </section>

        {/* 7) Análisis Diario */}
        <section>
          <Accordion 
            title="📋 7. Página Análisis Diario"
            description="Guía diaria de trading con checklist interactivo y resumen del contexto macro"
          >
            <div className="space-y-4 text-sm text-foreground">
              <div>
                <h3 className="font-semibold mb-2">7.1 ¿Qué es el Análisis Diario?</h3>
                <p className="mb-2">
                  La página <strong>Análisis Diario</strong> es una guía completa que te ayuda a revisar todos los aspectos importantes 
                  del contexto macro antes de tomar decisiones de trading. Incluye un checklist interactivo para asegurarte de que no 
                  olvidas ningún punto clave.
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-2">7.2 Información Dinámica en la Parte Superior</h3>
                <div className="bg-muted/50 dark:bg-muted/30 border rounded-lg p-4 space-y-3">
                  <div>
                    <h4 className="font-semibold mb-1">Estado de los Jobs</h4>
                    <p className="text-sm">
                      Muestra el estado de los procesos automáticos que actualizan los datos del dashboard. 
                      Verifica que todos estén en verde antes de confiar en los datos.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-1">Última Actualización de Sesgos</h4>
                    <p className="text-sm">
                      Indica cuándo se calcularon por última vez los sesgos tácticos. 
                      Asegúrate de que esté actualizado (normalmente tras cada release económico importante).
                    </p>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-1">Último Evento Macro Relevante</h4>
                    <p className="text-sm">
                      Muestra el evento económico más reciente y su impacto. 
                      Te ayuda a entender qué ha cambiado recientemente en el panorama macro.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">7.3 Las 8 Secciones del Análisis Diario</h3>
                <div className="bg-muted/50 dark:bg-muted/30 border rounded-lg p-4 space-y-4">
                  <div>
                    <h4 className="font-semibold mb-1">1. Régimen Global del Mercado</h4>
                    <p className="text-sm mb-2">
                      Clasificación del entorno macro actual (Risk ON/OFF, USD Direction, Macro Quad, Liquidez, Crédito).
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <strong>Dónde encontrarlo:</strong> Dashboard principal, sección "Régimen Global"
                    </p>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-1">2. Estado de las Monedas Principales</h4>
                    <p className="text-sm mb-2">
                      Scores macro y regímenes para USD, EUR, GBP, JPY y AUD. 
                      Te permite comparar la fortaleza relativa de cada moneda.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <strong>Dónde encontrarlo:</strong> Dashboard principal, sección "Regímenes Macro por Moneda"
                    </p>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-1">3. Sesgos Tácticos por Par</h4>
                    <p className="text-sm mb-2">
                      Dirección macro sugerida (Alcista/Bajista/Neutral) para cada par con niveles de confianza (Alta/Media/Baja).
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <strong>Dónde encontrarlo:</strong> Página "Sesgos" o Dashboard principal, sección "Escenarios Institucionales"
                    </p>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-1">4. Correlaciones con el Benchmark</h4>
                    <p className="text-sm mb-2">
                      Relación histórica entre cada activo y el dólar (DXY) en múltiples ventanas temporales (3m, 6m, 12m, 24m).
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <strong>Dónde encontrarlo:</strong> Página "Correlaciones"
                    </p>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-1">5. Agenda Macro del Día</h4>
                    <p className="text-sm mb-2">
                      Eventos económicos programados para hoy con horarios, consensos y posibles escenarios (mejor/peor/estable).
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <strong>Dónde encontrarlo:</strong> Página "Calendario", sección "Próximos Eventos"
                    </p>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-1">6. Flags de Riesgo</h4>
                    <p className="text-sm mb-2">
                      Alertas que requieren atención especial: correlaciones rotas, liquidez ajustada, sesgos desactualizados, etc.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <strong>Dónde encontrarlo:</strong> Página "Sesgos", sección de flags de riesgo por par
                    </p>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-1">7. Confirmación Técnica</h4>
                    <p className="text-sm mb-2">
                      Recordatorio para combinar el contexto macro con tu análisis técnico (soportes, resistencias, tendencias, etc.).
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <strong>Nota:</strong> El dashboard no proporciona análisis técnico, solo contexto macro. 
                      Debes usar tus propias herramientas de análisis técnico.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-1">8. Checklist Final Antes de Operar</h4>
                    <p className="text-sm mb-2">
                      Lista interactiva de verificación para asegurarte de que has revisado todos los puntos importantes 
                      antes de abrir una posición.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <strong>Características:</strong> Puedes marcar cada punto del checklist. 
                      Tu progreso se guarda en tu navegador.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">7.4 Selector de Estilo de Trading (Opcional)</h3>
                <p className="mb-2">
                  La página incluye un selector opcional para filtrar el foco de la información según tu estilo de trading:
                </p>
                <div className="bg-muted/50 dark:bg-muted/30 border rounded-lg p-4 space-y-3">
                  <div>
                    <h4 className="font-semibold mb-1">Swing Trading</h4>
                    <p className="text-sm">Enfocado en tendencias macro de mediano plazo, regímenes y sesgos tácticos.</p>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-1">Intraday</h4>
                    <p className="text-sm">Balance entre contexto macro y eventos del día, correlaciones y confirmación técnica.</p>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-1">Scalping</h4>
                    <p className="text-sm">Enfocado en eventos del día, confirmación técnica y flags de riesgo inmediatos.</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">7.5 Descarga en PDF</h3>
                <p className="mb-2">
                  La página incluye un botón para descargar la guía completa en PDF, permitiéndote consultarla offline 
                  o imprimirla para referencia.
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-2">7.6 Cómo Usar el Análisis Diario</h3>
                <ol className="list-decimal pl-6 space-y-2 text-sm">
                  <li>
                    <strong>Revisa la información dinámica:</strong> Verifica que los jobs estén actualizados y 
                    revisa el último evento macro relevante.
                  </li>
                  <li>
                    <strong>Recorre las 8 secciones:</strong> Lee cada sección y consulta las páginas correspondientes 
                    del dashboard para obtener información detallada.
                  </li>
                  <li>
                    <strong>Marca el checklist:</strong> A medida que revises cada punto, márcalo en el checklist interactivo.
                  </li>
                  <li>
                    <strong>Combina con análisis técnico:</strong> El contexto macro es solo una parte. 
                    Combínalo con tu análisis técnico antes de operar.
                  </li>
                  <li>
                    <strong>Toma tu decisión:</strong> Con toda la información revisada, toma tu decisión de trading 
                    basándote en tu criterio y gestión de riesgo.
                  </li>
                </ol>
              </div>

              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mt-4">
                <p className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-2">💡 Consejo</p>
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  Usa el Análisis Diario como tu rutina matutina antes de empezar a operar. 
                  Te asegura que no olvidas ningún aspecto importante del contexto macro y te ayuda a tomar decisiones más informadas.
                </p>
              </div>
            </div>
          </Accordion>
        </section>

        {/* 8) Notificaciones */}
        <section>
          <Accordion 
            title="🔔 8. Sistema de Notificaciones"
            description="Alertas automáticas en Telegram para eventos importantes y cambios macro"
          >
            <div className="space-y-4 text-sm text-foreground">
              <div>
                <h3 className="font-semibold mb-2">7.1 Tipos de Notificaciones</h3>
                <div className="bg-muted/50 dark:bg-muted/30 border rounded-lg p-4 space-y-3">
                  <div>
                    <h4 className="font-semibold mb-1">Nuevos Eventos de Calendario</h4>
                    <p className="text-sm">Recibir notificaciones cuando se detecten nuevos eventos económicos importantes (NFP, CPI, decisiones de bancos centrales, etc.).</p>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-1">Resumen Semanal de Calendario</h4>
                    <p className="text-sm">Recibir un resumen semanal cada domingo con todos los eventos importantes de la próxima semana, todos en hora de Madrid.</p>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-1">Calendario del Día con Escenarios</h4>
                    <p className="text-sm">Cada día recibes los eventos programados para ese día con escenarios what-if (mejor/peor/estable) y su posible impacto en los pares.</p>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-1">Cambios de Confianza en Pares</h4>
                    <p className="text-sm">Recibir notificaciones cuando cambie el nivel de confianza (Alta/Media/Baja) de cualquier par.</p>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-1">Cambios de Datos Macro</h4>
                    <p className="text-sm">Recibir notificaciones cuando se actualicen indicadores económicos importantes (con valor anterior vs actual).</p>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-1">Cambios de Escenarios</h4>
                    <p className="text-sm">Recibir notificaciones cuando aparezcan nuevos escenarios activos o cambien los existentes.</p>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-1">Release Publicado</h4>
                    <p className="text-sm">Cuando se publica un dato económico importante, recibes el valor real, consenso, sorpresa, impacto esperado y pares afectados.</p>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-1">Resumen Semanal Macro</h4>
                    <p className="text-sm">Cada domingo recibes un resumen completo de la situación macroeconómica: régimen global, scores por moneda, escenarios activos, eventos recientes, etc.</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">7.2 Configuración</h3>
                <p className="mb-2">
                  Puedes configurar qué notificaciones recibir en la página <strong>Notificaciones</strong>. 
                  Todas las notificaciones se envían automáticamente a tu Telegram configurado.
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-2">7.3 Horarios</h3>
                <p className="mb-2">
                  Todos los horarios en las notificaciones se muestran en <strong>hora de Madrid (Europe/Madrid)</strong> para tu conveniencia.
                </p>
              </div>
            </div>
          </Accordion>
        </section>

        {/* 9) Tema Oscuro/Claro */}
        <section>
          <Accordion 
            title="🌓 9. Tema Oscuro y Claro"
            description="Selector de tema en la parte superior derecha del dashboard"
          >
            <div className="space-y-4 text-sm text-foreground">
              <div>
                <h3 className="font-semibold mb-2">8.1 Cómo Cambiar el Tema</h3>
                <p className="mb-2">
                  En la parte superior derecha del dashboard, junto a los enlaces de FRED y GitHub, encontrarás un <strong>toggle de tema</strong>.
                </p>
                <ul className="list-disc pl-6 space-y-2 text-sm">
                  <li>Haz clic en el toggle para cambiar entre tema claro y oscuro</li>
                  <li>Tu preferencia se guarda automáticamente en tu navegador</li>
                  <li>La próxima vez que visites el dashboard, se aplicará tu tema preferido</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">8.2 Características del Tema</h3>
                <div className="bg-muted/50 dark:bg-muted/30 border rounded-lg p-4 space-y-3">
                  <div>
                    <h4 className="font-semibold mb-1">Tema Claro</h4>
                    <p className="text-sm">Fondo blanco, texto negro. Ideal para uso durante el día.</p>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-1">Tema Oscuro</h4>
                    <p className="text-sm">Fondo oscuro, texto claro. Ideal para uso durante la noche o para reducir fatiga visual.</p>
                  </div>
                </div>
              </div>
            </div>
          </Accordion>
        </section>

        {/* 10) Limitaciones */}
        <section>
          <Accordion 
            title="🛡️ 10. Limitaciones (por Diseño)"
            description="Qué NO hace el dashboard intencionalmente"
          >
            <div className="space-y-4 text-sm text-foreground">
              <p className="mb-2">
                El Macro Dashboard está diseñado intencionalmente con estas limitaciones para mantenerte en control:
              </p>

              <div className="bg-muted/50 dark:bg-muted/30 border rounded-lg p-4 space-y-3">
                <div>
                  <h4 className="font-semibold mb-1">❌ Sin Recomendaciones Automáticas</h4>
                  <p className="text-sm">
                    El dashboard no te dice "compra aquí" o "vende aquí". Proporciona contexto, tú decides.
                  </p>
                </div>

                <div>
                  <h4 className="font-semibold mb-1">❌ Sin Stop Loss / Take Profit</h4>
                  <p className="text-sm">
                    No proporciona niveles automáticos de SL/TP. Debes definir tu gestión de riesgo.
                  </p>
                </div>

                <div>
                  <h4 className="font-semibold mb-1">❌ Sin Ejecución</h4>
                  <p className="text-sm">
                    El dashboard no ejecuta trades por ti. Es una herramienta de análisis, no un robot de trading.
                  </p>
                </div>

                <div>
                  <h4 className="font-semibold mb-1">✅ Tú Decides tus Trades</h4>
                  <p className="text-sm">
                    El objetivo es empoderarte con información, no reemplazar tu criterio. 
                    Combina el contexto macro con tu análisis técnico, gestión de riesgo y experiencia.
                  </p>
                </div>
              </div>
            </div>
          </Accordion>
        </section>

        {/* 11) Resumen */}
        <section>
          <Accordion 
            title="🎯 11. Resumen de Beneficios"
            description="Por qué usar el Macro Dashboard"
          >
            <div className="space-y-4 text-sm text-foreground">
              <ul className="list-disc pl-6 space-y-3">
                <li>
                  <strong>Dirección macro clara sin automatizar trading:</strong> Obtienes contexto macro claro y actualizado, 
                  pero mantienes el control total sobre tus decisiones de trading.
                </li>
                <li>
                  <strong>Actualización tras cada release económico:</strong> El dashboard se actualiza automáticamente cuando 
                  se publican datos económicos importantes, sin necesidad de monitorear múltiples fuentes.
                </li>
                <li>
                  <strong>Información consolidada en un solo lugar:</strong> Todo el contexto macro relevante está disponible 
                  en una sola vista, ahorrándote tiempo de investigación.
                </li>
                <li>
                  <strong>Narrativa institucional:</strong> Entiendes el "por qué" detrás de los movimientos, no solo el "qué".
                </li>
                <li>
                  <strong>Sesgos tácticos informados:</strong> Obtienes sugerencias de dirección basadas en análisis macro profundo, 
                  que puedes combinar con tu análisis técnico.
                </li>
                <li>
                  <strong>Alertas de riesgo:</strong> El sistema te avisa cuando hay situaciones que requieren atención especial.
                </li>
                <li>
                  <strong>Notificaciones automáticas:</strong> Recibes alertas en Telegram para eventos importantes sin tener que estar monitoreando constantemente.
                </li>
                <li>
                  <strong>Horarios en hora local:</strong> Todos los eventos se muestran en hora de Madrid para tu conveniencia.
                </li>
                <li>
                  <strong>Tema personalizable:</strong> Puedes elegir entre tema claro u oscuro según tu preferencia.
                </li>
              </ul>
            </div>
          </Accordion>
        </section>
      </div>
    </main>
  )
}
