# ✅ Checklist Final de Deployment - Nuevo Dashboard

## 🎯 Objetivo

Reemplazar el dashboard viejo (fondo blanco) por el nuevo dashboard (fondo oscuro) en el mismo proyecto Vercel, manteniendo Turso, cron jobs y dominio.

---

## 📋 Checklist Paso a Paso

### ✅ Pre-Deployment (Verificación Local)

- [ ] **Código está commiteado**
  ```bash
  git status
  # Debe mostrar "nothing to commit" o solo archivos que quieres incluir
  ```

- [ ] **vercel.json está correcto**
  - Debe tener 9 cron jobs nuevos
  - No debe tener `/api/jobs/daily-update` (es del proyecto viejo)
  - Verifica: `cat vercel.json`

- [ ] **Endpoints de diagnóstico funcionan**
  - `/api/health` y `/api/diag` están actualizados
  - Incluyen información de base de datos

- [ ] **Seguridad de tokens actualizada**
  - `lib/security/token.ts` acepta query params
  - `lib/security/cron.ts` acepta query params

---

### 🚀 Deployment (Pasos en Vercel)

#### Paso 1: Push del Código

- [ ] **Push a GitHub**
  ```bash
  git add .
  git commit -m "feat: nuevo dashboard con fondo oscuro - reemplazo completo"
  git push origin main
  ```

#### Paso 2: Verificar Deployment en Vercel

- [ ] **Esperar deployment automático**
  - Ve a Vercel → Deployments
  - Espera a que el último deployment termine (estado "Ready")

- [ ] **Revisar Build Logs**
  - Haz clic en el último deployment
  - Revisa "Build Logs"
  - ✅ No debe haber errores críticos
  - ⚠️ Advertencias menores están OK

- [ ] **Verificar que detecta Turso**
  - En logs busca: `[db] Using Turso database`
  - O prueba: `https://tu-dominio.com/api/diag`
  - Debe mostrar: `"database": { "type": "Turso" }`

#### Paso 3: Verificar Variables de Entorno

- [ ] **Todas las variables existen** (ya están configuradas, solo verificar):
  - `TURSO_DATABASE_URL` ✅
  - `TURSO_AUTH_TOKEN` ✅
  - `FRED_API_KEY` ✅
  - `CRON_TOKEN` ✅
  - `APP_URL` ✅
  - `TELEGRAM_BOT_TOKEN` (opcional) ✅
  - `TELEGRAM_CHAT_ID` (opcional) ✅
  - `ENABLE_TELEGRAM_NOTIFICATIONS` (opcional) ✅

- [ ] **Todas marcadas para Production**
  - Ve a Vercel → Settings → Environment Variables
  - Verifica que todas tienen "Production" marcado

#### Paso 4: Verificar Cron Jobs

- [ ] **Cron jobs nuevos aparecen en Vercel**
  - Ve a Vercel → Settings → Cron Jobs
  - Espera 5-10 minutos después del deployment
  - Deberías ver los 9 nuevos cron jobs

- [ ] **Si no aparecen:**
  - Haz Redeploy del último deployment
  - O espera más tiempo (Vercel puede tardar en detectarlos)

- [ ] **Cron jobs esperados:**
  - `/api/jobs/ingest/fred` → 06:00 UTC ✅
  - `/api/jobs/ingest/european` → 07:00 UTC ✅
  - `/api/jobs/ingest/calendar` → 08:00 UTC ✅
  - `/api/jobs/correlations` → 09:00 UTC ✅
  - `/api/jobs/compute/bias` → 10:00 UTC ✅
  - `/api/jobs/notify/calendar` → Cada 5 minutos ✅
  - `/api/jobs/daily/calendar` → 08:00 UTC ✅
  - `/api/jobs/weekly` → 18:00 UTC domingos ✅
  - `/api/jobs/ingest/releases` → Cada 5 minutos (8-20 UTC) ✅

- [ ] **Cron jobs antiguos (opcional):**
  - `/api/jobs/daily-update` puede seguir apareciendo
  - No hace daño, pero puedes eliminarlo manualmente si quieres

#### Paso 5: Verificar Dominio

