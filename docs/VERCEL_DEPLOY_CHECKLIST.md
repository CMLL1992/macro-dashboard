# ✅ Checklist de Deploy en Vercel

## 📦 Cambios Realizados y Push Completado

✅ **Push completado**: Commit `1787364` - "fix: configure Vercel deployment (pnpm, Node 20, dynamic dashboard)"

### Archivos modificados:
- `package.json` - Añadido `packageManager`, `engines`
- `vercel.json` - Optimizado (removido buildCommand/outputDirectory)
- `.nvmrc` - Creado con Node 20
- `app/dashboard/page.tsx` - Marcado como `dynamic = 'force-dynamic'`

---

## 🚀 Pasos Inmediatos en Vercel Dashboard

### 1. **Redeploy Limpio**
1. Ve a **Deployments** en Vercel
2. Click en el último deployment (o el que falló)
3. Click en **"..."** (menú) → **"Redeploy"**
4. ✅ **Marca "Clear build cache"**
5. Click **"Redeploy"**

### 2. **Configuración de Settings** (verificar)
- **Settings → General → Node.js Version**: `20.x` (o dejar que use `.nvmrc`)
- **Settings → General → Root Directory**: (vacío) o `/`
- **Settings → General → Framework Preset**: Next.js (debe detectarse automáticamente)
- **Settings → General → Build Command**: (vacío - usa `pnpm run build` del package.json)
- **Settings → General → Install Command**: (vacío - usa el de `vercel.json`)

---

## 👀 Vigilar Build Logs (Tiempo Real)

### ✅ Señales de Éxito (Buscar en Logs):

```
✓ Detected pnpm (packageManager field)
✓ Node.js version: 20.x (from .nvmrc)
✓ Detected Next.js version: 14.2.5
✓ Running "pnpm install --frozen-lockfile"
✓ Running "pnpm run build"
```

### ⚠️ Señales de Problema:

**Si aparece:**
```
✗ No Next.js version detected
```
→ Verificar que `next` está en `dependencies` (no solo devDependencies)

**Si aparece:**
```
✗ lockfile is out of sync
```
→ Ejecutar localmente: `pnpm install` y hacer push del `pnpm-lock.yaml` actualizado

---

## 🔧 Acciones Según Tipo de Error

### 1. **Dynamic Server Usage / Can't Pre-render Page**

**Síntoma en logs:**
```
Error: Route "/dashboard" used `cookies` or `headers`. 
To use cookies or headers, the route must be dynamic.
```

**Solución:**
- ✅ **YA CORREGIDO**: `app/dashboard/page.tsx` tiene `export const dynamic = 'force-dynamic'`
- Si aparece otra ruta, añadir al inicio del archivo:
  ```typescript
  export const dynamic = 'force-dynamic'
  export const revalidate = 0
  ```

**Rutas ya marcadas como dinámicas:**
- ✅ `/dashboard` - `app/dashboard/page.tsx`

---

### 2. **Module Not Found / Cannot Resolve**

**Síntoma:**
```
Module not found: Can't resolve '@/lib/...'
```

**Solución:**
- Verificar que `tsconfig.json` tiene `paths: { "@/*": ["./*"] }`
- Verificar que el módulo existe en la ruta correcta
- Si es dependencia externa, verificar en `package.json` y `pnpm-lock.yaml`

---

### 3. **Process.env XYZ undefined / env missing**

**Síntoma:**
```
ReferenceError: process.env.CRON_TOKEN is not defined
```

**Solución:**
1. Ve a **Settings → Environment Variables**
2. Añade las variables necesarias:
   - `CRON_TOKEN` (Production, Preview, Development)
   - `APP_URL` (Production: tu URL de Vercel)
   - `FRED_API_KEY` (si se usa)
   - `TELEGRAM_BOT_TOKEN` (si se usa)
   - `TELEGRAM_CHAT_ID` (si se usa)
3. **Redeploy** después de añadir variables

**Variables críticas:**
- `CRON_TOKEN` - Para jobs protegidos
- `APP_URL` - URL del deployment (p. ej., `https://tu-app.vercel.app`)

---

### 4. **TypeScript Type Errors**

**Síntoma:**
```
Type error: Type 'X' is not assignable to type 'Y'
```

**Solución:**
- Corregir el error de tipo en el archivo indicado
- Si bloquea el release y es urgente, temporalmente en `next.config.mjs`:
  ```js
  typescript: {
    ignoreBuildErrors: true, // ⚠️ SOLO TEMPORAL
  }
  ```
- **NO RECOMENDADO**: Solo usar si es crítico y se corregirá después

---

### 5. **Out of Memory / Timeout**

**Síntoma:**
```
Error: The build exceeded the maximum time limit
```

**Solución:**
1. **Redeploy con cache limpia** (ya lo haremos)
2. Si persiste, revisar `next.config.mjs`:
   - Verificar que `experimental` no tiene configuraciones pesadas
   - Considerar desactivar `typedRoutes` temporalmente si causa problemas
3. Dividir tareas pesadas en jobs separados

---

## ✅ Comprobaciones Post-Deploy (Smoke Test)

### 1. **URLs a Verificar:**

```
✅ https://tu-app.vercel.app/                    → Página principal
✅ https://tu-app.vercel.app/dashboard           → Dashboard (dinámico)
✅ https://tu-app.vercel.app/narrativas          → Narrativas
✅ https://tu-app.vercel.app/api/health          → Health check
✅ https://tu-app.vercel.app/api/bias             → API bias
```

### 2. **Validaciones:**

- [ ] Página principal carga sin errores
- [ ] Dashboard muestra datos (no "Inicializando...")
- [ ] Rutas dinámicas funcionan
- [ ] Route handlers responden (ej: `/api/health`)
- [ ] No hay errores en consola del navegador

### 3. **Cron Jobs:**

- [ ] Ve a **Settings → Cron Jobs**
- [ ] Verifica que aparece: `/api/warmup` con schedule `0 */3 * * *`

---

## 📊 Entrega de Resultados

Después del deploy, proporciona:

1. **Captura del primer bloque de errores** (si falla) de Build Logs
2. **Confirmación de Node y pnpm detectados**:
   ```
   ✓ Node.js: 20.x
   ✓ pnpm: 10.20.0
   ```
3. **Estado final del deploy**:
   - ✅ Ready
   - ❌ Error: [causa específica]
4. **Lista de rutas marcadas como dinámicas**:
   - ✅ `/dashboard` - `app/dashboard/page.tsx`

---

## 🔄 Si el Deploy Falla

### Paso 1: Revisar Build Logs
- Copiar los primeros 50-100 líneas del error
- Identificar el tipo de error (usar sección "Acciones Según Tipo de Error" arriba)

### Paso 2: Aplicar Corrección
- Seguir la solución correspondiente
- Hacer commit y push
- Redeploy con cache limpia

### Paso 3: Verificar
- Revisar que el error desapareció
- Hacer smoke test de las URLs

---

## 📝 Notas Importantes

- **No loguear secretos**: Nunca hacer `console.log(process.env.CRON_TOKEN)`
- **Cache de build**: Siempre limpiar en redeploy si hay errores inesperados
- **Environment Variables**: Añadir en Production, Preview y Development según necesidad
- **Root Directory**: Debe estar vacío (proyecto en raíz del repo)

---

**Última actualización**: 2025-11-11
**Commit**: `1787364`

