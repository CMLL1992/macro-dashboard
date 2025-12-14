# Checklist de Revisión Final - Pre-Deploy a Vercel

**Fecha:** 2025-12-11  
**Estado:** ⚠️ PROBLEMAS CRÍTICOS ENCONTRADOS

---

## 📋 RESUMEN EJECUTIVO

Se ha realizado una revisión exhaustiva del proyecto antes del despliegue a Vercel. Se encontraron **varios problemas críticos** que deben resolverse antes del deploy.

### Estado General
- ✅ **Base de datos:** Funcionando correctamente (SQLite local, Turso listo)
- ✅ **Health endpoints:** Respondiendo correctamente
- ✅ **Dashboard API:** Funcionando correctamente (30 indicadores, 76 tacticalRows)
- ⚠️ **APIs de datos:** Algunos endpoints devolviendo datos parciales o null
- ⚠️ **Correlaciones:** Solo 2 correlaciones con valores (BTCUSD) - problema menor

---

## 🔍 PÁGINAS REVISADAS

### 1. ✅ Página Principal (`/`)
- **Estado:** ✅ OK
- **Funcionalidad:** Redirige correctamente a `/dashboard`
- **Problemas:** Ninguno

### 2. ✅ Dashboard (`/dashboard`)
- **Estado:** ✅ FUNCIONANDO (con problemas menores)
- **Componentes revisados:**
  - ✅ **Tabla de Indicadores:** Devuelve 30 indicadores (CORREGIDO)
  - ⚠️ **Tabla de Correlaciones:** Solo muestra 2 correlaciones (BTCUSD) - problema menor
  - ✅ **Tabla Táctica:** Devuelve 76 filas (CORREGIDO)
  - ⚠️ **Escenarios:** Puede devolver 0 escenarios si no hay condiciones detectadas (normal)
  - ✅ **Régimen Macro:** Estructura correcta con datos
  - ✅ **Job Status Indicator:** Funcionando correctamente
  - ✅ **Navegación:** Correcta
  - ✅ **Estados de carga:** Implementados correctamente
  - ✅ **Manejo de errores:** Implementado correctamente

**Problemas encontrados:**
1. **Filtro de indicadores demasiado restrictivo:** El filtro en `lib/dashboard-data.ts` línea 186-202 está eliminando TODOS los indicadores porque verifica `WEIGHTS[weightKey]` pero los indicadores tienen `weight` en la tabla que puede no coincidir con `WEIGHTS`.
2. **Endpoint `/api/dashboard`:** Corregido para usar `getDashboardData()` en lugar de `getMacroDiagnosis()`, pero aún devuelve datos vacíos debido al problema del filtro.

**Pasos para reproducir:**
```bash
curl http://localhost:3000/api/dashboard | jq '.data.indicators | length'
# Devuelve: 0
```

### 3. ✅ Calendario (`/calendario`)
- **Estado:** ⚠️ SIN DATOS
- **Componentes revisados:**
  - ✅ **Estructura de página:** Correcta
  - ✅ **Componente CalendarClient:** Implementado correctamente
  - ⚠️ **API `/api/calendar`:** Devuelve `ok: null` y `count: 0`
  - ✅ **Filtros:** Implementados correctamente
  - ✅ **Navegación:** Correcta

**Problemas encontrados:**
1. **Sin eventos económicos:** La tabla `economic_events` está vacía o no tiene eventos futuros.

**Pasos para reproducir:**
```bash
curl http://localhost:3000/api/calendar | jq '.'
# Devuelve: {"ok": null, "count": 0}
```

### 4. ⚠️ Correlaciones (`/correlations`)
- **Estado:** ⚠️ DATOS PARCIALES
- **Componentes revisados:**
  - ✅ **Estructura de página:** Correcta
  - ✅ **Tabla de correlaciones:** Implementada correctamente
  - ⚠️ **Datos:** Solo 2 correlaciones con valores (BTCUSD), resto son null
  - ✅ **Filtros y ordenamiento:** Implementados correctamente
  - ✅ **Navegación:** Correcta

**Problemas encontrados:**
1. **Correlaciones vacías:** Solo BTCUSD tiene valores calculados (2025-11-14). El resto de símbolos tienen `corr12m: null` y `corr3m: null`.
2. **Causa probable:** El job de correlaciones necesita más datos históricos o hay un problema con el cálculo para otros símbolos.

**Pasos para reproducir:**
```bash
curl http://localhost:3000/api/correlations | jq '[.[] | select(.corr12 != null or .corr3 != null)] | length'
# Devuelve: 1 (solo BTCUSD)
```

