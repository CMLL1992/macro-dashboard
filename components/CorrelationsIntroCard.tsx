import { Accordion } from '@/components/ui/accordion'

export function CorrelationsIntroCard() {
  return (
    <Accordion 
      title="🔗 ¿Qué muestra esta página?"
      description="Relación histórica entre activos y el dólar (DXY) en distintas ventanas temporales"
      defaultOpen={false}
    >
      <div className="space-y-4 text-sm text-foreground">
        <div>
          <h3 className="font-semibold mb-2">¿Qué son las Correlaciones?</h3>
          <p className="mb-2">
            Las correlaciones muestran cómo se relaciona históricamente cada activo con el dólar (DXY). 
            Una correlación <strong>positiva</strong> significa que cuando el USD sube, el activo tiende a subir. 
            Una correlación <strong>negativa</strong> significa que cuando el USD sube, el activo tiende a bajar.
          </p>
        </div>

        <div>
          <h3 className="font-semibold mb-2">Ventanas Temporales</h3>
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
          <h3 className="font-semibold mb-2">Parámetros de la Tabla</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>Ventana corr.</strong>: horizonte principal de cálculo (3m, 6m, 12m, 24m).
            </li>
            <li>
              <strong>Ventana más fuerte</strong>: ventana donde la correlación es más intensa.
            </li>
            <li>
              <strong>Tendencia / Shifts</strong>: Stable (Estable), Reinforcing (Reforzando), Weakening (Debilitando), Break (Rompimiento).
            </li>
            <li>
              <strong>Intensidad</strong>: Fuerte / Moderada / Débil según el nivel de correlación.
            </li>
            <li>
              <strong>Relevancia macro</strong>: barra 0–100% que indica lo útil que es esa relación
              para entender el comportamiento del par frente al DXY.
            </li>
          </ul>
        </div>

        <div>
          <h3 className="font-semibold mb-2">Cómo Usar las Correlaciones</h3>
          <p className="mb-2">
            Las correlaciones te ayudan a entender cómo reaccionará un activo cuando el USD se mueva:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Si el USD es <strong>fuerte</strong> y la correlación es <strong>negativa y fuerte</strong> → sesgo bajista para el par</li>
            <li>Si el USD es <strong>débil</strong> y la correlación es <strong>negativa y fuerte</strong> → sesgo alcista para el par</li>
            <li>Si la correlación es <strong>débil o se ha roto</strong> → factores específicos del activo están dominando sobre el contexto USD</li>
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            Úsalo para <strong>validar sesgos</strong> (correlaciones fuertes a favor son confirmación)
            y para detectar <strong>cambios de régimen</strong> cuando la correlación cambia de signo
            entre ventanas (ej. 3m vs 12m).
          </p>
        </div>

        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mt-4">
          <p className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-2">💡 Para más información</p>
          <p className="text-sm text-blue-800 dark:text-blue-300">
            Para una explicación completa, revisa la sección{" "}
            <em>Ayuda → 4. Página Correlaciones</em>.
          </p>
        </div>
      </div>
    </Accordion>
  )
}




