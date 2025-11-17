# RESUMEN COMPLETO DEL PROYECTO - MACRO DASHBOARD

## 📋 INFORMACIÓN GENERAL

**Proyecto:** Dashboard Macroeconómico CM11 Trading  
**Framework:** Next.js 14 (App Router)  
**Base de Datos:** SQLite (better-sqlite3)  
**Deployment:** Vercel  
**Node.js:** 20.x  
**Package Manager:** pnpm 10.20.0

---

## 🏗️ ARQUITECTURA DEL PROYECTO

### Estructura de Directorios Principal

```
macro-dashboard-clean/
├── app/                    # Next.js App Router
│   ├── dashboard/         # Página principal del dashboard
│   ├── correlations/       # Página de correlaciones
│   ├── narrativas/         # Página de narrativas macro
│   ├── sesgos/            # Página de sesgos de trading
│   ├── api/               # API endpoints
│   │   ├── bias/          # Endpoint legacy (funciona)
│   │   ├── debug/         # Endpoints de debug (nuevos)
│   │   └── jobs/          # Jobs de ingest y cálculo
│   └── ...
├── domain/                # Lógica de negocio
│   ├── macro-engine/     # Motor macro centralizado
│   │   ├── bias.ts       # Estado de bias macro
│   │   ├── correlations.ts # Estado de correlaciones
│   │   └── trading-bias.ts # Sesgos de trading
│   ├── diagnostic.ts     # Diagnóstico macro (getMacroDiagnosis)
│   └── ...
├── lib/                  # Utilidades y helpers
│   ├── db/               # Acceso a base de datos
│   │   ├── schema.ts     # Esquema SQLite
│   │   ├── read.ts       # Lectura de datos
│   │   ├── read-macro.ts # Lectura de datos macro
│   │   └── upsert.ts     # Escritura de datos
│   └── ...
└── components/           # Componentes React
```

---

## 🔄 FLUJO DE DATOS COMPLETO

### 1. INGESTA DE DATOS (Jobs)

```
FRED API / Otras fuentes
    ↓
/api/jobs/ingest/fred
    ↓
lib/db/upsert.ts → upsertMacroObservation()
    ↓
SQLite: macro_observations
```

**Tablas SQLite relevantes:**
- `macro_observations`: Datos brutos de series macro (date, value, series_id)
- `indicator_history`: Valores actuales y anteriores por indicador (value_current, value_previous, date_current, date_previous)
- `macro_bias`: Sesgos calculados por activo
- `correlations`: Correlaciones calculadas

---

### 2. PROCESAMIENTO DE DATOS

#### A. Lectura desde SQLite

```
getAllLatestFromDB() [lib/db/read-macro.ts]
    ↓
Lee macro_observations
    ↓
Aplica transformaciones (YoY, QoQ, Delta, SMA)
    ↓
Retorna LatestPoint[] con value, date, label
```

**Problema conocido:** Si las transformaciones fallan, `getAllLatestFromDB()` devuelve `value: null`

---

#### B. Diagnóstico Macro

```
getMacroDiagnosis() [domain/diagnostic.ts]
    ↓
1. getAllLatestFromDB() → data: LatestPoint[]
2. Si USE_LIVE_SOURCES=true y hay nulls → fallback a FRED
3. Actualiza indicator_history con valores actuales
4. getAllIndicatorHistories() → updatedHistories
5. Mapea data a items con fallback a indicator_history:
   - value = d.value ?? history?.value_current ?? null
   - date = d.date ?? history?.date_current ?? null
    ↓
Retorna: { items, regime, score, ... }
```

**Mapeo de keys:**
- `cpi_yoy` → `CPIAUCSL` (weightKey)
- `gdp_yoy` → `GDPC1` (weightKey)
- etc.

---

#### C. Motor Macro (Nuevo)

