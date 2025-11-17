# 📋 Cómo Revisar los Logs de GitHub Actions

## ⚠️ Importante: "Success" NO significa que los datos se hayan actualizado

Cuando un workflow muestra "Success" en GitHub Actions, solo significa que:
- ✅ El workflow se ejecutó sin errores de sintaxis
- ✅ Todos los pasos se completaron sin fallar

**PERO NO garantiza que:**
- ❌ Las llamadas a la API hayan sido aceptadas
- ❌ Los datos se hayan escrito en la base de datos
- ❌ El dashboard tenga datos nuevos

## 🔍 Cómo Revisar los Logs Correctamente

### Paso 1: Abrir el Workflow

1. Ve a: https://github.com/CMLL1992/macro-dashboard/actions
2. Click en el workflow que quieres revisar (ej: "Daily Macro Jobs #41")
3. Click en el job (ej: "bootstrap")

### Paso 2: Expandir Cada Paso

Dentro del job, verás varios pasos (bloques expandibles). **Expande TODOS** y revisa:

#### Para "Daily Macro Jobs":

**Step: "Ingest FRED"**
```bash
# Busca en los logs algo como:
curl -sS -X POST -H "Authorization: Bearer $CRON_TOKEN" "${APP_URL}/api/jobs/ingest/fred"

# Debe mostrar una respuesta JSON:
{"success":true,"ingested":14,"errors":0,"duration_ms":5000}
```

**Si ves:**
- `401 Unauthorized` → **CRON_TOKEN incorrecto** (no coincide entre GitHub y Vercel)
- `404 Not Found` → **APP_URL incorrecto** (apunta a URL que no existe)
- `500 Internal Server Error` → Problema en el servidor (revisa logs de Vercel)
- `{"success":true,"ingested":0,"errors":14}` → FRED_API_KEY incorrecta o problema con FRED API

**Step: "Correlations"**
```bash
# Busca:
curl -sS -X POST -H "Authorization: Bearer $CRON_TOKEN" "${APP_URL}/api/jobs/correlations"

# Debe mostrar:
{"success":true,"processed":10,"updatedPairsCount":10}
```

**Step: "Compute Bias"**
```bash
# Busca:
curl -sS -X POST -H "Authorization: Bearer $CRON_TOKEN" "${APP_URL}/api/jobs/compute/bias"

# Debe mostrar:
{"success":true,"computed":9}
```

#### Para "News & Calendar Ingest":

**Step: "Debug environment"**
- Verifica que todas las variables muestren "YES"
- Si alguna muestra "NO", esa fuente no funcionará

**Step: "Run all sources ingestion script"**
- Busca líneas como:
  ```
  ✅ [RSS News] Completed successfully
  ✅ [FRED Calendar] Completed successfully
  📅 Total Calendar: X inserted, Y skipped
  📰 Total News: X inserted, Y skipped
  ```

**Si ves:**
- `API returned 401` → **INGEST_KEY incorrecto**
- `API returned 403` → **INGEST_KEY incorrecto o permisos**
- `Failed to fetch` → Problema de conexión o **APP_URL incorrecto**
- `0 inserted, 0 skipped` → No se encontraron datos o hay un error silencioso

## 🔧 Qué Buscar en los Logs

### ✅ Señales de Éxito

```
✅ Ingested 14 series
✅ Correlations calculated: 10 pairs
✅ Bias computed: 9
✅ Inserted: X events
✅ Inserted: Y news items
```

### ❌ Señales de Problema

```
❌ 401 Unauthorized
   → Token/llave incorrecta

❌ 404 Not Found
   → APP_URL incorrecto

❌ 500 Internal Server Error
   → Problema en el servidor

❌ Failed to fetch
   → Problema de conexión o URL incorrecta

❌ 0 inserted, 0 skipped
   → No se están insertando datos (revisa errores anteriores)
```

## 📊 Ejemplo de Log Correcto

```
🔄 Ingestando datos FRED...
curl -sS -X POST -H "Authorization: Bearer ***" "https://macro-dashboard-seven.vercel.app/api/jobs/ingest/fred"
{"success":true,"ingested":14,"errors":0,"duration_ms":5234,"finishedAt":"2025-11-13T22:00:00.000Z"}
✅ Datos FRED actualizados: 14 series
```

## 📊 Ejemplo de Log con Problema

```
🔄 Ingestando datos FRED...
curl -sS -X POST -H "Authorization: Bearer ***" "https://macro-dashboard-seven.vercel.app/api/jobs/ingest/fred"
{"success":false,"error":"Unauthorized"}
❌ Error actualizando FRED: Unauthorized
```

**En este caso:** El workflow muestra "Success" pero los datos NO se actualizaron porque el token es incorrecto.

## 🎯 Checklist de Verificación

Después de ejecutar un workflow:

- [ ] El workflow muestra "Success" ✅
- [ ] Los logs muestran `{"success":true}` en las respuestas JSON ✅
- [ ] Los contadores muestran números > 0 (ej: `ingested: 14`) ✅
- [ ] No hay errores 401, 404, 500 en los logs ✅
- [ ] El endpoint `/api/health` muestra datos actualizados ✅

**Si todos los checkboxes están marcados:** Los datos se actualizaron correctamente ✅

**Si falta alguno:** Hay un problema que hay que corregir ❌

---

**Última actualización:** 13/11/2025



