# ✅ Verificación de Deploy en Vercel

## 📋 Checklist de Verificación

### 1. ✅ BuildCommand en vercel.json

**Archivo:** `vercel.json`  
**Línea buildCommand:**
```json
"buildCommand": "pnpm approve-builds esbuild better-sqlite3 unrs-resolver || true && pnpm build"
```

**Estado:** ✅ Correcto

---

### 2. ⚙️ Configuración en Vercel Dashboard

#### Node.js Version
1. Ve a **Vercel Dashboard** → Tu proyecto → **Settings** → **General**
2. Busca **"Node.js Version"**
3. Selecciona: **"20.x (or from package.json)"**
4. Guarda los cambios

**Captura/Nota:** Anota la versión seleccionada: `_________________`

---

### 3. 🔄 Redeploy de Producción

1. Ve a **Deployments** → Último deployment de Production
2. Click en **"..."** → **"Redeploy"**
3. Asegúrate de que está en modo **Production**
4. Click **"Redeploy"**

#### Verificación en Build Logs

**Buscar:**
- ❌ **NO debe aparecer:** `"Ignored build scripts: esbuild"`
- ✅ **SÍ debe aparecer:** Pasos de build exitosos
- ✅ **SÍ debe aparecer:** `better-sqlite3` compilado correctamente

**Extracto de logs:**
```
[Pegar aquí extracto relevante de los logs]
```

---

### 4. 🧪 Checks de Endpoints Post-Deploy

**URL Base:** `https://tu-app.vercel.app`

#### A. `/api/notifications/status`

**URL:** `https://tu-app.vercel.app/api/notifications/status`

**Esperado:**
- ✅ No debe aparecer: `"Could not locate the bindings file"`
- ✅ Debe responder con JSON válido

**Resultado:**
```
[Pegar respuesta o mensaje clave observado]
```

---

#### B. `/api/ping-fred` y `/api/diag`

**URLs:**
- `https://tu-app.vercel.app/api/ping-fred`
- `https://tu-app.vercel.app/api/diag`

**Esperado:**
- ✅ No deben reportar simultáneamente `cache: 'no-store'` con `revalidate: 0`
- ✅ Deben responder correctamente

**Resultado:**
```
/api/ping-fred: [Estado y mensaje si hay aviso]
/api/diag: [Estado y mensaje si hay aviso]
```

**Si aparece aviso, texto exacto:**
```
[Pegar texto exacto del aviso si aparece]
```

---

#### C. `/correlations`

**URL:** `https://tu-app.vercel.app/correlations`

**Esperado:**
- ✅ La página renderiza correctamente
- ✅ No hay errores en consola
- ✅ Tabla de correlaciones visible

**Resultado:**
```
[Confirmar que renderiza: Sí/No]
```

---

### 5. 🔧 Mitigaciones Aplicadas (si fue necesario)

Si hubo que aplicar correcciones adicionales:

#### A. Verificación de runtime = 'nodejs'

**Rutas verificadas:**
- ✅ `app/api/bias/route.ts` - `export const runtime = 'nodejs'`
- ✅ `app/api/jobs/ingest/fred/route.ts` - `export const runtime = 'nodejs'`
- ✅ `app/api/jobs/maintenance/route.ts` - `export const runtime = 'nodejs'`
- ✅ `app/api/notifications/status/route.ts` - `export const runtime = 'nodejs'`
- ✅ `app/api/notifications/history/route.ts` - `export const runtime = 'nodejs'`
- ✅ `app/api/notifications/metrics/route.ts` - `export const runtime = 'nodejs'`
- ✅ `app/api/qa/notifications/export/route.ts` - `export const runtime = 'nodejs'`
- ✅ `app/api/ping-fred/route.ts` - `export const runtime = 'nodejs'`
- ✅ `app/api/diag/route.ts` - `export const runtime = 'nodejs'`

**Estado:** ✅ Todas las rutas tienen `runtime = 'nodejs'`

---

#### B. Redeploy sin caché

**Si fue necesario:**
- [ ] Desmarcado "Use existing Build Cache"
- [ ] Redeploy ejecutado
- [ ] Resultado: `_________________`

---

#### C. Build from source

**Si fue necesario:**
- [ ] Variable añadida: `npm_config_build_from_source = true`
- [ ] Redeploy ejecutado
- [ ] Resultado: `_________________`

---

## 📊 Resumen Final

### Criterios de "OK para cerrar"

