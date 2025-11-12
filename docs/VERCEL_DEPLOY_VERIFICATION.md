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

**Última actualización:** 2025-11-11

