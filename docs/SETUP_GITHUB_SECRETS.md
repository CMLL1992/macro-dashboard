# 🔐 Configuración de Secrets en GitHub

Este documento explica cómo configurar los secrets necesarios para que los workflows de GitHub Actions funcionen correctamente.

## Secrets Requeridos

### 1. `CRON_TOKEN`

**Descripción:** Token de autenticación para endpoints protegidos (`/api/jobs/*`)

**Cómo obtenerlo:**
1. Genera un token seguro (puedes usar el mismo que `INGEST_KEY` o generar uno nuevo)
2. Ejemplo de generación:
   ```bash
   openssl rand -hex 32
   ```

**Valor recomendado:** Usa el mismo valor que `INGEST_KEY` o genera uno nuevo de 64 caracteres hexadecimales.

**Dónde configurarlo:**
1. Ve a tu repositorio en GitHub: `https://github.com/CMLL1992/macro-dashboard`
2. Click en **Settings** (Configuración)
3. En el menú lateral, click en **Secrets and variables** → **Actions**
4. Click en **New repository secret**
5. **Name:** `CRON_TOKEN`
6. **Secret:** Pega el token generado
7. Click **Add secret**

### 2. `APP_URL`

**Descripción:** URL de tu aplicación en Vercel

**Valor:** `https://macro-dashboard-seven.vercel.app`

**Dónde configurarlo:**
1. Ve a **Settings** → **Secrets and variables** → **Actions**
2. Si ya existe, verifica que el valor sea correcto
3. Si no existe, crea un nuevo secret con:
   - **Name:** `APP_URL`
   - **Secret:** `https://macro-dashboard-seven.vercel.app`

### 3. `INGEST_KEY`

**Descripción:** Clave para endpoints de ingesta (`/api/news/insert`, `/api/calendar/insert`)

**Valor:** Debe coincidir con el `INGEST_KEY` configurado en Vercel Environment Variables

**Dónde configurarlo:**
1. Ve a **Settings** → **Secrets and variables** → **Actions**
2. Click en **New repository secret**
3. **Name:** `INGEST_KEY`
4. **Secret:** Usa el mismo valor que tienes en Vercel (ver `docs/VERCEL_ENV_VARS.md`)
5. Click **Add secret**

## Verificación

Después de configurar los secrets, puedes verificar que funcionan:

1. Ve a **Actions** en tu repositorio
2. Selecciona el workflow **Daily Macro Jobs**
3. Click en **Run workflow** → **Run workflow**
4. Verifica que el workflow se ejecuta sin errores de autenticación

## Secrets Configurados

| Secret | Estado | Uso |
|--------|--------|-----|
| `APP_URL` | ✅ Configurado | Usado por todos los workflows |
| `CRON_TOKEN` | ❌ **FALTA** | Usado por `daily-jobs.yml` |
| `INGEST_KEY` | ⚠️ Verificar | Usado por `news-calendar-ingest.yml` |

## Notas Importantes

- Los secrets son **sensibles** y no se muestran en los logs
- Si cambias un secret, los workflows existentes seguirán usando el valor anterior hasta que se ejecuten de nuevo
- Los secrets son específicos del repositorio
- Para usar en otros repositorios, necesitas configurarlos de nuevo