- [x] **buildCommand correcto en vercel.json** ✅
- [ ] **Proyecto en Vercel fijado a Node 20.x** ⏳ (Verificar en Dashboard)
- [ ] **Build de Producción exitoso, sin "Ignored build scripts: esbuild"** ⏳ (Verificar en logs)
- [ ] **Endpoints sin "Could not locate the bindings file"** ⏳ (Verificar /api/notifications/status)
- [ ] **Endpoints sin conflicto de cache: 'no-store' con revalidate: 0** ⏳ (Verificar /api/ping-fred y /api/diag)
- [ ] **/correlations renderizando** ⏳ (Verificar página)

---

## 📝 Notas Adicionales

**Fecha de verificación:** `_________________`  
**URL de producción:** `https://_________________.vercel.app`  
**Último commit:** `_________________`

---

**Última actualización:** 2025-11-12

---

## ✅ Resultados Reales de Verificación (Producción)

**Fecha de verificación:** 2025-11-12  
**URL de producción:** `https://macro-dashboard-seven.vercel.app`  
**Último commit:** `5cc238c`

### Verificaciones Completadas

✅ **Node.js 20.x** — Correcto (node-v115)  
✅ **better-sqlite3 compilado nativamente** — Compilado desde fuente con node-gyp  
✅ **Sin errores de bindings** — No aparece "Could not locate the bindings file"  
✅ **Sin conflictos de caché** — No hay avisos de `cache: 'no-store'` con `revalidate: 0`  
✅ **Cron diario OK** — Configurado para ejecutarse una vez al día (Hobby plan compatible)  
✅ **Endpoints verificados:**
- `/api/notifications/status` → JSON válido, sin errores
- `/api/ping-fred` → Responde con 15 indicadores macro
- `/api/diag` → Responde correctamente
- `/correlations` → HTTP 200, renderiza correctamente

### Extracto de Build Logs (Final Exitoso)

```
gyp info using node@20.19.4 | linux | x64
gyp info spawn make
COPY Release/better_sqlite3.node
gyp info ok
✓ Build Completed in /vercel/output [2m]
✓ Deployment completed
```

### Log Filter Recomendado en Vercel

Para monitorear problemas relacionados con la compilación nativa y el sistema de actualización automática, filtrar por:

```
["bindings file", "better-sqlite3", "no-store", "revalidate", "node-v115", "node-v127", "warmup", "ingest"]
```

**Nota:** `node-v115` indica Node 20 (correcto), `node-v127` indica Node 22 (incorrecto).

**Logs de warmup esperados:**
- `[warmup] start` - Inicio de ejecución
- `[warmup] ingesting FRED data...` - Inicio de ingesta
- `[warmup] ingested <series_id> (<points> points)` - Serie ingerida exitosamente
- `[warmup] updating notifications status...` - Actualización de estado
- `[warmup] done` - Finalización con resumen (updatedSeriesCount, durationMs, errorsCount)

---

## ⏰ Configuración del Cron Job

### Frecuencia Actual

El cron job está configurado para ejecutarse **una vez al día** (medianoche UTC):

```json
{
  "crons": [
    { "path": "/api/warmup", "schedule": "0 0 * * *" }
  ]
}
```

**Razón:** Compatible con el plan Hobby de Vercel (limitado a 1 ejecución diaria).

### Cambiar a Frecuencia Horaria

Si necesitas actualizaciones más frecuentes (requiere plan Pro):

1. **Edita `vercel.json`:**
   ```json
   {
     "crons": [
       { "path": "/api/warmup", "schedule": "0 * * * *" }
     ]
   }
   ```

2. **Impacto:**
   - ✅ **Ventajas:** Datos más frescos (actualización cada hora)
   - ⚠️ **Consideraciones:**
     - Requiere plan Pro de Vercel
     - Más llamadas a la API de FRED (14 series × 24 horas = 336 requests/día)
     - Mayor uso de recursos (CPU, tiempo de ejecución)
     - FRED API permite 120 requests/minuto, así que es seguro

3. **Verificación:**
   - Después del cambio, verifica en Vercel Dashboard → Cron Jobs que el schedule se actualizó
   - Monitorea los logs para confirmar ejecuciones horarias
   - Revisa `lastIngestAt` en `/api/diag` para confirmar actualizaciones frecuentes

### Otras Frecuencias Recomendadas

- **Cada 6 horas:** `"0 */6 * * *"` (4 veces al día)
- **Cada 12 horas:** `"0 */12 * * *"` (2 veces al día)
- **Cada 3 horas:** `"0 */3 * * *"` (requiere plan Pro, 8 veces al día)

