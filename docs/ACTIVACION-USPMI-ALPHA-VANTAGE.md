# Activación USPMI (PMI Manufacturing) vía Alpha Vantage

**Estado**: ✅ Código implementado, pendiente de validación cuando el servidor funcione  
**Fecha**: 2025-12-17

---

## ⚠️ Seguridad (ACCIÓN REQUERIDA)

**La API key de Alpha Vantage se ha expuesto en logs/chat. DEBE rotarse inmediatamente:**

1. **Generar nueva API key en Alpha Vantage:**
   - Ir a https://www.alphavantage.co/support/#api-key
   - Generar nueva key
   - Revocar la key antigua (`7EP1MPAF47D1B8QW`)

2. **Actualizar en todos los lugares:**
   - `.env.local` (local)
   - Vercel → Project Settings → Environment Variables (producción)

---

## ✅ Implementación completada

### 1. Normalización de fechas PMI
- **Archivo**: `packages/ingestors/alphavantage.ts`
- **Cambio**: Todas las fechas se normalizan a `YYYY-MM-01` para series mensuales
- **Efecto**: Evita conflictos de claves duplicadas en BD

### 2. Integración USPMI en job FRED
- **Archivo**: `app/api/jobs/ingest/fred/route.ts`
- **Cambios**:
  - USPMI se procesa dentro del loop principal (no solo al final)
  - Soporte para `only=USPMI` (debug mode)
  - Con `reset=true`, borra observaciones existentes antes de insertar
  - Logs de diagnóstico añadidos

### 3. Logs de debugging (seguros)
- **Log temporal "ENV CHECK"** en el job (verifica que el servidor ve la API key)
- **Logs en Alpha Vantage helper**:
  - URL final (con API key enmascarada como `***`)
  - Status, content-type
  - Primeros 400 chars del body
  - Keys del objeto JSON
  - Detección de errores comunes (rate limit, error messages)

### 4. Mapeo verificado
- `lib/db/read-macro.ts`: `pmi_mfg: 'USPMI'` ✅

---

## 🔧 Pasos para activar (cuando el servidor funcione)

### Paso 1: Configurar API key (con nueva key rotada)

```bash
cd ~/Desktop/"macro-dashboard-with-data 2"
nano .env.local
```

Añadir/actualizar:
```
ALPHA_VANTAGE_API_KEY=TU_NUEVA_KEY_AQUI
```

Guardar: `Ctrl+O`, `Enter`, `Ctrl+X`

Verificar:
```bash
grep -n "ALPHA_VANTAGE_API_KEY" .env.local
```

### Paso 2: Reiniciar servidor (obligatorio)

```bash
# Matar proceso existente
lsof -nP -iTCP:3001 -sTCP:LISTEN
kill -9 <PID>

# Arrancar limpio
cd ~/Desktop/"macro-dashboard-with-data 2"
./node_modules/.bin/next dev -p 3001
```

### Paso 3: Verificar que el servidor ve la key

En la consola del servidor, buscar:
```
ENV CHECK { hasAlphaVantageKey: true, alphaVantageKeyPrefix: "XXXX" }
```

**NUNCA debe aparecer la key completa en logs.**

### Paso 4: Probar Alpha Vantage directo (diagnóstico)

```bash
# Cargar env vars
set -a && source .env.local && set +a

# Probar endpoint directo
curl -s "https://www.alphavantage.co/query?function=ISM_MANUFACTURING&apikey=$ALPHA_VANTAGE_API_KEY" | head -c 400
```

**Esperado:**
- Si devuelve JSON con datos → endpoint correcto
- Si devuelve `"Note": "Thank you for using Alpha Vantage..."` → rate limit
- Si devuelve `"Error Message": "..."` → función incorrecta o key inválida

### Paso 5: Ejecutar ingesta aislada de USPMI

