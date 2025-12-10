# 📊 Guía de Uso en Flujo de Trading Diario

## 🎯 Objetivo

Esta guía explica cómo usar el dashboard macro en tu rutina diaria de trading, **sin señales automáticas ni SL/TP**, solo información institucional para tomar decisiones manuales.

---

## 🌅 1. Antes de la Sesión (Mañana)

### Paso 1: Abrir Dashboard

Navega a `/dashboard` y revisa:

**A. Régimen Global**
- **Régimen:** Reflación, Estanflación, Recesión, Goldilocks, Mixto
- **USD:** Fuerte / Débil / Neutral
- **Cuadrante:** Risk-On/Risk-Off, Liquidity, Credit

**B. Tabla de Indicadores Principales**
- **Inflación:** CPI, Core CPI, PCE (USD, EUR, GBP, JPY)
- **Crecimiento:** GDP, Retail Sales, PMI
- **Empleo:** NFP, Unemployment Rate, Initial Claims
- **Monetaria:** Fed Funds, ECB Rate, BoE Rate, BoJ Rate

**C. RecentMacroEvents**
- Últimos releases importantes (de ayer/hoy) por moneda
- Sorprenden al alza o a la baja
- Cómo han movido los scores de USD, EUR, GBP, JPY

### Paso 2: Lectura Institucional

**Preguntas clave:**
1. ¿Qué narrativa domina hoy?
   - Si USD está fuerte + inflación alta → Sesgo hawkish
   - Si USD débil + crecimiento bajo → Sesgo dovish
   - Si régimen es Goldilocks → Sesgo neutral/risk-on

2. ¿Qué monedas están en reflación vs recesión?
   - Reflación → Moneda fuerte (expectativa de subida de tipos)
   - Recesión → Moneda débil (expectativa de bajada de tipos)

3. ¿Hay eventos recientes que hayan cambiado el sesgo?
   - Mira `RecentMacroEvents` para sorpresas importantes
   - Verifica si `updated_after_last_event` es `true` en los pares afectados

**Ejemplo de lectura:**
```
Régimen: Reflación
USD: Fuerte
Último evento: US CPI YoY sorpresa POSITIVA (+0.6 surprise_score)
USD score: 0.15 → 0.27
Régimen USD: Mixed → Reflation

👉 Narrativa: Inflación persistente → Fed más hawkish → USD fuerte
👉 Sesgo: Buscar oportunidades de compra en USD (EURUSD short, GBPUSD short)
```

---

## 📅 2. Pre-Noticia Importante (ej: NFP, CPI, Tipos)

### Paso 1: Localizar Evento en Calendario

**Si tienes página de calendario:**
- Busca el evento por nombre (ej: "Nonfarm Payrolls", "CPI YoY")
- Verifica:
  - **Hora exacta** (UTC y local)
  - **Consenso** (expectativa del mercado)
  - **Importancia** (high/medium)
  - **Moneda afectada** (USD, EUR, GBP, JPY)

**Si no tienes página de calendario:**
- Consulta directamente en la BD:
```sql
SELECT 
  name,
  currency,
  scheduled_time_utc,
  consensus_value,
  importance
FROM economic_events
WHERE scheduled_time_utc >= datetime('now')
  AND scheduled_time_utc <= datetime('now', '+1 day')
  AND importance IN ('high', 'medium')
ORDER BY scheduled_time_utc ASC;
```

### Paso 2: Decisión Manual

**Opciones:**
1. **Quedarte fuera del mercado** durante la ventana de la noticia
   - Evitas volatilidad extrema
   - Esperas a que el mercado digiera el dato

2. **Tradear la reacción** (solo si tienes experiencia)
   - Si sorpresa positiva para USD → Buscar compras en USD
   - Si sorpresa negativa para USD → Buscar ventas en USD
   - **Riesgo:** Movimientos rápidos y volátiles

3. **Usar solo para contexto posterior**
   - No operas durante la noticia
   - Usas el dato para ajustar tu sesgo macro después

---

## ⚡ 3. Justo Después del Release

### Paso 1: Verificar que el Sistema Capturó el Dato

**En Dashboard:**
1. Refresca la página (`Cmd+R` / `Ctrl+R`)
2. Mira `RecentMacroEvents`:
   - Debe aparecer el evento recién publicado
   - Verifica `surprise_direction` y `surprise_score`
   - Revisa el impacto en `score_before` → `score_after`

**Ejemplo:**
```
US CPI YoY
Actual: 3.3% | Consenso: 3.1%
Sorpresa: POSITIVA para USD (surprise_score: 0.645)
Impacto USD: 0.15 → 0.27
Régimen USD: Mixed → Reflation
Hace: 2 minutos
```

### Paso 2: Verificar Sesgos Tácticos

**En `/sesgos` o tabla táctica del dashboard:**
- Busca pares con la moneda afectada
- Verifica que muestran `last_relevant_event` con el evento reciente
- Confirma que `updated_after_last_event` es `true`

**Ejemplo:**
```
EURUSD
Trend: Empeora
Action: Short
Confidence: Alta
Last relevant event: US CPI YoY (POSITIVE, score 0.645)
Updated after last event: ✅
```

