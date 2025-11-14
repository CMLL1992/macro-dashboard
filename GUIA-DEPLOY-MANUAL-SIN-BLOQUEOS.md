# 🚀 Guía: Deployment Manual Sin Bloqueos

## ⚠️ Problema Actual

1. **Los pushes automáticos bloquean deployments manuales**
2. **Los deployments manuales no se actualizan** (probablemente por cache)

## ✅ Solución: Deployment Manual Correcto

### Paso 1: Cancelar Deployment Bloqueado (Si Existe)

1. **Ve a Vercel Dashboard:**
   - https://vercel.com/dashboard
   - Selecciona tu proyecto `macro-dashboard`

2. **Ve a Deployments:**
   - Click en "Deployments" en el menú superior
   - Busca deployments con estado "Building" o "Queued"

3. **Cancela deployments bloqueados:**
   - Click en el deployment bloqueado
   - Click en "..." (tres puntos) → **"Cancel"**
   - Repite si hay múltiples deployments bloqueados

### Paso 2: Esperar a que Terminen los Deployments Automáticos

Si acabas de hacer un push a GitHub:

1. **Espera 2-3 minutos** a que termine el deployment automático
2. **NO intentes hacer deployment manual mientras hay uno en progreso**
3. **Verifica que el último deployment esté en estado "Ready"**

### Paso 3: Hacer Deployment Manual (Solo si NO hay deployments en progreso)

**IMPORTANTE:** Solo haz esto si:
- ✅ No hay deployments en estado "Building" o "Queued"
- ✅ El último deployment está en estado "Ready" o "Error"
- ✅ Quieres forzar un nuevo deployment con cache limpio

1. **Ve a Deployments:**
   - Click en "Deployments" en el menú superior
   - Busca el último deployment (debe estar "Ready")

2. **Haz Redeploy:**
   - Click en los "..." (tres puntos) del último deployment
   - Selecciona **"Redeploy"**
   - ✅ **MUY IMPORTANTE:** Marca **"Clear build cache"**
   - ✅ **MUY IMPORTANTE:** NO marques "Use existing Build Cache"
   - Click en **"Redeploy"**

3. **Espera 2-3 minutos:**
   - El deployment se completará
   - Verás el estado cambiar a "Building" → "Ready"

4. **Verifica en modo incógnito:**
   - Abre una ventana incógnita
   - Visita la URL pública
   - Verifica que los cambios se reflejen

### Paso 4: Verificar Cron Jobs (Después del Deployment)

1. **Ve a Settings → Cron Jobs:**
   - Deberías ver 2 cron jobs:
     - `/api/warmup` - `0 0 * * *`
     - `/api/jobs/weekly` - `0 17 * * 0`

2. **Si solo ves 1 cron job:**
   - Espera 1-2 minutos más (Vercel puede tardar en detectarlos)
   - Refresca la página
   - Si sigue sin aparecer, el deployment puede no haber detectado `vercel.json`

## 🔧 Si el Deployment Manual No Se Actualiza

### Problema: Cache del Navegador

**Solución:**
1. **Abre en modo incógnito:**
   - Chrome: Cmd+Shift+N (Mac) o Ctrl+Shift+N (Windows)
   - Firefox: Cmd+Shift+P (Mac) o Ctrl+Shift+P (Windows)

2. **Limpia cache del navegador:**
   - Chrome: Cmd+Shift+Delete → Marca "Cached images and files" → "Clear data"
   - Firefox: Cmd+Shift+Delete → Marca "Cache" → "Clear Now"

### Problema: Cache de Vercel

**Solución:**
1. **Marca "Clear build cache"** al hacer redeploy (Paso 3)
2. **Verifica `next.config.mjs`:**
   - Debe tener headers para desactivar cache
   - Debe tener `output: 'standalone'`

### Problema: Deployment No Detecta Cambios

**Solución:**
1. **Verifica que el código esté en GitHub:**
   - Ve a GitHub → Tu repositorio
   - Verifica que el último commit esté ahí

2. **Verifica que Vercel esté conectado a GitHub:**
   - Settings → Git
   - Debe estar conectado a tu repositorio

3. **Haz un cambio visible** (ej: cambiar un texto en el dashboard)
4. **Haz commit y push**
5. **Espera el deployment automático** (no hagas manual)

## 📋 Checklist para Deployment Manual

Antes de hacer deployment manual, verifica:

- [ ] No hay deployments en estado "Building" o "Queued"
- [ ] El último deployment está en estado "Ready" o "Error"
- [ ] Has cancelado cualquier deployment bloqueado
- [ ] Estás listo para esperar 2-3 minutos

Durante el deployment manual:

- [ ] Has marcado "Clear build cache"
- [ ] NO has marcado "Use existing Build Cache"
- [ ] Has esperado a que termine (estado "Ready")

Después del deployment:

- [ ] Has verificado en modo incógnito
- [ ] Has verificado que los cambios se reflejen
- [ ] Has verificado cron jobs (si aplica)

## 🚫 Qué NO Hacer

- ❌ **NO hacer deployment manual mientras hay uno automático en progreso**
- ❌ **NO hacer múltiples deployments simultáneos**
- ❌ **NO olvidar marcar "Clear build cache"**
- ❌ **NO verificar cambios sin modo incógnito o sin limpiar cache**

---

**Nota:** Si tienes problemas persistentes, puede ser mejor dejar que Vercel haga deployments automáticos desde GitHub y solo hacer manuales cuando sea absolutamente necesario.



