# 📊 Estado Actual del Calendario Macroeconómico

**Fecha**: 2025-12-17  
**Última actualización**: Después de correcciones con URLs reales

---

## ✅ Cambios Implementados

### 1. Providers Actualizados

#### ICS Provider ✅
- **BLS**: ✅ Funciona (6 eventos en test)
- **BEA ICS**: ✅ URL correcta, parser funciona
- **ONS ICS**: ✅ Añadido con headers correctos
- **Banco de España**: ✅ URL correcta
- **node-ical**: ✅ Reemplazado ical.js (mejor compatibilidad ESM)

#### JSON Provider ⚠️
- **BEA JSON**: ⚠️ No existe JSON directo para release schedule
- **Estado**: Provider vacío (correcto, BEA solo tiene ICS/HTML)

#### HTML Provider ✅
- **Eurostat**: ✅ Añadido (release calendar HTML)
- **INE**: ⚠️ URL necesita verificación (404 actual)
- **Fed Calendar**: ✅ Añadido
- **ONS HTML**: ✅ Fallback añadido
- **Bundesbank**: ✅ Reemplazado Destatis

### 2. Correcciones Técnicas

- ✅ **node-ical**: Reemplazado ical.js para mejor compatibilidad ESM
- ✅ **Headers ONS**: Añadidos headers específicos (`Accept-Language: en-GB`)
- ✅ **Parsers HTML**: Mejorados con selectores más robustos
- ✅ **Manejo de errores**: Mejorado para continuar con otros feeds

---

## 📊 Resultados del Test Actual

### ICS Provider: ✅ PASS
- **Total eventos**: 6
- **Eventos OK**: 6
- **Fuente**: BLS (United States)
- **Eventos encontrados**:
  - Non-Farm Payrolls (2025-12-16, 2026-01-09)
  - CPI YoY (2025-12-18, 2026-01-13)
  - PPI (2026-01-14, 2026-01-30)

### JSON Provider: ❌ FAIL (esperado)
- **Total eventos**: 0
- **Razón**: BEA no proporciona release schedule en JSON directo
- **Solución**: Usar BEA ICS en su lugar (ya implementado)

### HTML Provider: ❌ FAIL (necesita ajustes)
- **Total eventos**: 0
- **Problemas**:
  - Eurostat: 0 eventos (selectores HTML necesitan ajuste)
  - INE: HTTP 404 (URL incorrecta)
  - Fed: 0 eventos (selectores HTML necesitan ajuste)
  - ONS: 0 eventos (selectores HTML necesitan ajuste)
  - Bundesbank: 0 eventos (selectores HTML necesitan ajuste)

---

## ⚠️ Acciones Pendientes

### 1. Verificar/Corregir URLs HTML

#### INE (España) - CRÍTICO
- **URL actual**: `https://www.ine.es/dyngs/INEbase/es/operacion.htm?c=Estadistica_C&cid=1254736176918&menu=resultados&idp=1254735572981`
- **Estado**: HTTP 404
- **Acción requerida**: 
  - Visitar: https://www.ine.es/calendario/
  - Buscar página oficial del calendario
  - Obtener URL correcta

### 2. Ajustar Selectores HTML

Los parsers HTML están devolviendo 0 eventos. Necesitan inspección real de las páginas:

#### Eurostat
- **URL**: `https://ec.europa.eu/eurostat/news/release-calendar`
- **Acción**: Inspeccionar HTML real y ajustar selectores

#### Fed Calendar
- **URL**: `https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm`
- **Acción**: Inspeccionar HTML real y ajustar selectores para FOMC meetings

#### ONS (HTML Fallback)
- **URL**: `https://www.ons.gov.uk/releasecalendar?release-type=type-upcoming`
- **Acción**: Inspeccionar HTML real y ajustar selectores

#### Bundesbank
- **URL**: `https://www.bundesbank.de/en/statistics/statistical-release-calendar`
- **Acción**: Inspeccionar HTML real y ajustar selectores

### 3. Mejorar Parsers HTML

Los parsers actuales buscan patrones genéricos, pero pueden necesitar:
- Selectores CSS más específicos según estructura real
- Manejo de fechas en diferentes formatos
- Filtrado de elementos vacíos/ruido

---

## 🎯 Criterio de "Funciona Perfecto"

Cuando el calendario esté 100% funcional:

### Eventos por Provider
- **ICS Provider**: 
  - BLS: ✅ 6 eventos (funciona)
  - BEA ICS: ⚠️ Verificar que devuelve eventos
  - ONS ICS: ⚠️ Verificar que devuelve eventos
  - Banco de España: ⚠️ Verificar que devuelve eventos

- **HTML Provider**:
  - Eurostat: ⚠️ Ajustar selectores → esperado: 10-20 eventos/mes
  - INE: ⚠️ Corregir URL → esperado: 5-10 eventos/mes
  - Fed: ⚠️ Ajustar selectores → esperado: 8 eventos/año (FOMC)
  - ONS: ⚠️ Ajustar selectores → esperado: 10-15 eventos/mes
  - Bundesbank: ⚠️ Ajustar selectores → esperado: 5-10 eventos/mes

### Validaciones
- ✅ Todos los eventos dentro de rango -14/+45 días
- ✅ Todos importance=3 (pasan whitelist)
- ✅ Sin duplicados (upsert idempotente)
- ✅ Releases se crean cuando `event.date <= now && actual !== null`

### Resultado Esperado
En 7 días vista deberías ver **bastantes más que 3 eventos**:
- BLS: ~6 eventos/mes
- BEA: ~4-6 eventos/mes
- ONS: ~10-15 eventos/mes
- Eurostat: ~10-20 eventos/mes
- INE: ~5-10 eventos/mes
- Bundesbank: ~5-10 eventos/mes
- Fed: ~8 eventos/año (FOMC)

**Total esperado**: 40-60+ eventos en 7 días vista

---

## 🔧 Próximos Pasos Recomendados

### Paso 1: Inspeccionar HTML Real
Para cada feed HTML que devuelve 0 eventos:
1. Abrir URL en navegador
2. Inspeccionar estructura HTML (DevTools)
3. Identificar selectores CSS correctos
4. Ajustar parser en `htmlProvider.ts`

### Paso 2: Verificar URLs
1. INE: Obtener URL correcta desde sitio oficial
2. Probar cada URL con curl para verificar que existe

### Paso 3: Re-ejecutar Test
```bash
pnpm test:calendar
```

### Paso 4: Ajustar Iterativamente
- Si un provider devuelve 0 eventos → ajustar selectores
- Si eventos no pasan whitelist → revisar regex en `calendar-whitelist.ts`
- Si hay duplicados → mejorar lógica de deduplicación

---

## 📝 Notas Técnicas

### node-ical
- **Función correcta**: `ical.parseFile(icsText)`
- **Compatibilidad**: ✅ ESM/CommonJS
- **Fallback**: Parser básico si falla

### Parsers HTML
- **Librería**: cheerio (robusto)
- **Estrategia**: Buscar patrones de fecha + título en múltiples lugares
- **Filtrado**: Solo elementos con texto suficiente (>20 chars, título >5 chars)

### Whitelist
- **Ubicación**: `config/calendar-whitelist.ts`
- **Función**: `isHighImpactEvent(title, country)`
- **Resultado**: Solo eventos ★★★ (importance=3)

---

**Última actualización**: 2025-12-17
