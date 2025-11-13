# 🔄 Forzar Redeploy en Vercel - Instrucciones

## ⚠️ Problema
La URL pública muestra la versión antigua del dashboard aunque los cambios ya están en GitHub.

## ✅ Solución: Forzar Redeploy Manual

### Paso 1: Ir a Vercel Dashboard
1. Abre: https://vercel.com/dashboard
2. Inicia sesión si es necesario
3. Busca y selecciona tu proyecto (probablemente se llama `macro-dashboard` o similar)

### Paso 2: Ir a Deployments
1. En el menú superior, click en **"Deployments"**
2. Verás una lista de todos los deployments

### Paso 3: Forzar Nuevo Deployment
**Opción A: Redeploy del último deployment**
1. Encuentra el deployment más reciente (el de arriba)
2. Click en los **"..."** (tres puntos) a la derecha
3. Selecciona **"Redeploy"**
4. En el diálogo:
   - ✅ **Marca "Clear build cache"** (MUY IMPORTANTE)
   - **Environment:** Production
5. Click en **"Redeploy"**

**Opción B: Trigger desde GitHub (si la opción A no funciona)**
1. Ve a: https://github.com/CMLL1992/macro-dashboard
2. Ve a **Actions** → **Deploy to Vercel** (si existe)
3. O simplemente haz un pequeño cambio y push:
   ```bash
   echo "# Deployment trigger" >> README.md
   git add README.md
   git commit -m "chore: trigger Vercel deployment"
   git push origin main
   ```

### Paso 4: Esperar el Build
1. Verás el estado del deployment:
   - 🟡 **Building...** → En proceso (espera 2-3 minutos)
   - 🟢 **Ready** → ¡Listo! Ya está desplegado
   - 🔴 **Error** → Hay un problema (ver logs)

### Paso 5: Verificar
Una vez que el deployment esté en estado "Ready":
1. Abre: https://macro-dashboard-seven.vercel.app
2. **Haz un hard refresh** del navegador:
   - **Chrome/Edge:** Ctrl+Shift+R (Windows) o Cmd+Shift+R (Mac)
   - **Firefox:** Ctrl+F5 (Windows) o Cmd+Shift+R (Mac)
   - **Safari:** Cmd+Option+R
3. Verifica que ahora muestra:
   - ✅ "CM11 Trading" (no "Macro Dashboard")
   - ✅ Sin iconos en la barra de navegación
   - ✅ Redirige automáticamente a `/dashboard` desde la página principal

---

## 🆘 Si Sigue Mostrando la Versión Antigua

### 1. Verificar Build Logs
1. Click en el deployment
2. Click en **"Build Logs"**
3. Busca errores (líneas en rojo)
4. Si hay errores, compártelos

### 2. Verificar Variables de Entorno
1. Ve a **Settings** → **Environment Variables**
2. Verifica que todas las variables necesarias están configuradas
3. Especialmente `APP_URL` debe ser: `https://macro-dashboard-seven.vercel.app`

### 3. Verificar que el Código está en GitHub
1. Ve a: https://github.com/CMLL1992/macro-dashboard
2. Verifica que el último commit es: `cfe9f39`
3. Verifica que los archivos tienen los cambios correctos:
   - `app/page.tsx` debe tener `redirect('/dashboard')`
   - `components/NavBar.tsx` debe tener "CM11 Trading"

### 4. Limpiar Cache del Navegador
Si el deployment está correcto pero tu navegador muestra la versión antigua:
1. Abre las herramientas de desarrollador (F12)
2. Click derecho en el botón de recargar
3. Selecciona **"Vaciar caché y volver a cargar de forma forzada"**

---

## 📝 Verificación Rápida

Después del redeploy, verifica estos puntos:

- [ ] URL principal redirige a `/dashboard` (no muestra página de bienvenida)
- [ ] NavBar muestra "CM11 Trading" (no "Macro Dashboard")
- [ ] NavBar NO tiene iconos (solo texto)
- [ ] Página `/noticias` existe y funciona
- [ ] Página `/notificaciones` existe y funciona
- [ ] Página `/admin` requiere contraseña

---

**Última actualización:** 2025-11-13

