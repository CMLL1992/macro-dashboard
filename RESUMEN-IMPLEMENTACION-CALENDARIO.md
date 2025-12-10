# ✅ Resumen de Implementación: Calendario y Sorpresas Macro

## 🎯 Objetivo Completado

Sistema completo para:
1. **Calendario económico:** Eventos programados con vínculo a series macro
2. **Releases reales:** Datos publicados vs consenso, cálculo de sorpresas
3. **Impacto en sesgos:** Tracking de cómo los eventos afectan los scores macro
4. **UI en tiempo real:** Dashboard muestra eventos recientes y estado de actualización

---

## 📦 Archivos Creados/Modificados

### Nuevos Archivos

1. **`lib/db/economic-events.ts`**
   - Funciones para calcular sorpresas
   - `upsertEconomicRelease()` - Crear/actualizar releases
   - `getRecentReleases()` - Obtener releases recientes
   - `recordMacroEventImpact()` - Registrar impacto en sesgos

2. **`lib/db/recent-events.ts`**
   - `getRecentEventsWithImpact()` - Eventos con impacto para `/api/bias`
   - `getLastRelevantEventForCurrency()` - Último evento por moneda

3. **`app/api/jobs/ingest/calendar/route.ts`**
   - Job para ingesta de calendario económico
   - Mapea eventos externos a configuración interna
   - Upserta en `economic_events`

4. **`app/api/jobs/ingest/releases/route.ts`**
   - Job para ingesta de releases (cada minuto)
   - Detecta eventos en ventana `[now - 2m, now + 1m]`
   - Calcula sorpresas y dispara recomputo de bias

5. **`components/RecentMacroEvents.tsx`**
   - Componente React para mostrar últimos eventos macro
   - Muestra sorpresas, impacto y estado de actualización

6. **`scripts/example-insert-economic-event.ts`**
   - Script de ejemplo para insertar evento y release manualmente

7. **`docs/CALENDARIO-Y-SORPRESAS-MACRO.md`**
   - Documentación completa del sistema

8. **`docs/CONFIGURACION-JOBS-CALENDARIO.md`**
   - Guía de configuración de cron jobs

### Archivos Modificados

1. **`lib/db/schema.ts`**
   - ✅ Añadidas tablas: `economic_events`, `economic_releases`, `macro_event_impact`
   - ✅ Añadidos índices para performance

2. **`lib/db/unified-db.ts`**
   - ✅ Añadidas tablas al schema unificado (Turso)

3. **`domain/macro-engine/bias.ts`**
   - ✅ Tipo `TacticalBiasRow` ampliado con `last_relevant_event` y `updated_after_last_event`

4. **`app/api/bias/route.ts`**
   - ✅ Ampliado para incluir `recentEvents[]` y `meta`
   - ✅ Filas tácticas enriquecidas con info del último evento

5. **`lib/dashboard-data.ts`**
   - ✅ Tipo `DashboardData` ampliado con `recentEvents` y `meta`
   - ✅ `buildTacticalSafe()` incluye nuevos campos
   - ✅ `getDashboardData()` obtiene eventos recientes

6. **`app/dashboard/page.tsx`**
   - ✅ Incluye componente `RecentMacroEvents`
   - ✅ Muestra eventos recientes después del régimen

7. **`components/TacticalTablesClient.tsx`**
   - ✅ Muestra `last_relevant_event` y `updated_after_last_event` en cada fila

---

## 🗄️ Estructura de Base de Datos

### Tabla `economic_events`
- Calendario estático/futuro de eventos
- Vínculo con series FRED (`series_id`, `indicator_key`)
- Consenso y valores previos
- Direccionalidad (`higher_is_positive` / `lower_is_positive`)

### Tabla `economic_releases`
- Releases reales con sorpresas calculadas
- `surprise_raw`, `surprise_pct`, `surprise_score`, `surprise_direction`
- Referencia a `economic_events`

### Tabla `macro_event_impact`
- Snapshot before/after de scores y regímenes
- Útil para backtesting y análisis histórico

---

## 🔄 Flujo Completo

### 1. Ingesta de Calendario (diario)
```
02:00 UTC → /api/jobs/ingest/calendar
  ↓
fetchFromCalendarAPI() → eventos externos
  ↓
mapExternalEventToInternal() → mapeo a series FRED
  ↓
upsertEconomicEvent() → economic_events
```

### 2. Ingesta de Releases (cada minuto)
```
Cada minuto → /api/jobs/ingest/releases
  ↓
getEventsWithoutRelease() → eventos en ventana [now-2m, now+1m]
  ↓
fetchReleaseFromCalendarAPI() → dato real
  ↓
upsertEconomicRelease() → economic_releases + sorpresa
  ↓
recordMacroEventImpact() → macro_event_impact
  ↓
recomputeAllBiasAndCorrelations() → actualiza sesgos
```

### 3. Dashboard en Tiempo Real
```
GET /api/bias
  ↓
getRecentEventsWithImpact() → últimos 48h, importance >= medium
  ↓
getLastRelevantEventForCurrency() → último evento por moneda
  ↓
Enriquece TacticalBiasRow con last_relevant_event
  ↓
Retorna recentEvents[] + meta.bias_updated_at + meta.last_event_applied_at
```

---

## 🎨 UI Implementada

### 1. Bloque "Últimos eventos macro"

**Ubicación:** Dashboard, después del régimen global