```
getBiasState() [domain/macro-engine/bias.ts]
    ↓
1. getBiasRaw()
   - getMacroDiagnosisWithDelta() → diagnosis
   - diagnosis.items → latestPoints
   - Mapea latestPoints a BiasRow[] (table)
    ↓
2. Calcula USD, Quad, Liquidity, Credit, Risk
    ↓
3. Retorna BiasState:
   {
     updatedAt: Date,
     regime: { overall, usd_direction, quad, ... },
     metrics: { usdScore, quadScore, ... },
     table: BiasRow[],        // ← ESTO SE USA EN EL DASHBOARD
     tableTactical: TacticalBiasRow[]
   }
```

---

### 3. RENDERING EN EL DASHBOARD

```
app/dashboard/page.tsx (Server Component)
    ↓
getBiasState() → biasState
    ↓
buildIndicatorRows(biasState.table)
    ↓
Mapea BiasRow[] a IndicatorRow[]
    ↓
Renderiza tabla HTML con valores
```

**Problema actual:** La tabla muestra "—" para todos los valores numéricos y fechas.

---

## 🔍 PROBLEMA ACTUAL: TABLA VACÍA

### Síntoma
- La tabla "Indicadores macro" muestra "—" en todas las columnas (value, value_previous, date, date_previous)
- Postura, peso y tendencia SÍ se muestran (vienen de cálculos, no de datos)

### Endpoints que funcionan vs. que no funcionan

✅ **FUNCIONA:** `/api/bias`
- Usa `getMacroDiagnosis()` directamente
- Devuelve `items` con valores correctos
- Verificado en producción: devuelve datos con `value`, `value_previous`, `date`, `date_previous`

❌ **NO FUNCIONA:** Dashboard (`/dashboard`)
- Usa `getBiasState()` → `getBiasRaw()` → `getMacroDiagnosisWithDelta()` → `getMacroDiagnosis()`
- `biasState.table` llega con `value: null` para todos los items

---

## 🔧 FIXES APLICADOS (Commits)

### Commit `a91d2de`
**Fix:** Agregado fallback a `indicator_history` cuando `getAllLatestFromDB()` devuelve `null`

```typescript
// domain/diagnostic.ts
const value = d.value ?? history?.value_current ?? null
const date = d.date ?? history?.date_current ?? null
```

### Commit `870e4ee`
**Fix:** Verificación más explícita de `null`/`undefined`

```typescript
const value = (d.value != null) ? d.value : (history?.value_current ?? null)
```

### Commit `f5168f2`
**Fix:** Fallback adicional que intenta buscar por `originalKey` si `weightKey` no encuentra datos

```typescript
if (value == null && d.key !== weightKey) {
  const historyByOriginalKey = updatedHistories.get(d.key.toUpperCase())
  if (historyByOriginalKey?.value_current != null) {
    value = historyByOriginalKey.value_current
    // ...
  }
}
```

### Commit `44e8afe`
**Fix:** Endpoints de debug para trazar el problema

- `/api/debug/indicator-history` - Verifica datos en `indicator_history`
- `/api/debug/macro-diagnosis` - Prueba `getMacroDiagnosis()` directamente
- `/api/debug/bias-chain` - Traza cadena completa

---

## 🎯 POSIBLES CAUSAS DEL BUG

### 1. `indicator_history` está vacío o incompleto
- Si `getAllLatestFromDB()` siempre devuelve `null`, `indicator_history` nunca se actualiza
- El fallback no puede funcionar si no hay datos previos

**Verificación necesaria:**
```bash
curl https://macro-dashboard-seven.vercel.app/api/debug/indicator-history
```

### 2. Mapeo de keys incorrecto
- `getAllLatestFromDB()` devuelve keys como `cpi_yoy`
- `indicator_history` almacena con `weightKey` como `CPIAUCSL`
- El fallback busca por `weightKey`, pero puede que los datos estén con otro formato

**Verificación necesaria:**
- Ver qué keys tiene `indicator_history`
- Ver qué keys devuelve `getAllLatestFromDB()`

### 3. `getMacroDiagnosisWithDelta()` no preserva valores
- `getMacroDiagnosisWithDelta()` simplemente llama a `getMacroDiagnosis()` y retorna
- Pero `getBiasRaw()` mapea `diagnosis.items` a `BiasRow[]`
- Puede que el mapeo esté perdiendo valores

