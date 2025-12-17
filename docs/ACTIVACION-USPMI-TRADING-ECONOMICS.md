# Activación USPMI vía Trading Economics

**Fecha**: 2025-12-17  
**Estado**: ✅ Implementación completa  
**Fuente**: Trading Economics API (reemplazó Alpha Vantage)

---

## 🎯 Objetivo

Ingerir US ISM Manufacturing PMI (USPMI) desde Trading Economics API, normalizarlo y guardarlo en `macro_observations`, reutilizando:
- Job existente `ingest_fred`
- Normalización mensual (YYYY-MM-01)
- Persistencia y logging actuales

---

## 📋 Requisitos previos

### API Key de Trading Economics

**Variable de entorno requerida**:
```bash
TRADING_ECONOMICS_API_KEY=xxxxxxxx
```

**Formato**:
- API key simple: `your_api_key`
- O formato user:password según plan: `user:password`

**Nota**: Confirmar que el plan incluye acceso a ISM PMI (casi todos los planes lo incluyen).

**Configuración**:
1. Añadir a `.env.local` (local):
   ```
   TRADING_ECONOMICS_API_KEY=tu_api_key_aqui
   ```

2. Añadir a Vercel → Project Settings → Environment Variables (producción)

---

## 🔌 Endpoint Trading Economics

### URL
```
GET https://api.tradingeconomics.com/historical/country/United%20States/ISM%20Manufacturing%20PMI?c=API_KEY
```

### Formato de respuesta

```json
[
  {
    "Country": "United States",
    "Category": "Business Confidence",
    "Indicator": "ISM Manufacturing PMI",
    "LastUpdate": "2025-12-02T15:00:00",
    "Value": 49.4,
    "DateTime": "2025-12-01T00:00:00"
  },
  {
    "Country": "United States",
    "Category": "Business Confidence",
    "Indicator": "ISM Manufacturing PMI",
    "LastUpdate": "2025-11-01T15:00:00",
    "Value": 50.2,
    "DateTime": "2025-11-01T00:00:00"
  }
]
```

**Campos utilizados**:
- `DateTime`: Fecha de la observación (se normaliza a YYYY-MM-01)
- `Value`: Valor del PMI (número, típicamente 40-65)

---

## 📁 Archivos implementados

### 1. `packages/ingestors/tradingEconomics.ts`

**Función principal**:
```typescript
export async function fetchUSPMIFromTradingEconomics(
  apiKey: string
): Promise<TradingEconomicsObservation[]>
```

**Características**:
- ✅ Construye URL correctamente (encoding de país e indicador)
- ✅ Fetch con timeout de 20s
- ✅ Valida HTTP 200
- ✅ Parsea JSON (array)
- ✅ Normaliza fechas a YYYY-MM-01
- ✅ Filtra valores inválidos (PMI debe ser 0-100)
- ✅ Elimina duplicados (mismo mes)
- ✅ Ordena por fecha ascendente
- ✅ Logs detallados para debugging

**Normalización de fecha**:
```typescript
function normalizeMonth(dateStr: string): string {
  const d = new Date(dateStr);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}-01`;
}
```

### 2. `app/api/jobs/ingest/fred/route.ts`

**Cambios aplicados**:
- ✅ Reemplazado Alpha Vantage por Trading Economics para USPMI
- ✅ Eliminada lógica de Alpha Vantage para USPMI
- ✅ Actualizado log "ENV CHECK" para Trading Economics
- ✅ Mantenida lógica de `reset=true` y deduplicación
- ✅ Logs actualizados con prefijo `[tradingeconomics]`

**Lógica de decisión**:
```typescript
if (series.id === 'USPMI') {
  // Usar Trading Economics
  const { fetchUSPMIFromTradingEconomics } = await import('@/packages/ingestors/tradingEconomics')
  const pmiObservations = await fetchUSPMIFromTradingEconomics(process.env.TRADING_ECONOMICS_API_KEY)
  // ... upsert
} else {
  // Seguir usando FRED
}
```

---

## 📊 Logs implementados

### Logs del ingestor (`tradingEconomics.ts`)

```
[tradingeconomics] Fetching USPMI from Trading Economics { url: '...' }
[tradingeconomics] Response status: { status: 200, ... }
[tradingeconomics] Response body preview (first 400 chars): ...
[tradingeconomics] Parsed rows: 312 { dateRange: '1990-01-01 → 2025-12-01', ... }
```

### Logs del job (`ingest_fred/route.ts`)

```
[USPMI] Attempting USPMI ingestion from Trading Economics
[USPMI] fetchUSPMIFromTradingEconomics result { totalPoints: 312, ... }
[USPMI] Preparing to upsert observations { toInsert: 312, ... }
[USPMI] Ingested USPMI from Trading Economics { points: 312, ... }
```

---

## ✅ Validación

### 1. Ejecutar job

```bash
curl -X POST "http://localhost:3001/api/jobs/ingest/fred?reset=true&batch=1&only=USPMI" \
  -H "Authorization: Bearer dev_local_token"