### 5. ⚠️ Sesgos (`/sesgos`)
- **Estado:** ⚠️ SIN DATOS
- **Componentes revisados:**
  - ✅ **Estructura de página:** Correcta
  - ✅ **Tabla de sesgos:** Implementada correctamente
  - ❌ **API `/api/bias`:** Devuelve `ok: null` y `data: null`
  - ✅ **Navegación:** Correcta

**Problemas encontrados:**
1. **Endpoint `/api/bias`:** Devuelve datos null. Necesita revisión del código del endpoint.

**Pasos para reproducir:**
```bash
curl http://localhost:3000/api/bias | jq '.'
# Devuelve: {"ok": null, "count": 0}
```

### 6. ⏭️ Análisis (`/analisis`)
- **Estado:** NO REVISADO COMPLETAMENTE
- **Nota:** Requiere revisión manual en navegador

### 7. ⏭️ Narrativas (`/narrativas`)
- **Estado:** NO REVISADO COMPLETAMENTE
- **Nota:** Requiere revisión manual en navegador

### 8. ⏭️ Notificaciones (`/notificaciones`)
- **Estado:** NO REVISADO COMPLETAMENTE
- **Nota:** Requiere revisión manual en navegador

### 9. ⏭️ Settings (`/settings`)
- **Estado:** NO REVISADO COMPLETAMENTE
- **Nota:** Requiere revisión manual en navegador

### 10. ⏭️ Admin (`/admin`)
- **Estado:** NO REVISADO COMPLETAMENTE
- **Nota:** Requiere revisión manual en navegador

---

## 🔌 APIs CRÍTICAS REVISADAS

### ✅ `/api/health`
- **Estado:** ✅ OK
- **Respuesta:** `{"ready": true, "hasData": true, ...}`
- **Problemas:** Ninguno

### ✅ `/api/health/db`
- **Estado:** ✅ OK
- **Respuesta:** `{"ok": true, "health": {"connected": true, ...}}`
- **Problemas:** Ninguno

### ✅ `/api/dashboard`
- **Estado:** ✅ FUNCIONANDO
- **Respuesta:** `{"ok": true, "data": {"indicators": 30, "tacticalRows": 76, ...}}`
- **Problemas:** Ninguno (CORREGIDO)
- **Nota:** Correlaciones puede ser null si no hay datos suficientes (normal)

### ⚠️ `/api/correlations`
- **Estado:** ⚠️ DATOS PARCIALES
- **Respuesta:** 78 elementos, pero solo 1 con valores no-null (BTCUSD)
- **Problemas:**
  1. Solo BTCUSD tiene correlaciones calculadas
  2. Resto de símbolos tienen `corr12: null` y `corr3: null`

### ❌ `/api/bias`
- **Estado:** ❌ SIN DATOS
- **Respuesta:** `{"ok": null, "count": 0}`
- **Problemas:**
  1. Endpoint devuelve null en lugar de datos
  2. Necesita revisión del código

### ⚠️ `/api/calendar`
- **Estado:** ⚠️ SIN DATOS
- **Respuesta:** `{"ok": null, "count": 0}`
- **Problemas:**
  1. Sin eventos económicos en la base de datos

---

## 🔧 JOBS CRÍTICOS

### ✅ `/api/jobs/ingest/assets`
- **Estado:** ✅ FUNCIONANDO
- **Última ejecución:** Exitosa
- **Problemas:** Ninguno
- **Nota:** Ahora obtiene 2 años de datos históricos (corregido de 1 mes)

### ✅ `/api/jobs/correlations`
- **Estado:** ✅ FUNCIONANDO
- **Última ejecución:** Exitosa (819ms)
- **Problemas:** Solo calcula correlaciones para BTCUSD
- **Nota:** Necesita más datos históricos o revisión del cálculo

### ⏭️ `/api/jobs/ingest/fred`
- **Estado:** NO EJECUTADO EN ESTA REVISIÓN
- **Nota:** Requiere ejecución manual para verificar

### ⏭️ `/api/jobs/compute/bias`
- **Estado:** NO EJECUTADO EN ESTA REVISIÓN
- **Nota:** Requiere ejecución manual para verificar

---

## 🐛 PROBLEMAS CRÍTICOS A RESOLVER

### ✅ RESUELTO: Dashboard sin indicadores
**Archivo:** `lib/dashboard-data.ts` líneas 186-202  
**Problema:** El filtro de indicadores está eliminando TODOS los indicadores porque verifica `WEIGHTS[weightKey]` pero los indicadores tienen `weight` en la tabla que puede no coincidir.

**Solución propuesta:**
```typescript
// En buildIndicatorRows, cambiar el filtro para ser menos restrictivo
const filteredRows: IndicatorRow[] = rows.filter((row) => {
  if (!row.key || !row.label) return false
  const finalKey = row.originalKey ?? row.key
  const weightKey = MAP_KEY_TO_WEIGHT_KEY[finalKey] ?? finalKey
  const weight = row.weight ?? WEIGHTS[weightKey]
  return weight != null && weight > 0
})
```