**Muestra:**
- Currency badge (USD, EUR, GBP, JPY, AUD)
- Nombre del evento (CPI YoY, NFP, etc.)
- Importancia (Alta/Media/Baja)
- Actual vs Consenso
- Sorpresa (POSITIVA/NEGATIVA) con color
- Score de sorpresa
- Impacto: cambio de score y régimen
- Estado: ✅ Sesgos actualizados / ⚠️ Sin actualizar

**Ejemplo visual:**
```
[USD] CPI YoY (Alta Importancia)
Actual: 3.4% vs Consenso: 3.1% (Δ +0.3)
Sorpresa POSITIVA (Fuerte) Score: 0.80
Impacto: USD totalScore 0.15 → 0.27 (+0.12) | Régimen: Mixed → Reflation
Hace 2 min · Sesgos actualizados ✓
```

### 2. Tabla Táctica Enriquecida

**Ubicación:** Dashboard y `/sesgos`

**Cada fila muestra:**
- Par, Tendencia, Acción, Confianza (como antes)
- **NUEVO:** Sub-línea con último evento relevante:
  ```
  Último evento relevante: [USD] CPI YoY
  Sorpresa: POSITIVA (score: 0.80) · Hace 2 min · Sesgo actualizado ✓
  ```

**Estados:**
- ✅ **Sesgo actualizado:** `updated_after_last_event: true`
- ⚠️ **Sesgo sin actualizar:** `updated_after_last_event: false`

### 3. Meta Info de Frescura

**Ubicación:** Dashboard header

**Muestra:**
- Último cálculo de bias: `meta.bias_updated_at`
- Último evento aplicado: `meta.last_event_applied_at`

---

## 🔧 Configuración Necesaria

### 1. Variables de Entorno

```bash
CRON_TOKEN=tu_token_secreto
APP_URL=https://tuapp.vercel.app
```

### 2. Implementar APIs Externas

**TODO en `/api/jobs/ingest/calendar/route.ts`:**
- Implementar `fetchFromCalendarAPI()` según tu API preferida
- Ejemplos: TradingEconomics, Investing.com, FXStreet, etc.

**TODO en `/api/jobs/ingest/releases/route.ts`:**
- Implementar `fetchReleaseFromCalendarAPI()` para obtener datos reales

### 3. Cron Jobs

**Vercel Cron (`vercel.json`):**
```json
{
  "crons": [
    {
      "path": "/api/jobs/ingest/calendar",
      "schedule": "0 2 * * *"
    },
    {
      "path": "/api/jobs/ingest/releases",
      "schedule": "* 8-20 * * *"
    }
  ]
}
```

**GitHub Actions (alternativa):**
- Crear workflow `.github/workflows/calendar-ingest.yml`
- Crear workflow `.github/workflows/releases-ingest.yml`

---

## 📊 Ejemplo de Uso

### Insertar Evento y Release Manualmente

```bash
pnpm tsx scripts/example-insert-economic-event.ts
```

Esto crea:
1. Evento en `economic_events`
2. Release en `economic_releases` con sorpresa calculada
3. Impacto en `macro_event_impact` (si hay datos suficientes)

### Ver en Dashboard

1. Abre `/dashboard`
2. Verás bloque "Últimos eventos macro" con el evento insertado
3. En tabla táctica, cada par mostrará último evento relevante si aplica

### Ver en API

```bash
curl https://tuapp.vercel.app/api/bias | jq '.recentEvents'
```

---

## ✅ Checklist de Implementación

- [x] Tablas de BD creadas (`economic_events`, `economic_releases`, `macro_event_impact`)
- [x] Funciones de cálculo de sorpresas
- [x] Job de ingesta de calendario (`/api/jobs/ingest/calendar`)
- [x] Job de ingesta de releases (`/api/jobs/ingest/releases`)
- [x] Endpoint `/api/bias` ampliado con `recentEvents` y `meta`
- [x] Componente `RecentMacroEvents` para UI
- [x] Tabla táctica enriquecida con `last_relevant_event`
- [x] Dashboard muestra eventos recientes
- [x] Documentación completa
- [ ] **TODO:** Implementar `fetchFromCalendarAPI()` (según tu API)
- [ ] **TODO:** Implementar `fetchReleaseFromCalendarAPI()` (según tu API)
- [ ] **TODO:** Configurar cron jobs en Vercel/GitHub Actions

---

## 🎯 Próximos Pasos

1. **Elegir API de calendario económico:**
   - TradingEconomics (requiere API key)
   - Investing.com (scraping)
   - FXStreet (API o scraping)
   - Otra de tu preferencia

2. **Implementar `fetchFromCalendarAPI()`** en `/api/jobs/ingest/calendar/route.ts`

3. **Implementar `fetchReleaseFromCalendarAPI()`** en `/api/jobs/ingest/releases/route.ts`

4. **Configurar cron jobs** según documentación en `docs/CONFIGURACION-JOBS-CALENDARIO.md`

5. **Probar con datos reales** durante horas de mercado

6. **Ajustar ventanas y frecuencias** según tus necesidades

---

## 📚 Documentación Relacionada

- `docs/CALENDARIO-Y-SORPRESAS-MACRO.md` - Documentación técnica completa
- `docs/CONFIGURACION-JOBS-CALENDARIO.md` - Guía de configuración de jobs
- `scripts/example-insert-economic-event.ts` - Ejemplo práctico

---

**Estado:** ✅ Implementación completa, pendiente de integrar APIs externas

