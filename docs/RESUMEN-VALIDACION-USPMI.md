# Resumen Validación USPMI

**Fecha**: 2025-12-17  
**Estado**: ⚠️ Servidor funcionando, pero job se cuelga al ejecutar ingesta

---

## ✅ Verificaciones completadas

### 1. Servidor funcionando
- ✅ Servidor responde en puerto 3001
- ✅ Endpoint `/api/debug/usa-indicators` funciona
- ✅ RSAFS tiene datos (190 observaciones)

### 2. Configuración
- ✅ `ALPHA_VANTAGE_API_KEY` existe en `.env.local` (línea 36)
- ✅ Código tiene log "ENV CHECK" implementado (línea 75-78 de `route.ts`)
- ✅ Parámetro `only=USPMI` está implementado (línea 89, 122-129)

### 3. Problema detectado
- ❌ Al ejecutar el job de ingesta, el servidor se cuelga
- ❌ `curl` espera más de 2 minutos y luego devuelve "Empty reply from server"
- ❌ Esto sugiere que el job está bloqueando o hay un timeout

---

## 🔍 Diagnóstico necesario

### Verificar logs del servidor
El servidor debe estar corriendo en una terminal. Buscar en los logs:

1. **Log "ENV CHECK"** (debe aparecer al hacer POST al job):
   ```
   ENV CHECK { hasAlphaVantageKey: true, alphaVantageKeyPrefix: "7EP1" }
   ```

2. **Logs de Alpha Vantage** (deben aparecer cuando se procesa USPMI):
   ```
   [alphavantage] Fetching PMI from Alpha Vantage
   [alphavantage] Response status for ISM_MANUFACTURING
   [alphavantage] Response body preview for ISM_MANUFACTURING
   ```

3. **Errores o timeouts**:
   - Si aparece "rate limit" → Alpha Vantage está limitando
   - Si aparece "Invalid API call" → endpoint incorrecto
   - Si no aparece nada → el job se cuelga antes de llegar a Alpha Vantage

---

## 🛠️ Soluciones posibles

### A) Job se cuelga antes de Alpha Vantage
**Síntoma**: No aparecen logs de Alpha Vantage  
**Causa probable**: Problema con Turso o con la lógica de `only=USPMI`  
**Fix**: Revisar que el código de USPMI se ejecuta correctamente en el loop

### B) Alpha Vantage rate limit
**Síntoma**: Logs muestran "Note" o "rate limit"  
**Causa**: Alpha Vantage free tier limita requests  
**Fix**: Esperar 15-60 segundos y reintentar, o usar plan premium

### C) Timeout del job
**Síntoma**: Job tarda más de 4 minutos (HARD_LIMIT_MS = 240_000)  
**Causa**: Alpha Vantage responde lento o hay muchos datos  
**Fix**: Aumentar timeout o procesar en batches más pequeños

### D) Error en parsing
**Síntoma**: Alpha Vantage responde pero no se insertan datos  
**Causa**: Estructura JSON diferente a la esperada  
**Fix**: Revisar logs de "Response keys" y ajustar parser

---

## 📋 Próximos pasos

1. **Verificar logs del servidor** donde corre `next dev -p 3001`
   - Buscar "ENV CHECK"
   - Buscar "[alphavantage]"
   - Buscar errores o stacktraces

2. **Si no hay logs**, el servidor puede haberse caído:
   ```bash
   # Reiniciar servidor
   cd ~/Desktop/"macro-dashboard-with-data 2"
   ./node_modules/.bin/next dev -p 3001
   ```

3. **Ejecutar ingesta con timeout**:
   ```bash
   timeout 120 curl -X POST "http://localhost:3001/api/jobs/ingest/fred?reset=true&batch=1&only=USPMI" \
     -H "Authorization: Bearer dev_local_token"
   ```

4. **Validar en BD directamente** (si el job completó pero no devolvió respuesta):
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

---

## ⚠️ Nota importante

El servidor necesita estar corriendo en una terminal visible para ver los logs. Si se ejecuta en background, los logs no se ven y es difícil diagnosticar.

**Recomendación**: Ejecutar el servidor en una terminal dedicada:
```bash
cd ~/Desktop/"macro-dashboard-with-data 2"
./node_modules/.bin/next dev -p 3001
```

Y en otra terminal, ejecutar el job y observar los logs en tiempo real.
