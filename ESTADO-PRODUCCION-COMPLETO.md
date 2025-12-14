# 📊 ESTADO ACTUAL DE LA APLICACIÓN EN PRODUCCIÓN
## Resumen Exhaustivo para Revisión y Corrección

**Fecha del resumen:** 2025-12-12  
**Última actualización del código:** Commit `275dc3a` (Fix: Add dynamic exports to debug endpoints)

---

## 1. ENTORNO Y DESPLIEGUE

### 1.1. Infraestructura
- **Plataforma de hosting:** Vercel
- **URL de producción:** `https://macro-dashboard-seven.vercel.app`
- **Rama de despliegue:** `main` (deploy automático desde GitHub)
- **Base de datos:** Turso (libSQL) - **NO SQLite local en producción**
- **Framework:** Next.js 14.2.5
- **Node.js:** 20.x (verificado en build logs)

### 1.2. Variables de Entorno en Producción
**Variables OBLIGATORIAS configuradas:**
- ✅ `TURSO_DATABASE_URL` - Base de datos Turso (libSQL)
- ✅ `TURSO_AUTH_TOKEN` - Token de autenticación Turso
- ✅ `FRED_API_KEY` - API key de FRED para datos macro USA
- ✅ `CRON_TOKEN` - Token para proteger endpoints `/api/jobs/*` (valor: `cbc3d1139031a75f4721ddb45bf8cca4a79b115d4c15ba83e1a1713898cdbc82`)

**Variables OPCIONALES (si están configuradas):**
- `TELEGRAM_BOT_TOKEN` - Para notificaciones Telegram
- `TELEGRAM_CHAT_ID` - Chat ID para notificaciones
- `APP_URL` - URL de producción (usado por jobs automatizados)

### 1.3. Diferencias Clave: Local vs Producción

| Aspecto | Local | Producción |
|---------|-------|------------|
| **Base de datos** | SQLite (`/tmp/macro.db` o ruta local) | Turso (libSQL remoto) |
| **Detección** | `isUsingTurso()` devuelve `false` | `isUsingTurso()` devuelve `true` |
| **Build** | `pnpm build` genera estático + dinámico | Vercel build detecta dinámico automáticamente |
| **Cron jobs** | Manual o scripts locales | Automáticos vía `vercel.json` |
| **Variables de entorno** | `.env.local` | Vercel Dashboard → Environment Variables |
| **API externas** | Mismas URLs (FRED, Yahoo, Binance) | Mismas URLs (FRED, Yahoo, Binance) |

### 1.4. Cron Jobs Configurados (vercel.json)
Los siguientes jobs se ejecutan automáticamente en producción:

| Horario (UTC) | Endpoint | Descripción |
|---------------|----------|-------------|
| `0 6 * * *` | `/api/jobs/ingest/fred` | Ingesta datos FRED (USA) |
| `30 6 * * *` | `/api/jobs/transform/indicators` | Transformación de indicadores |
| `0 7 * * *` | `/api/jobs/ingest/european` | Ingesta datos Eurostat/ECB (Eurozona) |
| `0 8 * * *` | `/api/jobs/ingest/calendar` | Ingesta calendario económico |
| `0 8 * * *` | `/api/jobs/daily/calendar` | Procesamiento diario calendario |
| `0 9 * * *` | `/api/jobs/ingest/assets` | Ingesta precios de activos |
| `30 9 * * *` | `/api/jobs/correlations` | Cálculo de correlaciones |
| `0 10 * * *` | `/api/jobs/compute/bias` | Cálculo de sesgos macro |
| `0 18 * * 0` | `/api/jobs/weekly` | Job semanal (domingos) |

**Nota:** Todos los endpoints requieren header `Authorization: Bearer ${CRON_TOKEN}`.

---

## 2. QUÉ SÍ ESTÁ FUNCIONANDO CORRECTAMENTE

### 2.1. Dashboard Principal
- ✅ **Carga correctamente** - La página `/dashboard` se renderiza sin errores
- ✅ **Muestra datos reales** - Los indicadores macro se muestran con valores actuales
- ✅ **Indicadores Eurozona** - Se están ingiriendo desde Eurostat/ECB (no TradingEconomics)
- ✅ **Indicadores USA** - Se están ingiriendo desde FRED exclusivamente
- ✅ **Base de datos limpia** - El job de limpieza (`/api/jobs/cleanup/pairs`) se ejecutó exitosamente y eliminó 246 registros de pares no permitidos

### 2.2. Jobs de Ingesta
- ✅ **`/api/jobs/ingest/fred`** - Funciona correctamente, ingiere datos USA desde FRED
- ✅ **`/api/jobs/ingest/european`** - Funciona correctamente, ingiere datos Eurozona desde Eurostat/ECB
- ✅ **`/api/jobs/correlations`** - Calcula correlaciones correctamente usando Yahoo Finance
- ✅ **`/api/jobs/compute/bias`** - Calcula sesgos macro correctamente

