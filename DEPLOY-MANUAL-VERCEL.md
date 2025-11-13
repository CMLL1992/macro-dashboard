# 🚀 Deploy Manual en Vercel - Guía Paso a Paso

## ⚠️ Situación Actual
Tienes un deployment bloqueado que necesitas cancelar y crear uno nuevo manualmente.

---

## 📋 PASO 1: Cancelar Deployment Bloqueado

1. **Ve a:** https://vercel.com/dashboard
2. **Selecciona tu proyecto** (macro-dashboard o similar)
3. **Ve a la pestaña "Deployments"**
4. **Encuentra el deployment bloqueado** (probablemente dice "Building..." o "Queued" desde hace mucho tiempo)
5. **Click en los "..."** (tres puntos) a la derecha del deployment
6. **Selecciona "Cancel"** o "Cancel Deployment"
7. **Confirma la cancelación**

---

## 📋 PASO 2: Crear Nuevo Deployment Manual

### Opción A: Desde GitHub (Recomendado)

1. **Ve a:** https://github.com/CMLL1992/macro-dashboard
2. **Ve a la pestaña "Actions"** (si tienes GitHub Actions configurado)
3. **O simplemente verifica que el último commit está en GitHub:**
   - Debería ser: `3db55f5` - "fix: desactivar cache en next.config para forzar actualización"
   - O: `6289146` - "fix: actualizar metadata y forzar invalidación de cache - CM11 Trading"

### Opción B: Desde Vercel Dashboard (Más Directo)

1. **Ve a:** https://vercel.com/dashboard
2. **Selecciona tu proyecto**
3. **Ve a la pestaña "Deployments"**
4. **Click en el botón "..."** (tres puntos) en la parte superior derecha
5. **Selecciona "Redeploy"** o busca un botón "Create Deployment"
6. **En el diálogo:**
   - **Branch:** `main`
   - **Environment:** Production
   - ✅ **Marca "Clear build cache"** (MUY IMPORTANTE)
   - ✅ **Marca "Use existing Build Cache"** → DESMARCAR (si existe)
7. **Click en "Deploy"** o "Redeploy"

---

## 📋 PASO 3: Monitorear el Deployment

1. **Verás el nuevo deployment aparecer** en la lista
2. **Estados posibles:**
   - 🟡 **Queued** → Esperando para construir
   - 🟡 **Building...** → En proceso (espera 2-3 minutos)
   - 🟢 **Ready** → ¡Listo! Ya está desplegado
   - 🔴 **Error** → Hay un problema (ver logs)
   - ⚠️ **Canceled** → Fue cancelado

3. **Click en el deployment** para ver los logs en tiempo real

---

## 📋 PASO 4: Verificar Build Logs

Si el deployment falla o quieres ver qué está pasando:

1. **Click en el deployment**
2. **Click en "Build Logs"** o "View Logs"
3. **Busca:**
   - ✅ Líneas verdes: Todo bien
   - ⚠️ Líneas amarillas: Advertencias (normalmente OK)
   - 🔴 Líneas rojas: Errores (necesitan atención)

### Errores Comunes:

**"Module not found"**
- Verifica que todas las dependencias están en `package.json`
- Verifica que `pnpm-lock.yaml` está actualizado

**"Build timeout"**
- El build está tardando demasiado
- Intenta de nuevo o verifica si hay procesos lentos

**"Environment variable missing"**
- Ve a Settings → Environment Variables
- Verifica que todas las variables necesarias están configuradas

---

## 📋 PASO 5: Verificar que Funciona

Una vez que el deployment esté en estado "Ready":

1. **Abre:** https://macro-dashboard-seven.vercel.app
2. **Haz un hard refresh:**
   - **Windows:** Ctrl + Shift + R
   - **Mac:** Cmd + Shift + R
3. **O prueba en modo incógnito** para evitar cache del navegador

### Verificaciones:

- [ ] Título del navegador dice "CM11 Trading" (no "Macro Dashboard")
- [ ] NavBar muestra "CM11 Trading" sin iconos
- [ ] La página principal redirige automáticamente a `/dashboard`
- [ ] No aparece la página de bienvenida antigua
- [ ] Las páginas `/noticias` y `/notificaciones` funcionan

---

## 🆘 Si el Deployment Sigue Fallando

### 1. Verificar Variables de Entorno

1. Ve a **Settings** → **Environment Variables**
2. Verifica que están configuradas:
   - `FRED_API_KEY`
   - `INGEST_KEY`
   - `CRON_TOKEN`
   - `APP_URL`: `https://macro-dashboard-seven.vercel.app`

### 2. Verificar Configuración del Proyecto

1. Ve a **Settings** → **General**
2. Verifica:
   - **Framework Preset:** Next.js
   - **Root Directory:** (vacío)
   - **Build Command:** (vacío - usa el de package.json)
   - **Output Directory:** (vacío)
   - **Install Command:** `pnpm install --frozen-lockfile`

### 3. Verificar que el Código está en GitHub

1. Ve a: https://github.com/CMLL1992/macro-dashboard
2. Verifica que el último commit es reciente
3. Verifica que los archivos tienen los cambios correctos

---

## 📝 Checklist de Deployment Manual

- [ ] Deployment bloqueado cancelado
- [ ] Nuevo deployment creado con "Clear build cache"
- [ ] Deployment completado (estado "Ready")
- [ ] URL pública muestra la versión actualizada
- [ ] Hard refresh del navegador realizado
- [ ] Todas las páginas funcionan correctamente

---

**Última actualización:** 2025-11-13  
**Último commit en GitHub:** `3db55f5`