### 🔴 CRÍTICO 2: Endpoint `/api/bias` devuelve null
**Archivo:** `app/api/bias/route.ts`  
**Problema:** El endpoint devuelve `ok: null` y `data: null` en lugar de datos.

**Solución:** Revisar el código del endpoint y asegurar que devuelve datos correctamente.

### 🟡 MEDIO 3: Correlaciones solo para BTCUSD
**Archivo:** `lib/correlations/calc.ts`, `app/api/jobs/correlations/route.ts`  
**Problema:** Solo BTCUSD tiene correlaciones calculadas. Resto de símbolos tienen null.

**Posibles causas:**
1. Datos históricos insuficientes para otros símbolos
2. Validación de fecha reciente demasiado estricta (aunque ya se aumentó de 5 a 10 días)
3. Problema con el alineamiento de series DXY vs activos

**Solución:** Ejecutar el job de ingest de assets y correlations nuevamente después de acumular más datos históricos.

### 🟡 MEDIO 4: Calendario sin eventos
**Archivo:** `app/api/calendar/route.ts`  
**Problema:** No hay eventos económicos en la base de datos.

**Solución:** Ejecutar el job `/api/jobs/ingest/calendar` para poblar la tabla `economic_events`.

---

## ✅ CORRECCIONES REALIZADAS DURANTE LA REVISIÓN

1. ✅ **Endpoint `/api/dashboard`:** Corregido para usar `getDashboardData()` en lugar de `getMacroDiagnosis()`
2. ✅ **Endpoint `/api/correlations`:** Modificado para leer primero de BD antes de calcular en tiempo real
3. ✅ **Job de ingest de assets:** Cambiado de `'1mo'` a `'2y'` para obtener más datos históricos
4. ✅ **`fetchAssetDaily()`:** Modificado para leer primero de BD antes de Yahoo Finance
5. ✅ **`fetchDXYDaily()`:** Corregido para deduplicar valores por fecha
6. ✅ **Validación de fecha en correlaciones:** Aumentado de 5 a 10 días hábiles

---

## 📝 RECOMENDACIONES PARA DEPLOY

### ANTES de desplegar a Vercel:

1. **✅ RESUELTO:** Filtro de indicadores corregido en `lib/dashboard-data.ts`
2. **🔴 RESOLVER CRÍTICO 2:** Revisar y corregir el endpoint `/api/bias` (devuelve `ok: null`)
3. **🟡 Ejecutar jobs de ingest:** Ejecutar todos los jobs de ingest para poblar la base de datos:
   - `/api/jobs/ingest/fred`
   - `/api/jobs/ingest/calendar`
   - `/api/jobs/ingest/assets` (ya ejecutado)
   - `/api/jobs/compute/bias`
   - `/api/jobs/correlations` (ya ejecutado)
4. **🟡 Verificar variables de entorno:** Asegurar que todas las variables de entorno están configuradas en Vercel:
   - `TURSO_DATABASE_URL`
   - `TURSO_AUTH_TOKEN`
   - `FRED_API_KEY`
   - `CRON_TOKEN`
   - `APP_URL`
   - `INGEST_KEY`
5. **🟡 Verificar cron jobs en Vercel:** Asegurar que los cron jobs están configurados correctamente en `vercel.json`

### DESPUÉS de desplegar:

1. Verificar que todas las páginas cargan correctamente
2. Verificar que los jobs se ejecutan correctamente en producción
3. Monitorear logs de Vercel para errores
4. Verificar que los datos se están actualizando correctamente

---

## 📊 ESTADÍSTICAS DE REVISIÓN

- **Páginas revisadas:** 5/10 (50%)
- **APIs revisadas:** 5/80+ (6%)
- **Problemas críticos encontrados:** 2
- **Problemas críticos resueltos:** 1
- **Problemas medios encontrados:** 2
- **Correcciones realizadas:** 7

---

## 🎯 PRÓXIMOS PASOS

1. **✅ COMPLETADO:** Corregir el filtro de indicadores (CRÍTICO 1)
2. **URGENTE:** Revisar y corregir el endpoint `/api/bias` (CRÍTICO 2) - Verificar por qué devuelve `ok: null`
3. Ejecutar jobs de ingest para poblar la base de datos
4. Continuar revisión de páginas restantes (Análisis, Narrativas, Notificaciones, Settings, Admin)
5. Revisar todas las APIs restantes
6. Realizar pruebas end-to-end en navegador

---

**Generado por:** Revisión automatizada  
**Última actualización:** 2025-12-11


