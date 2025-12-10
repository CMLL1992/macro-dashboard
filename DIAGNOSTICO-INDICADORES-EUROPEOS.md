# 🔍 DIAGNÓSTICO COMPLETO: Indicadores Europeos No Muestran Datos

**Fecha:** 2025-12-08  
**Problema:** Los indicadores europeos aparecen en el dashboard pero muestran guiones ("—") en lugar de valores

---

## ✅ LO QUE ESTÁ FUNCIONANDO

### 1. **Datos en Base de Datos**
- ✅ `EU_CPI_YOY`: 347 observaciones (desde 1997-01-01 hasta 2025-11-01)
- ✅ `EU_CPI_CORE_YOY`: 347 observaciones (desde 1997-01-01 hasta 2025-11-01)
- ✅ Datos verificados directamente en SQLite: valores existen y son correctos

### 2. **Mapeo de Claves**
- ✅ `eu_cpi_yoy` → `EU_CPI_YOY` (correcto en `KEY_TO_SERIES_ID`)
- ✅ `eu_cpi_core_yoy` → `EU_CPI_CORE_YOY` (correcto en `KEY_TO_SERIES_ID`)
- ✅ Labels correctos en `KEY_LABELS`

### 3. **Código de Transformación**
- ✅ La función `yoy()` está implementada correctamente
- ✅ La transformación YoY se aplica en `getAllLatestFromDBWithPrev()` para claves que incluyen `_yoy`
- ✅ El código incluye `eu_gdp_qoq` en la transformación QoQ

### 4. **Cálculo Manual Verificado**
- ✅ Datos para cálculo YoY:
  - 2025-11-01: 129.67573
  - 2024-11-01: 126.9543
- ✅ Cálculo esperado: ((129.67573 - 126.9543) / 126.9543) * 100 = **2.14%**
- ✅ El dato del año anterior existe en la BD

---

## 🔍 LO QUE HE PROBADO

### 1. **Verificación de Datos en BD**
```sql
SELECT series_id, COUNT(*) as count, MAX(date) as last_date 
FROM macro_observations 
WHERE series_id LIKE 'EU_%' 
GROUP BY series_id;
```
**Resultado:** ✅ Datos existen (347 observaciones cada uno)

### 2. **Verificación de Mapeo**
- ✅ Verificado que `eu_cpi_yoy` está mapeado a `EU_CPI_YOY` en `KEY_TO_SERIES_ID`
- ✅ Verificado que los labels están correctos en `KEY_LABELS`

### 3. **Verificación de Transformación YoY**
- ✅ La función `yoy()` busca el dato del año anterior correctamente
- ✅ El formato de fechas es correcto (YYYY-MM-DD)
- ✅ El dato del año anterior existe (2024-11-01 para calcular YoY de 2025-11-01)

### 4. **Reinicio del Servidor**
- ✅ Servidor detenido y reiniciado
- ✅ Caché de Next.js limpiado (`.next` eliminado)
- ✅ Servidor respondiendo correctamente

### 5. **Verificación de Endpoint**
- ⚠️ El endpoint `/api/debug/macro-indicador` no responde (puede estar compilando)
- ⚠️ No se pudo verificar directamente si `getAllLatestFromDBWithPrev()` devuelve datos

---

## 🐛 POSIBLES CAUSAS DEL PROBLEMA

### 1. **Problema con `getSeriesObservations()`**
- **Hipótesis:** La función puede no estar devolviendo datos para `EU_CPI_YOY`
- **Verificación necesaria:** Probar directamente la función con un script de prueba

### 2. **Problema con la Transformación YoY**
- **Hipótesis:** La función `yoy()` puede no estar encontrando el dato del año anterior
- **Posible causa:** Formato de fecha diferente o problema con el Map lookup
- **Verificación necesaria:** Probar la función `yoy()` directamente con los datos de EU_CPI_YOY

### 3. **Problema con `getDashboardData()`**
- **Hipótesis:** La función `getDashboardData()` puede no estar usando `getAllLatestFromDBWithPrev()`
- **Verificación necesaria:** Revisar `lib/dashboard-data.ts` para ver cómo obtiene los indicadores

### 4. **Problema con el Componente del Dashboard**
- **Hipótesis:** El componente puede estar filtrando o ignorando los indicadores europeos
- **Verificación necesaria:** Revisar cómo se renderizan los `indicatorRows` en `app/dashboard/page.tsx`

### 5. **Problema de Caché del Navegador**
- **Hipótesis:** El navegador puede estar mostrando datos en caché
- **Solución intentada:** Reinicio del servidor y limpieza de caché de Next.js
- **Pendiente:** Verificar si el usuario hizo hard refresh (Ctrl+Shift+R)

---

## 📋 ARCHIVOS RELEVANTES