**Verificación necesaria:**
```bash
curl https://macro-dashboard-seven.vercel.app/api/debug/bias-chain
```

### 4. El dashboard espera propiedades diferentes
- `buildIndicatorRows()` espera `row.value` y `row.value_previous`
- Pero `biasState.table` puede tener `value_current` y `value_previous`
- O puede que el mapeo en `getBiasRaw()` no esté preservando correctamente

**Código actual:**
```typescript
// app/dashboard/page.tsx
const buildIndicatorRows = (table: any[]): IndicatorRow[] =>
  table.map((row) => ({
    value: row.value ?? null,           // ← Busca 'value'
    previous: row.value_previous ?? null, // ← Busca 'value_previous'
    date: row.date ?? null,              // ← Busca 'date'
    // ...
  }))
```

**Código en getBiasRaw():**
```typescript
// domain/macro-engine/bias.ts
return {
  value: item.value ?? null,              // ← Usa 'value'
  value_previous: item.value_previous ?? null, // ← Usa 'value_previous'
  date: dateValue,                        // ← Usa 'date'
  // ...
}
```

El mapeo parece correcto, pero necesitamos verificar qué llega realmente.

---

## 📊 ENDPOINTS DE DEBUG DISPONIBLES

### 1. `/api/debug/indicator-history`
**Propósito:** Verificar datos en `indicator_history`

**Uso:**
```bash
# Ver todos los indicadores
curl https://macro-dashboard-seven.vercel.app/api/debug/indicator-history

# Ver un indicador específico
curl https://macro-dashboard-seven.vercel.app/api/debug/indicator-history?key=CPIAUCSL
```

**Respuesta esperada:**
```json
{
  "total_rows": 15,
  "samples": ["CPIAUCSL", "GDPC1", ...],
  "sample_data": [
    {
      "key": "CPIAUCSL",
      "found": true,
      "value_current": 3.02,
      "value_previous": 3.03,
      "date_current": "2025-09-01",
      "date_previous": "2025-08-01"
    }
  ]
}
```

### 2. `/api/debug/macro-diagnosis`
**Propósito:** Ver qué devuelve `getMacroDiagnosis()` directamente

**Uso:**
```bash
curl https://macro-dashboard-seven.vercel.app/api/debug/macro-diagnosis
```

**Respuesta esperada:**
```json
{
  "regime": "Neutral",
  "score": -0.29,
  "total_items": 15,
  "items_with_value": 15,
  "items_with_null_value": 0,
  "sample_indicators": [
    {
      "key": "CPIAUCSL",
      "label": "Inflación CPI (YoY)",
      "value": 3.02,
      "value_previous": 3.03,
      "date": "2025-09-01",
      "date_previous": "2025-08-01"
    }
  ]
}
```

### 3. `/api/debug/bias-chain`
**Propósito:** Trazar toda la cadena desde `getMacroDiagnosis()` hasta `getBiasState()`

**Uso:**
```bash
curl https://macro-dashboard-seven.vercel.app/api/debug/bias-chain
```

**Respuesta esperada:**
```json
{
  "chain": {
    "step1_getMacroDiagnosis": {
      "total_items": 15,
      "sample_cpi": {
        "key": "CPIAUCSL",
        "value": 3.02,
        "value_previous": 3.03
      }
    },
    "step2_getMacroDiagnosisWithDelta": { ... },
    "step3_getBiasRaw": { ... },
    "step4_getBiasState": { ... }
  },
  "summary": {
    "items_with_value_at_step1": 15,
    "items_with_value_at_step4": 15,
    "value_lost_between_steps": 0
  }
}
```

---

## 🔬 PRÓXIMOS PASOS PARA DEBUG

### Paso 1: Verificar `indicator_history`
```bash
curl https://macro-dashboard-seven.vercel.app/api/debug/indicator-history
```
**Si está vacío:** Necesitamos poblar `indicator_history` ejecutando el job de ingest

### Paso 2: Verificar `getMacroDiagnosis()`
```bash
curl https://macro-dashboard-seven.vercel.app/api/debug/macro-diagnosis
```
**Si devuelve valores:** El problema está después de `getMacroDiagnosis()`  
**Si devuelve nulls:** El problema está en `getMacroDiagnosis()` o `getAllLatestFromDB()`