### Paso 3: Decisión de Trading

**Tú decides manualmente:**

**Opción A: Alinearte con el nuevo sesgo macro**
- Si CPI sorpresa positiva → USD fuerte → Vender EURUSD
- Si CPI sorpresa negativa → USD débil → Comprar EURUSD
- **Consideración:** El movimiento puede estar ya priceado

**Opción B: Esperar confirmación técnica**
- No operas inmediatamente
- Esperas a que el precio confirme el sesgo macro
- Buscas entradas en pullbacks o breakouts técnicos

**Opción C: Considerar que está demasiado priceado**
- El mercado ya movió antes del dato
- Esperas a que se estabilice
- Buscas oportunidades contrarias si hay sobre-reacción

---

## 📊 4. Ejemplo de Rutina Completa

### Lunes 9:00 AM (Pre-Mercado)

1. **Abrir Dashboard**
   - Régimen: Reflación
   - USD: Fuerte
   - Último evento: NFP del viernes pasado, sorpresa positiva

2. **Lectura:**
   - Narrativa: USD hawkish por empleo fuerte
   - Sesgo: Buscar ventas en EURUSD, GBPUSD
   - Evitar: Compras en USD (ya está fuerte)

3. **Plan:**
   - Esperar pullback técnico en EURUSD para entrar short
   - No operar durante CPI de mañana (martes 13:30 UTC)

### Martes 13:25 UTC (5 minutos antes de CPI)

1. **Preparación:**
   - Cerrar posiciones abiertas (si las hay)
   - Esperar fuera del mercado

2. **Durante el release (13:30 UTC):**
   - No operar
   - Observar reacción del mercado

### Martes 13:35 UTC (5 minutos después de CPI)

1. **Verificar Dashboard:**
   - CPI salió: 3.3% vs 3.1% consenso
   - Sorpresa: POSITIVA para USD
   - USD score: 0.15 → 0.27
   - Régimen: Mixed → Reflation

2. **Decisión:**
   - El mercado ya movió (EURUSD bajó 50 pips)
   - Esperar pullback técnico
   - Si EURUSD rebota a 1.0850, entrar short con sesgo macro

3. **Ejecución:**
   - Entrar short EURUSD en pullback técnico
   - Stop Loss: Por encima del máximo de la reacción
   - Take Profit: Manual (según estructura técnica)

---

## 🎯 5. Checklist Diario

### Mañana (Pre-Mercado)
- [ ] Abrir dashboard y leer régimen global
- [ ] Revisar tabla de indicadores principales
- [ ] Leer `RecentMacroEvents` de ayer/hoy
- [ ] Identificar narrativa dominante
- [ ] Planificar sesgo para el día

### Durante el Día
- [ ] Verificar `JobStatusIndicator` (semáforo verde)
- [ ] Revisar calendario para eventos importantes del día
- [ ] Decidir si operar o quedarse fuera durante releases

### Después de Release Importante
- [ ] Refrescar dashboard
- [ ] Verificar que el evento aparece en `RecentMacroEvents`
- [ ] Revisar impacto en scores y regímenes
- [ ] Verificar sesgos tácticos en pares afectados
- [ ] Tomar decisión manual de trading

---

## ⚠️ 6. Señales de Alerta

### Semáforo Amarillo (Warning)
- Último job de calendario hace más de 24h
- Último job de releases hace más de 3 min
- Bias desactualizado respecto a último release

**Acción:** Verificar logs y estado del sistema

### Semáforo Rojo (Error)
- Error en última ejecución de calendario
- Error en última ejecución de releases
- Bias no se actualiza tras releases

**Acción:** No confiar en datos hasta resolver el problema

### Datos Desactualizados
- `bias_updated_at` mucho más antiguo que `last_event_applied_at`
- Eventos recientes no aparecen en `RecentMacroEvents`

**Acción:** Verificar que los cron jobs están funcionando

---

## 💡 7. Tips Prácticos

1. **No operes solo por el dashboard**
   - El dashboard informa dirección macro
   - Tú decides timing y tamaño de posición
   - Combina con análisis técnico

2. **Confía en sorpresas grandes**
   - `surprise_score > 0.5` → Movimientos significativos
   - `surprise_score < 0.3` → Movimientos menores

3. **Monitorea cambios de régimen**
   - Si USD pasa de Mixed a Reflation → Sesgo fuerte alcista USD
   - Si USD pasa de Reflation a Recession → Sesgo fuerte bajista USD

4. **Usa el contexto, no las señales**
   - El dashboard no dice "compra aquí"
   - Dice "USD está fuerte, busca oportunidades de venta en EURUSD"
   - Tú decides dónde y cuándo entrar

---

## 📚 Recursos Adicionales

- `docs/CHECKLIST-PRUEBAS-E2E.md` - Validar que todo funciona
- `docs/CONFIGURACION-PROVEEDORES-CALENDARIO.md` - Configurar proveedores
- `docs/CALENDARIO-Y-SORPRESAS-MACRO.md` - Documentación técnica

---

**Recuerda:** El dashboard es tu herramienta de información institucional. Tú sigues siendo el trader que toma todas las decisiones. 🎯

