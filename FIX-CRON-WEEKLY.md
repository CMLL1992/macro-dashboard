# 🔧 Solución: Segundo Cron Job No Aparece en Vercel

## Problema
Vercel solo muestra 1 cron job (`/api/warmup`) pero debería mostrar 2:
- ✅ `/api/warmup` - `0 0 * * *` (diario)
- ❌ `/api/jobs/weekly` - `0 17 * * 0` (domingos) - **NO APARECE**

## Causa
Vercel detecta los cron jobs desde `vercel.json` **solo después de un deployment**. Si el segundo cron fue agregado después del último deployment, Vercel no lo detectará hasta hacer un nuevo deployment.

## Solución: Forzar Redeploy

### Opción 1: Redeploy Manual en Vercel (Recomendado)

1. **Ve a Vercel Dashboard:**
   - https://vercel.com/dashboard
   - Selecciona tu proyecto `macro-dashboard`

2. **Ve a Deployments:**
   - Click en "Deployments" en el menú superior
   - Busca el último deployment

3. **Haz Redeploy:**
   - Click en los "..." (tres puntos) del último deployment
   - Selecciona **"Redeploy"**
   - ✅ **Marca "Clear build cache"** (importante)
   - Click en **"Redeploy"**

4. **Espera 2-3 minutos:**
   - El deployment se completará
   - Vercel detectará ambos cron jobs desde `vercel.json`

5. **Verifica:**
   - Ve a **Settings** → **Cron Jobs**
   - Deberías ver **2 cron jobs**:
     - `/api/warmup` - `0 0 * * *`
     - `/api/jobs/weekly` - `0 17 * * 0`

### Opción 2: Push a GitHub (Trigger Automático)

Si prefieres que Vercel haga el deployment automáticamente:

1. **Haz un cambio menor** (ej: actualizar un comentario)
2. **Commit y push:**
   ```bash
   git add .
   git commit -m "trigger: forzar redeploy para detectar segundo cron"
   git push origin main
   ```
3. **Vercel detectará el push** y hará deployment automático
4. **Espera 2-3 minutos** y verifica en Settings → Cron Jobs

## Verificación Post-Deploy

Después del redeploy, verifica:

1. **Settings → Cron Jobs:**
   - Deberías ver **2 cron jobs activos**
   - Ambos con estado "Active"

2. **Verifica el schedule:**
   - `/api/warmup`: `0 0 * * *` (diario 00:00 UTC)
   - `/api/jobs/weekly`: `0 17 * * 0` (domingos 17:00 UTC)

3. **Verifica "Próxima ejecución":**
   - `/api/warmup`: Próxima medianoche UTC
   - `/api/jobs/weekly`: Próximo domingo 17:00 UTC

## Si Sigue Sin Aparecer

Si después del redeploy el segundo cron sigue sin aparecer:

1. **Verifica `vercel.json`:**
   - Asegúrate de que tiene ambos cron jobs
   - El archivo está en la raíz del proyecto

2. **Verifica el endpoint:**
   - El endpoint `/api/jobs/weekly` debe existir
   - Debe aceptar llamadas de Vercel cron (header `x-vercel-cron`)

3. **Revisa los logs del deployment:**
   - Ve a Deployments → Último deployment → Build Logs
   - Busca errores relacionados con cron jobs

4. **Contacta soporte de Vercel:**
   - Si nada funciona, puede ser un problema de Vercel
   - Abre un ticket en su soporte

---

**Nota:** Los cron jobs en Vercel solo aparecen **después de un deployment exitoso** que incluye `vercel.json` con la sección `crons`.