### Paso 3: Trazar la cadena completa
```bash
curl https://macro-dashboard-seven.vercel.app/api/debug/bias-chain
```
**Identificar en qué paso se pierden los valores:**
- Si `step1` tiene valores pero `step4` no → problema en el mapeo
- Si `step1` no tiene valores → problema en `getMacroDiagnosis()`

### Paso 4: Comparar con `/api/bias`
```bash
curl https://macro-dashboard-seven.vercel.app/api/bias | jq '.items[0]'
```
**Si `/api/bias` tiene valores pero el dashboard no:**
- Diferencia en el código path
- `/api/bias` usa `getMacroDiagnosis()` directamente
- Dashboard usa `getBiasState()` → `getBiasRaw()` → `getMacroDiagnosisWithDelta()`

---

## 📝 DIFERENCIAS CLAVE ENTRE ENDPOINTS

### `/api/bias` (FUNCIONA)
```typescript
// app/api/bias/route.ts
const diagnosis = await getMacroDiagnosis()
items = diagnosis.items  // ← Usa items directamente
return Response.json({ items, ... })
```

### Dashboard (NO FUNCIONA)
```typescript
// app/dashboard/page.tsx
const biasState = await getBiasState()
// biasState viene de:
//   getBiasState() → getBiasRaw() → getMacroDiagnosisWithDelta() → getMacroDiagnosis()
const indicatorRows = buildIndicatorRows(biasState.table)
// biasState.table viene de:
//   getBiasRaw() mapea diagnosis.items a BiasRow[]
```

**Diferencia clave:**
- `/api/bias` usa `diagnosis.items` directamente
- Dashboard usa `biasState.table` que es un mapeo de `diagnosis.items`

**El mapeo en `getBiasRaw()`:**
```typescript
// domain/macro-engine/bias.ts
const table: BiasRow[] = latestPoints.map((item: any) => ({
  value: item.value ?? null,  // ← Preserva value
  value_previous: item.value_previous ?? null,
  date: dateValue,
  // ...
}))
```

**Si `latestPoints` (que viene de `diagnosis.items`) tiene `value: null`, entonces `table` también tendrá `value: null`**

---

## 🎯 CONCLUSIÓN Y ACCIÓN INMEDIATA

### Problema más probable:
1. `getAllLatestFromDB()` devuelve `value: null` (transformaciones fallan)
2. `indicator_history` está vacío o no tiene datos para los keys correctos
3. El fallback no puede funcionar porque no hay datos previos

### Solución inmediata:
1. **Ejecutar job de ingest para poblar `indicator_history`:**
   ```bash
   curl -XPOST -H "Authorization: Bearer ${CRON_TOKEN}" \
     https://macro-dashboard-seven.vercel.app/api/jobs/ingest/fred
   ```

2. **Verificar que `indicator_history` se pobló:**
   ```bash
   curl https://macro-dashboard-seven.vercel.app/api/debug/indicator-history
   ```

3. **Si `indicator_history` tiene datos pero el dashboard sigue mostrando "—":**
   - Verificar el mapeo de keys (`weightKey` vs `originalKey`)
   - Verificar que el fallback se está aplicando correctamente
   - Usar `/api/debug/bias-chain` para identificar dónde se pierden los valores

---

## 📚 ARCHIVOS CLAVE PARA REVISAR

1. **`domain/diagnostic.ts`** - Lógica de `getMacroDiagnosis()` y fallback
2. **`domain/macro-engine/bias.ts`** - Lógica de `getBiasState()` y mapeo
3. **`lib/db/read-macro.ts`** - `getAllLatestFromDB()` y transformaciones
4. **`app/dashboard/page.tsx`** - Cómo el dashboard usa `biasState.table`
5. **`lib/db/read.ts`** - `getAllIndicatorHistories()` y `upsertIndicatorHistory()`

---

---

## 📄 PÁGINAS Y FUNCIONALIDADES

### 1. Dashboard (`/dashboard`)