### 2.3. Base de Datos
- ✅ **Conexión a Turso** - Funciona correctamente en producción
- ✅ **Tablas inicializadas** - Schema aplicado automáticamente
- ✅ **Datos históricos** - Se están guardando observaciones históricas (desde 2010)
- ✅ **Limpieza ejecutada** - El job `/api/jobs/cleanup/pairs` eliminó:
  - 0 `pair_signals` (ya estaban filtrados)
  - 126 `correlations` (pares no permitidos)
  - 120 `correlations_history` (historial de pares no permitidos)

### 2.4. Fuentes de Datos
- ✅ **FRED API** - Funciona correctamente para datos USA
- ✅ **Eurostat API** - Funciona correctamente para datos Eurozona (GDP, Industrial Production, Retail Sales)
- ✅ **ECB SDW** - Funciona correctamente para inflación/HICP
- ✅ **Yahoo Finance** - Funciona correctamente para correlaciones
- ✅ **TradingEconomics** - **ELIMINADO** para Eurozona y USA (solo se usa para países FREE: Suecia, México, Nueva Zelanda, Tailandia)

---

## 3. QUÉ NO ESTÁ FUNCIONANDO CORRECTAMENTE (O FUNCIONA MAL)

### 3.1. PROBLEMA CRÍTICO: Dashboard muestra TODOS los pares, no solo los 19 permitidos

**Descripción del problema:**
- El dashboard en producción sigue mostrando todos los pares tácticos (decenas de pares), no solo los 19 definidos en `config/tactical-pairs.json`
- Aunque la base de datos ya está limpia (solo tiene los 19 pares), el dashboard sigue renderizando más pares

**Archivos afectados:**
1. `lib/dashboard-data.ts` (líneas 402-436)
   - Ya tiene filtrado implementado, pero puede que no se esté ejecutando correctamente
   - Filtra `tacticalRows` después de obtenerlos de `getBiasState()`

2. `domain/macro-engine/bias.ts` (líneas 187-315)
   - `getBiasRaw()` genera `tacticalRows` desde `getBiasTableTactical()`
   - Tiene filtrado añadido recientemente (commit `094fc1f`), pero puede haber un problema en la lógica

3. `domain/bias.ts` (líneas 70-160)
   - `getBiasTableFromUniverse()` ya carga desde `tactical-pairs.json`
   - Pero puede estar generando más pares de alguna otra fuente

**Diferencia local vs producción:**
- **Local:** Puede que funcione porque los datos de prueba son limitados
- **Producción:** El problema es visible porque hay más datos históricos y el dashboard muestra todos los pares que encuentra

**Logs/Errores:**
- No hay errores explícitos en los logs
- El problema es que `getBiasState().tableTactical` devuelve más pares de los esperados

**Solución parcial aplicada:**
- Se añadió filtrado en múltiples capas:
  1. `getBiasTableFromUniverse()` - Carga solo de `tactical-pairs.json`
  2. `getBiasRaw()` - Filtra después de `getBiasTableTactical()`
  3. `lib/dashboard-data.ts` - Filtra antes de mostrar
- **Pero el problema persiste**, lo que sugiere que hay otra fuente de datos que no está siendo filtrada

**Archivos a revisar:**
- `domain/bias.ts` - Función `getBiasTableTactical()` y `legacyGetBiasTableTactical()`
- `lib/db/read.ts` - Función `getMacroTacticalBias()` que puede estar devolviendo todos los pares del cache
- `app/api/jobs/compute/bias/route.ts` - Puede estar guardando más pares de los permitidos

---

### 3.2. PROBLEMA MENOR: Endpoints de debug con `cache: 'no-store'` sin `dynamic = 'force-dynamic'`

**Descripción del problema:**
- Algunos endpoints de debug causaban error `DYNAMIC_SERVER_USAGE` durante el build de Vercel
- Next.js detecta `cache: 'no-store'` en handlers que intenta generar como estáticos

**Archivos afectados:**
- ✅ `app/api/debug/european-indicators/route.ts` - **CORREGIDO** (commit `275dc3a`)
- ✅ `app/api/debug/dashboard-data/route.ts` - **CORREGIDO** (commit `275dc3a`)
- ✅ Otros endpoints de debug ya tenían `export const dynamic = 'force-dynamic'`

**Solución aplicada:**
- Se añadieron las exportaciones necesarias:
  ```typescript
  export const dynamic = 'force-dynamic'
  export const revalidate = 0
  ```

**Estado:** ✅ **RESUELTO** - Los endpoints de debug ya no deberían causar errores de build