```bash
curl -X POST "http://localhost:3001/api/jobs/ingest/fred?reset=true&batch=1&only=USPMI" \
  -H "Authorization: Bearer dev_local_token"
```

**En logs del servidor, buscar:**
- `[alphavantage] Fetching PMI from Alpha Vantage` → función usada, URL (con key enmascarada)
- `[alphavantage] Response status` → status, content-type
- `[alphavantage] Response body preview` → primeros 400 chars
- `[alphavantage] Response keys` → estructura del JSON

**Si aparece "No observations returned from Alpha Vantage":**
1. Verificar que el JSON tiene la estructura esperada (keys del log)
2. Verificar que no hay rate limit (`Note` en el body)
3. Verificar que el parser busca en los campos correctos

### Paso 6: Validar en BD (Turso)

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
    sql: "SELECT COUNT(*) n, MIN(date) min_date, MAX(date) max_date FROM macro_observations WHERE series_id='USPMI'"
  });
  console.log(r.rows[0]);
})();
NODE
```

**Esperado:**
- `n`: grande (decenas/centenas)
- `min_date`: antigua (ideal ~2010-01-01)
- `max_date`: reciente

### Paso 7: Validar en dashboard

```bash
curl -s http://localhost:3001/api/dashboard | node -e '
const d=JSON.parse(require("fs").readFileSync(0,"utf8"));
const p=(d.data.indicators||[]).find(x=>x.key==="pmi_mfg");
console.log("pmi_mfg:", p?.value, "date:", p?.date);
'
```

**Esperado:**
- `pmi_mfg.value`: número (típicamente 48-55 para PMI)
- `pmi_mfg.date`: fecha reciente
- **NO debe ser `null`**

---

## 📋 Endpoint Alpha Vantage usado

**Función**: `ISM_MANUFACTURING`  
**URL base**: `https://www.alphavantage.co/query`  
**Parámetros**:
- `function=ISM_MANUFACTURING`
- `interval=monthly` (opcional, pero se incluye)
- `apikey=TU_API_KEY`

**Formato de respuesta esperado:**
- `data[]` (array de objetos con `date`, `value`/`PMI`)
- O `Monthly Time Series` (objeto con fechas como keys)

**Normalización:**
- Todas las fechas se normalizan a `YYYY-MM-01` (primer día del mes)
- Esto asegura consistencia con otras series mensuales

---

## 🔍 Troubleshooting

### "ALPHA_VANTAGE_API_KEY not configured"
- Verificar que existe en `.env.local`
- Reiniciar servidor (env vars solo se cargan al arrancar)

### "No observations returned from Alpha Vantage"
1. Ver logs de `[alphavantage] Response body preview` para ver estructura real
2. Verificar que no hay rate limit (`Note` en respuesta)
3. Verificar que el parser busca en los campos correctos según la estructura real

### Rate limit de Alpha Vantage
- Alpha Vantage free tier tiene límites estrictos
- Si aparece `"Note": "Thank you for using Alpha Vantage..."` → rate limit
- **Solución**: Esperar 15-60 segundos y reintentar, o usar plan premium

### Fechas no normalizadas
- Verificar que `parseAlphaVantageResponse()` normaliza a `YYYY-MM-01`
- Verificar que el parser de "Monthly Time Series" también normaliza

---

## 🧹 Limpieza final (cuando funcione)

1. **Quitar log temporal "ENV CHECK"** de `app/api/jobs/ingest/fred/route.ts`
2. **Reducir verbosidad de logs** en `packages/ingestors/alphavantage.ts` (dejar solo errores críticos)
3. **Asegurar que NUNCA se imprime la API key completa** en logs

---

## 📌 Nota sobre Vercel

Para producción, añadir `ALPHA_VANTAGE_API_KEY` en:
- Vercel → Project → Settings → Environment Variables
- Redeploy después de añadir la variable

---

**Estado actual**: Código listo, pendiente de validación cuando el servidor funcione correctamente.