**Objetivo:** Vista principal con indicadores macro, régimen actual, escenarios y pares tácticos.

**Fuentes de datos:**
- `getBiasState()` - Estado completo del bias macro
- `getCorrelationState()` - Estado de correlaciones

**Componentes principales:**
- Régimen actual del mercado (overall, USD, Quad, Liquidity, Credit, Risk)
- Tabla de indicadores macro (por categoría)
- Vista rápida de pares tácticos (categorizados: Forex, Metales, Crypto, Índices)
- Escenarios detectados
- Resumen de correlaciones USD

**Última actualización:** Integrado con Macro Engine (`domain/macro-engine/bias.ts` y `correlations.ts`)

---

### 2. Narrativas (`/narrativas`)

**Objetivo:** Mostrar narrativas macroeconómicas por activo, derivadas del macro engine.

**Fuentes de datos:**
- `getBiasState()` - Para `tableTactical` (narrativas por activo)
- `getCorrelationState()` - Para `shifts` (cambios de correlación)

**Mejoras implementadas (2025-11-17):**
- ✅ **Contexto macro actual:** Muestra régimen general, USD, Quad, Liquidity, Credit, Risk
- ✅ **Consistencia de labels:** Usa los mismos labels que el Dashboard
- ✅ **Última actualización:** Muestra timestamp de `biasState.updatedAt`
- ✅ **Estructura de datos:** Cada narrativa incluye:
  - `par`: Símbolo del activo
  - `tactico`: Tendencia (Alcista/Bajista/Neutral)
  - `accion`: Acción recomendada
  - `confianza`: Nivel de confianza (Alta/Media/Baja)
  - `motivo`: Narrativa macro explicativa
  - `corr12m`, `corr3m`: Correlaciones con DXY

**Página de detalle:** `/narrativas/[symbol]` muestra análisis detallado con:
- Explicación del mercado
- Explicación de correlaciones
- Drivers macroeconómicos principales
- Implicaciones para el trading

---

### 3. Noticias (`/noticias`)

**Objetivo:** Calendario macroeconómico con eventos de la próxima semana.

**Fuentes de datos:**
- `getCalendarEvents()` - Eventos del calendario macro (`lib/notifications/weekly.ts`)
- `getIndicatorHistory()` - Datos históricos para cada evento

**Estructura de datos:**
- Cada evento incluye:
  - `fecha`: Fecha del evento
  - `hora_local`: Hora local
  - `pais`: País
  - `tema`: Tema (CPI, GDP, NFP, etc.)
  - `evento`: Nombre del evento
  - `importancia`: 'high' o 'med'
  - `consenso`: Previsión de analistas
  - `indicatorKey`: Clave del indicador relacionado (mapeo automático)
  - `history`: Datos históricos (value_current, value_previous, dates)

**Mejoras implementadas (2025-11-17):**
- ✅ **Manejo de errores:** Try-catch con mensaje de error amigable
- ✅ **Estados vacíos:** Mensaje claro cuando no hay eventos
- ✅ **Análisis automático:** Compara dato anterior vs previsión
- ✅ **Mapeo de indicadores:** Asocia eventos con indicadores automáticamente

**Nota:** Esta página muestra el calendario económico, no noticias de fuentes externas. Las noticias reales se gestionan en `/admin/news`.

---

### 4. Admin (`/admin`)

**Objetivo:** Panel de administración con acceso controlado.

**Autenticación:**
- Protegido con `isAdminAuthenticated()` (`lib/auth.ts`)
- Redirige a `/admin/login` si no está autenticado
- Sesiones expiran después de 24 horas

**Secciones principales:**
- **Dashboard (`/admin/dashboard`):** Vista general del sistema
  - Estado de notificaciones Telegram
  - Métricas (enviados, fallidos, rate limited)
  - Estado de la cola
  - Noticias y eventos recientes
  - Acciones rápidas (jobs, verificación)
- **Notificaciones (`/admin/notifications`):** Configuración de Telegram
- **Calendario (`/admin/calendar`):** Gestión de eventos macro
- **Noticias (`/admin/news`):** Gestión de noticias publicadas