---

### 3.3. PROBLEMA POTENCIAL: Referencias a ETHUSDT en código (no en endpoints de debug)

**Descripción:**
- Aunque no hay referencias a `ETHUSDT` en endpoints de debug, sí hay referencias en otros archivos:
  - `lib/markets/binance.ts` - Función `binanceKlinesMonthly()` acepta `'BTCUSDT' | 'ETHUSDT'`
  - `domain/corr-dashboard.ts` - Lista hardcodeada incluye `'BTCUSDT','ETHUSDT'`
  - `config/assets.config.json` - Tiene `ETHUSDT` en la lista de crypto
  - `config/universe.assets.json` - Tiene `ETHUSDT` en la lista

**Impacto:**
- Estos archivos NO causan errores de build porque no son endpoints
- Pero pueden estar generando datos para pares que ya no queremos

**Archivos a revisar:**
- `lib/markets/binance.ts` - Cambiar `ETHUSDT` → `ETHUSD` si es necesario
- `domain/corr-dashboard.ts` - Actualizar lista hardcodeada
- `config/assets.config.json` - Actualizar si es necesario
- `config/universe.assets.json` - Este archivo ya NO se usa para pares tácticos (se usa `tactical-pairs.json`)

**Estado:** ⚠️ **REVISAR** - No es crítico pero debería limpiarse para consistencia

---

### 3.4. PROBLEMA POTENCIAL: Cache de `macro_bias` puede tener pares antiguos

**Descripción:**
- La tabla `macro_bias` puede tener entradas para pares que ya no están en `tactical-pairs.json`
- `getBiasRaw()` tiene un fallback que usa `getMacroTacticalBias()` si `tacticalRows` está vacío
- Aunque se añadió filtrado en el fallback (commit `094fc1f`), la tabla `macro_bias` puede seguir teniendo datos antiguos

**Archivo afectado:**
- `domain/macro-engine/bias.ts` (líneas 264-288)
- `lib/db/read.ts` - Función `getMacroTacticalBias()` lee de tabla `macro_bias`

**Solución aplicada:**
- Se añadió filtrado en el fallback de `getBiasRaw()`
- Pero la tabla `macro_bias` puede seguir teniendo datos antiguos

**Solución recomendada:**
- Ejecutar un script de limpieza para eliminar entradas de `macro_bias` que no estén en `tactical-pairs.json`
- O modificar `getMacroTacticalBias()` para filtrar directamente en la query SQL

**Estado:** ⚠️ **REVISAR** - Puede ser la causa del problema principal (3.1)

---

## 4. ESTADO DE PARES Y DATOS

### 4.1. Pares Permitidos (config/tactical-pairs.json)
**Total: 19 pares**

**Crypto (2):**
- BTCUSD
- ETHUSD

**G10 FX (7):**
- EURUSD
- GBPUSD
- USDJPY
- USDCHF
- AUDUSD
- NZDUSD
- USDCAD

**EM FX (3):**
- USDCNH
- USDBRL
- USDMXN

**Índices (4):**
- SPX
- NDX
- SX5E
- NIKKEI

**Commodities (3):**
- XAUUSD
- WTI
- COPPER

### 4.2. Estado de la Base de Datos
**Después de ejecutar `/api/jobs/cleanup/pairs` (2025-12-12):**
- ✅ `pair_signals` - Solo pares permitidos (0 eliminados, ya estaban filtrados)
- ✅ `correlations` - Solo pares permitidos (126 eliminados)
- ✅ `correlations_history` - Solo pares permitidos (120 eliminados)
- ⚠️ `macro_bias` - **NO se limpió** (puede tener pares antiguos)

### 4.3. Estado del Dashboard
- ❌ **Muestra TODOS los pares** - No solo los 19 permitidos
- ⚠️ **Causa probable:** `getBiasState().tableTactical` devuelve más pares de los esperados
- ⚠️ **Posible fuente:** Tabla `macro_bias` o alguna lista hardcodeada que no está siendo filtrada

---

## 5. WORKAROUNDS Y APAÑOS APLICADOS

### 5.1. Filtrado en Múltiples Capas
**Problema:** El dashboard mostraba todos los pares  
**Solución temporal:** Se añadió filtrado en 3 capas diferentes:
1. `getBiasTableFromUniverse()` - Carga solo de `tactical-pairs.json`
2. `getBiasRaw()` - Filtra después de generar `tacticalRows`
3. `lib/dashboard-data.ts` - Filtra antes de mostrar

**Estado:** ⚠️ **PARCIALMENTE EFECTIVO** - El problema persiste, sugiere que hay otra fuente de datos