- [ ] **Dominio sigue funcionando**
  - Ve a Vercel → Settings → Domains
  - Verifica que tu dominio aparece y está "Valid"
  - **No cambies nada**

- [ ] **Si el dominio cambió:**
  - Actualiza `APP_URL` en Vercel → Settings → Environment Variables
  - Haz Redeploy

---

### ✅ Post-Deployment (Verificación en Producción)

#### Verificación Visual

- [ ] **Dashboard oscuro visible**
  - Abre: `https://tu-dominio.com/dashboard`
  - ✅ Se ve el fondo oscuro (no blanco)
  - ✅ La interfaz es la nueva

- [ ] **Páginas principales funcionan**
  - `/dashboard` → Dashboard principal ✅
  - `/correlaciones` → Tabla de correlaciones ✅
  - `/sesgos` → Tabla de sesgos ✅
  - `/calendario` → Calendario de eventos ✅

#### Verificación de Datos

- [ ] **Datos recientes**
  - Las fechas son actuales (no "diciembre 2025")
  - Los datos se ven actualizados
  - No hay datos futuros o muy antiguos

- [ ] **Base de datos Turso**
  ```bash
  curl https://tu-dominio.com/api/diag
  ```
  - Debe mostrar: `"database": { "type": "Turso" }`
  - No debe mostrar: `"type": "SQLite"`

#### Verificación de Endpoints

- [ ] **Health check**
  ```bash
  curl https://tu-dominio.com/api/health
  ```
  - Debe responder: `"ready": true`
  - Debe incluir información de base de datos

- [ ] **Diagnóstico**
  ```bash
  curl https://tu-dominio.com/api/diag
  ```
  - Debe responder correctamente
  - Debe mostrar configuración de Turso

#### Verificación de Cron Jobs

- [ ] **Cron jobs ejecutándose**
  - Ve a Vercel → Settings → Cron Jobs
  - Haz clic en "View Logs" de algún job
  - Verifica que se ejecutan sin errores

- [ ] **Logs sin errores**
  - Ve a Vercel → Deployments → Último → Logs
  - No debe haber errores críticos
  - Las migraciones deben haberse ejecutado correctamente

---

## 🐛 Solución de Problemas Rápida

### ❌ Dashboard sigue siendo el viejo

**Solución:**
1. Limpia cache del navegador (Ctrl+Shift+R o Cmd+Shift+R)
2. Verifica que el último deployment es el nuevo
3. Espera a que termine completamente (estado "Ready")
4. Si sigue igual, haz Redeploy manual

### ❌ Cron jobs no aparecen

**Solución:**
1. Verifica que `vercel.json` está commiteado
2. Espera 5-10 minutos después del deployment
3. Haz Redeploy si no aparecen
4. Si sigue sin aparecer, puedes añadirlos manualmente en Vercel

### ❌ Base de datos muestra "SQLite"

**Solución:**
1. Ve a Vercel → Settings → Environment Variables
2. Verifica `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN`
3. Verifica que están marcadas para Production
4. Haz Redeploy

### ❌ Datos antiguos

**Solución:**
1. Los cron jobs se ejecutarán mañana a las 06:00 UTC
2. O ejecuta manualmente:
   ```bash
   curl -X POST "https://tu-dominio.com/api/jobs/ingest/fred?token=TU_CRON_TOKEN"
   ```

---

## ✅ Criterio de Éxito Final

Cuando completes este checklist, deberías tener:

- ✅ Dashboard oscuro visible en producción
- ✅ Datos macro recientes (no de diciembre 2025)
- ✅ Base de datos Turso funcionando
- ✅ Cron jobs ejecutándose automáticamente
- ✅ Endpoints funcionando correctamente
- ✅ Dominio funcionando sin cambios
- ✅ Sin errores en logs

---

## 📞 Si Necesitas Ayuda

1. Revisa los logs de Vercel
2. Revisa `INSTRUCCIONES-PARA-PROGRAMADOR.md`
3. Revisa `docs/GUIA-PRODUCCION-COMPLETA.md`

---

**¡Todo listo para el deployment! 🚀**