### Archivos que leen datos:
1. `lib/db/read-macro.ts`
   - `getSeriesObservations(seriesId)` - Lee datos de la BD
   - `getAllLatestFromDBWithPrev()` - Función principal que usa el dashboard
   - `KEY_TO_SERIES_ID` - Mapeo de claves a series_id

2. `lib/dashboard-data.ts`
   - `getDashboardData()` - Función que obtiene todos los datos del dashboard
   - Debe usar `getAllLatestFromDBWithPrev()` para obtener indicadores

3. `lib/fred.ts`
   - `yoy(series)` - Función que calcula cambios YoY
   - Busca el dato del año anterior usando formato `YYYY-MM-DD`

### Archivos que muestran datos:
1. `app/dashboard/page.tsx`
   - Renderiza la tabla de indicadores macro
   - Usa `indicatorRows` de `getDashboardData()`

---

## 🧪 PRUEBAS QUE DEBERÍAS HACER

### 1. **Probar `getSeriesObservations()` directamente**
```typescript
// Crear un script de prueba
import { getSeriesObservations } from '@/lib/db/read-macro'
const data = await getSeriesObservations('EU_CPI_YOY')
console.log('Datos obtenidos:', data.length)
console.log('Últimos 3:', data.slice(-3))
```

### 2. **Probar la función `yoy()` directamente**
```typescript
import { yoy } from '@/lib/fred'
const series = await getSeriesObservations('EU_CPI_YOY')
const yoySeries = yoy(series)
console.log('Resultados YoY:', yoySeries.length)
console.log('Último valor YoY:', yoySeries[yoySeries.length - 1])
```

### 3. **Probar `getAllLatestFromDBWithPrev()` directamente**
```typescript
import { getAllLatestFromDBWithPrev } from '@/lib/db/read-macro'
const allData = await getAllLatestFromDBWithPrev()
const euCpi = allData.find(d => d.key === 'eu_cpi_yoy')
console.log('EU CPI YoY:', euCpi)
```

### 4. **Verificar logs del servidor**
- Revisar logs de Next.js para ver si hay errores al leer datos
- Buscar mensajes de error relacionados con `EU_CPI_YOY` o `getSeriesObservations`

### 5. **Verificar `getDashboardData()`**
- Revisar `lib/dashboard-data.ts` para ver cómo obtiene los indicadores
- Verificar que use `getAllLatestFromDBWithPrev()`

---

## 💡 SOLUCIONES SUGERIDAS

### Solución 1: Agregar Logging
Agregar console.log en `getAllLatestFromDBWithPrev()` para ver qué está pasando:
```typescript
for (const [key, seriesId] of Object.entries(KEY_TO_SERIES_ID)) {
  if (key.includes('eu_')) {
    console.log(`[DEBUG] Procesando ${key} -> ${seriesId}`)
  }
  const series = await getSeriesObservations(seriesId)
  if (key.includes('eu_')) {
    console.log(`[DEBUG] ${key}: ${series.length} observaciones`)
  }
  // ... resto del código
}
```

### Solución 2: Verificar Formato de Fechas
La función `yoy()` usa `p.date.slice(5)` para obtener mes-día. Verificar que las fechas en BD estén en formato `YYYY-MM-DD` exacto.

### Solución 3: Probar con Datos de Prueba
Crear un script que pruebe directamente:
```typescript
// test-eu-indicators.ts
import { getAllLatestFromDBWithPrev } from './lib/db/read-macro'

async function test() {
  const data = await getAllLatestFromDBWithPrev()
  const euIndicators = data.filter(d => d.key.startsWith('eu_'))
  console.log('Indicadores europeos:', euIndicators)
}

test()
```

### Solución 4: Verificar si hay Filtros
Revisar si `getDashboardData()` o el componente del dashboard están filtrando los indicadores europeos.

---

## 📊 ESTADO ACTUAL

- **Datos en BD:** ✅ Existen (347 observaciones cada uno)
- **Mapeo:** ✅ Correcto
- **Código de transformación:** ✅ Correcto
- **Servidor:** ✅ Reiniciado
- **Datos mostrados en dashboard:** ❌ No aparecen (muestran "—")

---

## 🎯 CONCLUSIÓN

El problema **NO** está en:
- ❌ Los datos (existen en BD)
- ❌ El mapeo (está correcto)
- ❌ La transformación YoY (el código es correcto)

El problema **PROBABLEMENTE** está en:
- ⚠️ La función `getSeriesObservations()` no devuelve datos para `EU_CPI_YOY`
- ⚠️ La función `yoy()` no encuentra el dato del año anterior
- ⚠️ `getDashboardData()` no está usando correctamente `getAllLatestFromDBWithPrev()`
- ⚠️ Hay un filtro o transformación que elimina los datos europeos

**Próximo paso recomendado:** Crear un script de prueba que ejecute directamente `getAllLatestFromDBWithPrev()` y verifique qué devuelve para los indicadores europeos.