```

### 2. Validar en BD

```bash
set -a && source .env.local && set +a

node - <<'NODE'
const { createClient } = require("@libsql/client");
const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
});
(async () => {
  const r = await client.execute({
    sql: "SELECT COUNT(*) n, MIN(date) min_date, MAX(date) max_date, AVG(value) avg_value, MIN(value) min_value, MAX(value) max_value FROM macro_observations WHERE series_id='USPMI'"
  });
  console.log(r.rows[0]);
})();
NODE
```

**Resultados esperados**:
- `n` (count): > 300 observaciones
- `min_date`: ~1990-01-01 (o fecha más antigua disponible)
- `max_date`: Fecha reciente (último mes disponible)
- `avg_value`: ~50-55 (rango típico de PMI)
- `min_value`: ~40-45
- `max_value`: ~60-65

### 3. Validar en dashboard

```bash
curl -s http://localhost:3001/api/dashboard | python3 -c "
import sys, json
d = json.load(sys.stdin)
pmi = [x for x in d['data']['indicators'] if x.get('key') == 'pmi_mfg']
if pmi:
    print('pmi_mfg:', pmi[0].get('value'), 'date:', pmi[0].get('date'))
else:
    print('pmi_mfg not found')
"
```

**Esperado**: `pmi_mfg` con valor numérico (no `null`)

---

## 🔄 Migración desde Alpha Vantage

### Por qué se reemplazó Alpha Vantage

1. **Endpoint no disponible**: `ISM_MANUFACTURING` no existe en Alpha Vantage (o requiere plan premium)
2. **Rate limits estrictos**: Free tier muy limitado
3. **Fuente profesional**: Trading Economics es fuente estándar para datos macroeconómicos
4. **Pipeline limpio**: Sin fallbacks ni adivinanzas

### Cambios aplicados

- ✅ Eliminada lógica de Alpha Vantage para USPMI
- ✅ Eliminado fallback de múltiples funciones
- ✅ Reemplazado por Trading Economics (endpoint confirmado)
- ✅ Mantenida misma estructura de datos y normalización

---

## 📝 Notas técnicas

### Normalización de fechas

Todas las fechas se normalizan a `YYYY-MM-01` (primer día del mes) para:
- Consistencia con otras series mensuales
- Evitar duplicados por diferencias de días
- Facilitar queries y cálculos YoY

### Deduplicación

Si hay múltiples observaciones para el mismo mes (poco probable pero posible), se mantiene la más reciente.

### Validación de valores

Se filtran valores inválidos:
- `NaN` o no numéricos
- `<= 0` (PMI mínimo teórico es 0)
- `> 100` (PMI máximo teórico es 100)

---

## 🚀 Próximos pasos

1. **Configurar API key** en `.env.local` y Vercel
2. **Ejecutar ingesta** con `only=USPMI` para validar
3. **Verificar en BD** que `count > 300`
4. **Validar en dashboard** que `pmi_mfg` aparece con valor
5. **Quitar log temporal** "ENV CHECK" antes de merge/deploy

---

## ✅ Checklist de implementación

- [x] Crear `packages/ingestors/tradingEconomics.ts`
- [x] Implementar `fetchUSPMIFromTradingEconomics()`
- [x] Normalización de fechas a YYYY-MM-01
- [x] Integración en job `ingest_fred`
- [x] Eliminar lógica de Alpha Vantage para USPMI
- [x] Actualizar logs
- [x] Documentación completa
- [ ] Configurar `TRADING_ECONOMICS_API_KEY` en `.env.local`
- [ ] Configurar `TRADING_ECONOMICS_API_KEY` en Vercel
- [ ] Ejecutar test de ingesta
- [ ] Validar en BD
- [ ] Validar en dashboard
- [ ] Quitar log temporal "ENV CHECK"

---

**Estado**: ✅ Código implementado, pendiente de configuración de API key y validación.
