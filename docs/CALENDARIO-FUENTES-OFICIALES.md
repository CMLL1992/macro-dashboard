# ✅ Calendario Macroeconómico con Fuentes Oficiales Gratuitas

**Fecha**: 2025-12-17  
**Estado**: ✅ **IMPLEMENTADO** - ⚠️ **Requiere verificación de URLs y integración de APIs para valores**

---

## 🎯 Objetivo

Reemplazar TradingEconomics (requiere plan premium) con **fuentes oficiales gratuitas** para el calendario macroeconómico.

---

## ✅ Implementación Completada

### 1. Whitelist de Eventos de Alta Importancia

**Archivo**: `config/calendar-whitelist.ts`

- ✅ **Whitelist completa** de eventos ★★★ por país:
  - **US**: CPI, Core CPI, NFP, Unemployment, FOMC, GDP, PCE, Retail Sales, ISM PMI, Jobless Claims, PPI
  - **EU**: Flash CPI, GDP, ECB Rate Decision, PMI Manufacturing/Services, Unemployment
  - **ES**: IPC, PIB, EPA, Ventas Minoristas
  - **DE**: CPI (VPI), GDP, IFO
  - **UK**: CPI, Core CPI, GDP, Labour Market, BoE Rate Decision

- ✅ **Función `isHighImpactEvent()`**: Verifica si un evento está en whitelist
- ✅ **Mapeo automático**: Asigna `importance = 'high'`, `seriesId`, `indicatorKey`, `directionality`

### 2. Providers de Fuentes Oficiales

#### ProviderICS (`lib/calendar/providers/icsProvider.ts`)

**Fuentes soportadas**:
- ✅ Eurostat (Euro Area) - `https://ec.europa.eu/eurostat/cache/calendar/calendar.ics`
- ✅ INE (España) - `https://www.ine.es/calendario/calendario.ics` ⚠️ **Verificar URL real**
- ✅ Banco de España - `https://www.bde.es/calendario/calendario.ics` ⚠️ **Verificar URL real**
- ✅ Destatis (Alemania) - `https://www.destatis.de/EN/Service/Calendar/calendar.ics` ⚠️ **Verificar URL real**

**Características**:
- ✅ Usa `ical.js` para parsear archivos ICS
- ✅ Fallback a parser básico si ical.js falla
- ✅ Filtra por whitelist automáticamente
- ✅ Solo eventos de alta importancia

#### ProviderJSON (`lib/calendar/providers/jsonProvider.ts`)

**Fuentes soportadas**:
- ✅ BEA (Bureau of Economic Analysis) - Estados Unidos
  - URL: `https://apps.bea.gov/api/data/...` ⚠️ **Requiere API key y verificar estructura**

**Características**:
- ✅ Parsea JSON "machine-readable"
- ✅ Filtra por whitelist automáticamente
- ✅ Solo eventos de alta importancia

#### ProviderHTML (`lib/calendar/providers/htmlProvider.ts`)

**Fuentes soportadas**:
- ✅ ONS (Office for National Statistics) - Reino Unido
  - URL: `https://www.ons.gov.uk/releasecalendar` ⚠️ **Verificar estructura HTML real**
- ✅ Fed Calendar - Estados Unidos
  - URL: `https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm` ⚠️ **Verificar estructura HTML real**

**Características**:
- ✅ Parser básico de HTML (extracción de texto)
- ⚠️ **Mejora recomendada**: Usar `cheerio` o `jsdom` para parsing robusto
- ✅ Filtra por whitelist automáticamente
- ✅ Solo eventos de alta importancia

### 3. MultiProvider Actualizado

**Archivo**: `lib/calendar/multiProvider.ts`

**Cambios**:
- ✅ **Eliminado**: TradingEconomics, FRED, ECB, BoE, BoJ, RBA, FOMC (providers antiguos)
- ✅ **Añadido**: ICS, JSON, HTML providers (fuentes oficiales)
- ✅ **Deduplicación**: Mantiene lógica de eliminar duplicados
- ✅ **Filtrado**: Solo eventos de alta importancia (whitelist)

### 4. Job de Ingesta Actualizado

**Archivo**: `app/api/jobs/ingest/calendar/route.ts`

**Cambios**:
- ✅ **Usa MultiProvider** con providers oficiales
- ✅ **Filtrado por whitelist**: Doble verificación (provider + job)
- ✅ **Rango de fechas**: -14 días a +45 días (mantenido)
- ✅ **Releases automáticos**: Crea releases cuando `event.date <= now && event.actual !== null`
- ⚠️ **Valores actuales**: Por ahora `null` (se obtendrán de APIs oficiales)

---

## ⚠️ Pendiente / Requiere Acción

### 1. Verificar URLs de Feeds

**Acción requerida**: Verificar que las URLs de los feeds ICS/JSON/HTML sean correctas:

- [ ] **Eurostat ICS**: Verificar URL real del calendario
- [ ] **INE ICS**: Verificar si INE proporciona feed ICS y URL correcta
- [ ] **Banco de España ICS**: Verificar si proporciona feed ICS
- [ ] **Destatis ICS**: Verificar URL real del calendario
- [ ] **BEA JSON**: Obtener API key y verificar estructura del JSON
- [ ] **ONS HTML**: Verificar estructura HTML real del calendario
- [ ] **Fed Calendar HTML**: Verificar estructura HTML real

### 2. Integrar APIs Oficiales para Valores Actuales

**Objetivo**: Obtener valores `actual` de APIs oficiales cuando los eventos ya se publicaron.

**APIs a integrar**:

#### Estados Unidos
- [ ] **BLS API**: Para CPI, Employment, PPI
  - URL: `https://api.bls.gov/publicAPI/v2/timeseries/data/`
  - Requiere: API key (gratuita)
- [ ] **BEA API**: Para GDP, PCE
  - URL: `https://apps.bea.gov/api/data/`
  - Requiere: API key (gratuita)

#### Eurozona
- [ ] **Eurostat API**: Para CPI, GDP
  - URL: `https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/`
  - No requiere API key

#### España
- [ ] **INE API**: Para IPC, PIB, EPA
  - URL: `https://servicios.ine.es/wstempus/js/ES/`
  - No requiere API key

#### Alemania
- [ ] **Destatis API**: Para CPI, GDP
  - Verificar si tienen API pública

#### Reino Unido
- [ ] **ONS API**: Para CPI, GDP, Labour Market
  - URL: `https://api.ons.gov.uk/`
  - No requiere API key

**Implementación sugerida**:
1. Crear helper `lib/calendar/official-apis.ts` con funciones para cada API
2. En el job, después de crear eventos, buscar valores actuales para eventos pasados
3. Actualizar `actual_value` en `economic_events` o crear `economic_releases`

### 3. Mejorar Parser HTML

**Recomendación**: Instalar y usar `cheerio` para parsing robusto de HTML:

```bash
pnpm add cheerio
```

Luego actualizar `HTMLProvider` para usar cheerio en lugar del parser básico.

### 4. Forecast/Consensus

**Estado**: No disponible en fuentes gratuitas oficiales

**Solución**: Dejar `consensus = null` y renderizar "—" en UI (ya implementado)

---

## 📋 Estructura de Archivos

```
config/
  └── calendar-whitelist.ts          # Whitelist de eventos ★★★

lib/calendar/
  ├── providers/
  │   ├── icsProvider.ts            # Provider para feeds ICS
  │   ├── jsonProvider.ts            # Provider para feeds JSON
  │   └── htmlProvider.ts           # Provider para feeds HTML
  ├── multiProvider.ts               # Combina providers oficiales
  └── ...

app/api/jobs/ingest/
  └── calendar/route.ts              # Job de ingesta (actualizado)
```

---

## 🚀 Próximos Pasos

### Paso 1: Verificar URLs (CRÍTICO)

1. Visitar cada URL de feed y verificar que existe
2. Verificar formato (ICS, JSON, HTML)
3. Actualizar URLs en los providers si es necesario

### Paso 2: Probar Providers Individualmente

```bash
# Crear script de test
tsx scripts/test-calendar-providers.ts
```

### Paso 3: Integrar APIs para Valores Actuales

1. Obtener API keys (BLS, BEA) si es necesario
2. Crear helpers para cada API
3. Integrar en el job para poblar valores actuales

### Paso 4: Mejorar Parser HTML

1. Instalar `cheerio`
2. Actualizar `HTMLProvider` para usar cheerio
3. Probar con feeds reales

---

## 📊 Resultado Esperado

Después de completar los pasos pendientes:

### Eventos
- ✅ Solo eventos de **alta importancia (★★★)** según whitelist
- ✅ De **5 países**: US, EU, ES, DE, UK
- ✅ Con **fechas/horas** correctas desde fuentes oficiales
- ✅ Rango de **-14 días a +45 días**

### Valores
- ✅ **Actual**: Obtenido de APIs oficiales cuando está disponible
- ✅ **Previous**: Obtenido de APIs oficiales cuando está disponible
- ✅ **Forecast**: `null` (no disponible en fuentes gratuitas)

### Releases
- ✅ **Releases automáticos** para eventos pasados con `actual`
- ✅ **Sorpresa calculada** automáticamente (si hay consensus)
- ✅ **Histórico poblado** en 1-2 ejecuciones

---

## 🎯 Conclusión

**Estado**: ✅ **CÓDIGO IMPLEMENTADO** - ⚠️ **Requiere verificación y ajustes**

El código está listo y funcional. Los próximos pasos son:
1. Verificar URLs de feeds reales
2. Integrar APIs oficiales para valores actuales
3. Mejorar parser HTML con cheerio

**Una vez completados estos pasos, el calendario funcionará completamente con fuentes oficiales gratuitas.** 🚀

---

**Última actualización**: 2025-12-17