**Jobs disponibles:**
- `/api/jobs/ingest/fred` - Ingesta de datos FRED
- `/api/jobs/ingest/macro` - Ingesta de datos macro
- `/api/jobs/correlations` - Cálculo de correlaciones
- `/api/jobs/compute/bias` - Cálculo de bias macro
- `/api/jobs/weekly` - Notificación semanal
- `/api/jobs/digest` - Resumen diario
- `/api/jobs/maintenance` - Mantenimiento de BD

**Mejoras recomendadas (pendientes):**
- ⏳ Panel de estado del sistema con datos del macro engine
- ⏳ Job triggers mejorados con feedback visual
- ⏳ Última actualización de cada job visible

---

### 5. Notificaciones (`/notificaciones`)

**Objetivo:** Configuración de preferencias de notificaciones del usuario.

**Funcionalidad:**
- Configuración de Chat ID de Telegram
- Preferencias de notificaciones (news, narrative, weekly, daily)
- Persistencia en localStorage
- Registro opcional en servidor vía `/api/notifications/user-config`

**Tipos de notificaciones:**
- `news_high`: Noticias de alto impacto
- `news_medium`: Noticias de impacto medio
- `narrative_changes`: Cambios de narrativa macro
- `weekly_ahead`: Resumen semanal
- `daily_digest`: Resumen diario

**Sistema de notificaciones backend:**
- **Triggers:** `lib/alerts/triggers.ts`
  - `checkUSDChange()` - Cambios en régimen USD
  - `checkCorrelationChanges()` - Cambios en correlaciones
  - `checkMacroReleases()` - Nuevos datos macro
- **Builders:** `lib/alerts/builders.ts` - Plantillas de mensajes
- **Estado:** `lib/alerts/state.ts` - Persistencia en SQLite
- **Historial:** `notification_history` table

**Mejoras recomendadas (pendientes):**
- ⏳ Historial de notificaciones visible en la página
- ⏳ Notificaciones derivadas del macro engine (cambios de régimen, etc.)

---

### 6. Correlaciones (`/correlations`)

**Objetivo:** Visualizar correlaciones entre activos y benchmarks.

**Fuentes de datos:**
- `getCorrelationState()` - Estado completo de correlaciones
- `getBiasState()` - Contexto macro para relevancia

**Componentes:**
- Contexto macro actual (regime, USD, Quad)
- Mapa de correlaciones con:
  - Ventana más fuerte
  - Correlación actual
  - Tendencia (Strengthening/Weakening/Stable/Inconclusive)
  - Régimen de cambio (Break/Reinforcing/Stable/Weak)
  - Relevancia macro (score 0-1)

---

### 7. Sesgos (`/sesgos`)

**Objetivo:** Visualizar sesgos de trading por activo.

**Fuentes de datos:**
- `getTradingBiasState()` - Estado de sesgos de trading (`domain/macro-engine/trading-bias.ts`)

**Componentes:**
- Contexto global (regime)
- Tabla de sesgos por activo:
  - Activo
  - Sesgo (Long/Short/Neutral)
  - Convicción (Alta/Media/Baja)
  - Narrativa macro
  - Correlación
  - Flags de riesgo

---

## 🔧 MEJORAS IMPLEMENTADAS (2025-11-17)

### Narrativas
- ✅ Contexto macro actual visible en la página principal
- ✅ Consistencia de labels con Dashboard
- ✅ Timestamp de última actualización

### Noticias
- ✅ Manejo robusto de errores con try-catch
- ✅ Estados vacíos con mensajes claros
- ✅ Análisis automático de datos anteriores vs previsión

### Admin
- ✅ Autenticación implementada
- ✅ Dashboard funcional con métricas
- ⏳ Panel de estado del sistema (pendiente)
- ⏳ Job triggers mejorados (pendiente)

### Notificaciones
- ✅ Configuración de preferencias funcional
- ✅ Persistencia en localStorage
- ⏳ Historial visible (pendiente)

---

**Última actualización:** 2025-11-17  
**Commits relevantes:** `a91d2de`, `870e4ee`, `f5168f2`, `44e8afe`, `bc85bdb`