### 5.2. Job de Limpieza Manual
**Problema:** Base de datos tenía datos de pares antiguos  
**Solución:** Se creó `/api/jobs/cleanup/pairs` para eliminar datos antiguos  
**Ejecución:** Se ejecutó manualmente el 2025-12-12, eliminó 246 registros  
**Estado:** ✅ **FUNCIONA** - Pero no limpia la tabla `macro_bias`

### 5.3. Exportaciones Dinámicas en Endpoints de Debug
**Problema:** Errores `DYNAMIC_SERVER_USAGE` durante build  
**Solución:** Se añadieron `export const dynamic = 'force-dynamic'` y `export const revalidate = 0`  
**Estado:** ✅ **RESUELTO**

### 5.4. Migración de TradingEconomics a Fuentes Gratuitas
**Problema:** TradingEconomics tenía límites en plan FREE  
**Solución:** Se migró Eurozona a Eurostat/ECB, USA a FRED exclusivamente  
**Estado:** ✅ **COMPLETADO** - TradingEconomics solo se usa para países FREE (Suecia, México, Nueva Zelanda, Tailandia)

---

## 6. PENDIENTES E IMPORTANTE REVISAR

### 6.1. CRÍTICO: Resolver problema de pares en dashboard
**Prioridad:** 🔴 **ALTA**

**Tareas:**
1. Verificar qué devuelve exactamente `getBiasState().tableTactical` en producción
2. Revisar si `getMacroTacticalBias()` está devolviendo todos los pares de `macro_bias`
3. Limpiar tabla `macro_bias` para eliminar pares no permitidos
4. Verificar si hay listas hardcodeadas en `domain/bias.ts` o `lib/db/read.ts`
5. Añadir logging para rastrear de dónde vienen los pares extra

**Archivos a revisar:**
- `domain/macro-engine/bias.ts` - Función `getBiasRaw()` y `getBiasState()`
- `lib/db/read.ts` - Función `getMacroTacticalBias()`
- `domain/bias.ts` - Función `getBiasTableTactical()` y `legacyGetBiasTableTactical()`
- `app/api/jobs/compute/bias/route.ts` - Verificar qué pares se están guardando en `macro_bias`

### 6.2. Limpiar referencias a ETHUSDT en código
**Prioridad:** 🟡 **MEDIA**

**Tareas:**
1. Actualizar `lib/markets/binance.ts` - Cambiar `ETHUSDT` → `ETHUSD` si es necesario
2. Actualizar `domain/corr-dashboard.ts` - Cambiar lista hardcodeada
3. Revisar `config/assets.config.json` - Actualizar si es necesario
4. Verificar que `config/universe.assets.json` ya no se usa para pares tácticos

### 6.3. Limpiar tabla `macro_bias`
**Prioridad:** 🟡 **MEDIA**

**Tareas:**
1. Crear script o endpoint para limpiar `macro_bias` de pares no permitidos
2. O modificar `getMacroTacticalBias()` para filtrar directamente en la query SQL
3. Ejecutar limpieza después de verificar que funciona correctamente

### 6.4. Verificar que todos los filtros funcionan correctamente
**Prioridad:** 🟡 **MEDIA**

**Tareas:**
1. Añadir logging detallado en cada capa de filtrado
2. Verificar que los filtros se ejecutan en el orden correcto
3. Asegurar que no hay race conditions o problemas de timing

### 6.5. Documentar flujo completo de datos
**Prioridad:** 🟢 **BAJA**

**Tareas:**
1. Documentar cómo fluyen los datos desde la base de datos hasta el dashboard
2. Crear diagrama de flujo de `getBiasState()` → `getDashboardData()` → Dashboard
3. Documentar todas las fuentes de datos para pares tácticos

---

## 7. RESUMEN EJECUTIVO

### ✅ Lo que funciona bien:
- Dashboard carga correctamente
- Jobs de ingesta funcionan (FRED, Eurostat, ECB)
- Base de datos limpia (correlations, pair_signals)
- Fuentes de datos migradas correctamente (sin TradingEconomics para Eurozona/USA)

### ❌ Lo que NO funciona:
- **Dashboard muestra TODOS los pares** en lugar de solo los 19 permitidos
- Posible causa: Tabla `macro_bias` tiene datos antiguos o hay listas hardcodeadas

### 🔧 Workarounds aplicados:
- Filtrado en múltiples capas (parcialmente efectivo)
- Job de limpieza manual ejecutado
- Endpoints de debug corregidos

### 📋 Próximos pasos críticos:
1. Investigar por qué `getBiasState().tableTactical` devuelve más pares de los esperados
2. Limpiar tabla `macro_bias` de pares no permitidos
3. Verificar que no hay listas hardcodeadas que no se están filtrando
4. Añadir logging para rastrear el origen de los pares extra

---

**Fin del resumen**


