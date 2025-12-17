# Instrucciones para Test USPMI

**Fecha**: 2025-12-17  
**Objetivo**: Validar si Alpha Vantage funciona o si debemos migrar a FRED

---

## 🎯 Pasos para ejecutar

### Terminal 1: Servidor (debe estar visible para ver logs)

```bash
cd ~/Desktop/"macro-dashboard-with-data 2"
./node_modules/.bin/next dev -p 3001
```

**Mantén esta terminal visible** - aquí verás los logs de Alpha Vantage.

### Terminal 2: Ejecutar test

**Opción A: Script automatizado** (recomendado)
```bash
cd ~/Desktop/"macro-dashboard-with-data 2"
./scripts/test-uspmi-ingest.sh
```

**Opción B: Manual**
```bash
cd ~/Desktop/"macro-dashboard-with-data 2"
set -a && source .env.local && set +a

# Ejecutar ingesta
curl -v -m 130 -X POST "http://localhost:3001/api/jobs/ingest/fred?reset=true&batch=1&only=USPMI" \
  -H "Authorization: Bearer dev_local_token"

# Validar en BD
node - <<'NODE'
const { createClient } = require("@libsql/client");
const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
});
(async () => {
  const r = await client.execute({
    sql: "SELECT COUNT(*) n FROM macro_observations WHERE series_id='USPMI'"
  });
  console.log("USPMI count:", r.rows[0].n);
})();
NODE
```

---

## 📋 Qué capturar de los logs

### En Terminal 1 (servidor), busca estos bloques:

#### 1. Log "ENV CHECK"
```
ENV CHECK { hasAlphaVantageKey: true, alphaVantageKeyPrefix: "XXXX" }
```

#### 2. Logs de Alpha Vantage
```
[alphavantage] Fetching PMI from Alpha Vantage
[alphavantage] Response status for ISM_MANUFACTURING
[alphavantage] Response body preview for ISM_MANUFACTURING (first 400 chars)
[alphavantage] Response keys for ISM_MANUFACTURING
```

#### 3. Errores o rate limits
- `Error Message`: "This API function (ISM_MANUFACTURING) does not exist."
- `Information` o `Note`: Rate limit
- `[alphavantage] Rate limit detected`

#### 4. Resultado del fetch
```
[USPMI] fetchAlphaVantagePMI result
[USPMI] Preparing to upsert observations
```

---

## 🔍 Interpretación de resultados

### Caso A: Error "function does not exist"
**Log esperado**:
```json
{"Error Message":"This API function (ISM_MANUFACTURING) does not exist."}
```

**Conclusión**: Alpha Vantage no tiene este endpoint (o requiere plan premium)

**Acción**: Migrar a FRED si existe serie equivalente, o buscar otro endpoint confirmado

### Caso B: Rate limit
**Log esperado**:
```json
{"Note":"Thank you for using Alpha Vantage..."}
```
o
```json
{"Information":"Thank you for using Alpha Vantage..."}
```

**Conclusión**: El endpoint existe pero hay rate limit

**Acción**: Esperar 15-60 segundos y reintentar, o usar plan premium

### Caso C: Datos parseados correctamente
**Log esperado**:
```
[alphavantage] Response keys: ["data", ...]
[USPMI] fetchAlphaVantagePMI result: totalPoints=200+
[USPMI] Preparing to upsert observations: toInsert=200+
```

**Conclusión**: Alpha Vantage funciona ✅

**Validación**: `USPMI count > 0` en BD

---

## 📊 Qué reportar

Después de ejecutar, pega aquí **solo estas 3 cosas**:

1. **Response body del curl** (aunque sea corto)
2. **Bloque completo `[alphavantage]` de los logs del servidor**
3. **USPMI count** después de la ejecución

Ejemplo:
```
1. Response: {"success":true,"ingested":0,"errors":1}
2. Logs:
   [alphavantage] Fetching PMI from Alpha Vantage { function: 'ISM_MANUFACTURING', url: '...' }
   [alphavantage] Response body preview: {"Error Message":"This API function..."}
3. USPMI count: 0
```

---

## 🔄 Siguiente paso según resultado

### Si Alpha Vantage no funciona (Caso A)
- Investigar serie FRED equivalente (NAPM, etc.)
- Implementar fetch desde FRED
- Actualizar job para usar FRED en lugar de Alpha Vantage

### Si hay rate limit (Caso B)
- Implementar retry con backoff
- Considerar plan premium de Alpha Vantage
- O migrar a FRED si está disponible

### Si funciona (Caso C)
- ✅ Validar que `pmi_mfg` aparece en dashboard
- ✅ Quitar logs temporales
- ✅ Documentar endpoint correcto

---

## ⚠️ Nota importante

El servidor **debe estar corriendo en una terminal visible** para ver los logs. Si ejecutas el servidor en background, no verás los logs de Alpha Vantage.
