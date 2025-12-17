# 📊 Estado Actual de la Migración a Producción 24/7

**Fecha:** 2025-01-XX  
**URL Producción:** https://macro-dashboard-seven.vercel.app

---

## ✅ Lo que YA está implementado

### 1. Código preparado para producción
- ✅ **Base de datos unificada** (`lib/db/unified-db.ts`)
  - Detecta automáticamente Turso si `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN` están configurados
  - Fallback a SQLite local en desarrollo
  - Schema completo con todas las tablas necesarias

- ✅ **Sistema de seguridad** (`lib/security/token.ts`)
  - Protección de endpoints con `CRON_TOKEN`
  - Permite localhost en desarrollo sin token
  - Requiere token en producción (Vercel)

- ✅ **Cron jobs configurados** (`vercel.json`)
  - Ingesta FRED: `0 6 * * *` (06:00 UTC)
  - Ingesta Europea: `0 7 * * *` (07:00 UTC)
  - Ingesta Calendario: `0 8 * * *` (08:00 UTC)
  - Cálculo Correlaciones: `0 9 * * *` (09:00 UTC)
  - Cálculo Sesgos: `0 10 * * *` (10:00 UTC)
  - Job Semanal: `0 18 * * 0` (Domingo 18:00 UTC)

- ✅ **Endpoints de jobs protegidos**
  - Todos los endpoints en `/api/jobs/*` requieren `CRON_TOKEN`
  - Validación implementada en `validateCronToken()`

### 2. Proyecto en Vercel
- ✅ URL de producción: `https://macro-dashboard-seven.vercel.app`
- ✅ Dashboard funcional y estable
- ✅ API endpoints respondiendo correctamente

---

## ⚠️ Lo que FALTA por verificar/configurar

### 1. Variables de entorno en Vercel

**Variables OBLIGATORIAS que deben estar configuradas:**

- [ ] **`TURSO_DATABASE_URL`**
  - URL de la base de datos Turso
  - Formato: `libsql://macro-dashboard-xxxxx.turso.io`
  - **Acción:** Verificar en Vercel Dashboard → Settings → Environment Variables

- [ ] **`TURSO_AUTH_TOKEN`**
  - Token de autenticación de Turso
  - **Acción:** Verificar en Vercel Dashboard → Settings → Environment Variables

- [ ] **`FRED_API_KEY`**
  - API key de FRED para obtener datos macro
  - Ejemplo: `ccc90330e6a50afa217fb55ac48c4d28`
  - **Acción:** Verificar en Vercel Dashboard → Settings → Environment Variables

- [ ] **`CRON_TOKEN`**
  - Token para proteger endpoints de jobs
  - Debe ser una cadena aleatoria segura
  - **Acción:** Generar y configurar en Vercel

**Variables OPCIONALES:**

- [ ] **`TELEGRAM_BOT_TOKEN`** (si usas Telegram)
- [ ] **`TELEGRAM_CHAT_ID`** (si usas Telegram)
- [ ] **`ENABLE_TELEGRAM_NOTIFICATIONS`** = `"true"` (si quieres notificaciones)
- [ ] **`APP_URL`** = `https://macro-dashboard-seven.vercel.app`

### 2. Base de datos Turso

**Verificación necesaria:**

- [ ] ¿Existe una base de datos Turso creada?
  - Si NO: Crear base de datos en Turso
  - Si SÍ: Verificar que la URL y token estén correctos

- [ ] ¿Las variables `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN` están en Vercel?
  - Si NO: Configurarlas en Vercel Dashboard

- [ ] ¿El schema se ha inicializado en Turso?
  - El código intenta inicializar automáticamente
  - Verificar en logs de Vercel si hay errores

**Pasos para crear Turso (si no existe):**

1. Instalar CLI de Turso:
   ```bash
   curl -sSfL https://get.tur.so/install.sh | bash
   ```

2. Iniciar sesión:
   ```bash
   turso auth login
   ```

3. Crear base de datos:
   ```bash
   turso db create macro-dashboard
   ```

4. Crear token:
   ```bash
   turso db tokens create macro-dashboard
   ```

5. Obtener URL:
   ```bash
   turso db show macro-dashboard --url
   ```

### 3. Cron Jobs en Vercel

**Verificación necesaria:**

- [ ] ¿Los cron jobs están activos en Vercel?
  - Verificar en Vercel Dashboard → Settings → Cron Jobs
  - O verificar que `vercel.json` esté en el repo y se haya desplegado

- [ ] ¿Los cron jobs se están ejecutando?
  - Revisar logs de Vercel para ver ejecuciones
  - Verificar que no hay errores 401 (token inválido)

**Nota:** Los cron jobs en `vercel.json` se activan automáticamente al hacer deploy. Solo necesitas verificar que estén ejecutándose.

### 4. Migración de datos (si aplica)

**Si ya tienes datos en SQLite local:**

- [ ] Exportar datos de SQLite local
- [ ] Importar datos a Turso
- [ ] Verificar que los datos se migraron correctamente

**Si es un proyecto nuevo:**

- [ ] Ejecutar jobs de ingesta manualmente la primera vez
- [ ] Verificar que los datos se guardaron en Turso

---

## 🎯 Plan de Acción Inmediato

### Paso 1: Verificar/Crear Turso (15 min)

1. **Verificar si Turso ya existe:**
   ```bash
   turso db list
   ```

2. **Si NO existe, crear:**
   ```bash
   turso auth login
   turso db create macro-dashboard
   turso db tokens create macro-dashboard
   turso db show macro-dashboard --url
   ```

3. **Anotar:**
   - URL: `libsql://macro-dashboard-xxxxx.turso.io`
   - Token: `eyJ...` (el token completo)

### Paso 2: Configurar Variables en Vercel (10 min)

1. Ir a: https://vercel.com/dashboard
2. Seleccionar proyecto: `macro-dashboard-with-data` (o el nombre correcto)
3. Ir a: **Settings** → **Environment Variables**
4. Añadir/verificar:

   ```
   TURSO_DATABASE_URL = libsql://macro-dashboard-xxxxx.turso.io
   TURSO_AUTH_TOKEN = eyJ... (token completo)
   FRED_API_KEY = ccc90330e6a50afa217fb55ac48c4d28 (o tu key)
   CRON_TOKEN = [generar token aleatorio seguro]
   ```

5. **IMPORTANTE:** Marcar todas como disponibles en:
   - ✅ Production
   - ✅ Preview
   - ✅ Development (opcional)

6. **Hacer Redeploy:**
   - Ir a **Deployments**
   - Clic en "..." del último deployment
   - Seleccionar "Redeploy"

### Paso 3: Generar CRON_TOKEN (5 min)

```bash
# Generar token aleatorio seguro
openssl rand -hex 32
```

O usar cualquier generador de tokens aleatorios. Copiar el resultado y añadirlo como `CRON_TOKEN` en Vercel.

### Paso 4: Verificar que funciona (10 min)

1. **Verificar base de datos:**
   ```bash
   curl https://macro-dashboard-seven.vercel.app/api/diag
   ```
   - Debe mostrar que está usando Turso (no SQLite)

2. **Verificar endpoints:**
   ```bash
   curl https://macro-dashboard-seven.vercel.app/api/status/health
   ```
   - Debe devolver `{ "status": "ok" }`

3. **Verificar cron jobs (desde Vercel Dashboard):**
   - Ir a **Deployments** → **Functions** → Ver logs
   - O esperar a que se ejecuten según el schedule

### Paso 5: Ejecutar primera ingesta manual (10 min)

Para poblar la base de datos inicialmente:

```bash
# Desde tu PC (con CRON_TOKEN configurado)
curl -X POST \
  -H "Authorization: Bearer TU_CRON_TOKEN" \
  https://macro-dashboard-seven.vercel.app/api/jobs/ingest/fred

curl -X POST \
  -H "Authorization: Bearer TU_CRON_TOKEN" \
  https://macro-dashboard-seven.vercel.app/api/jobs/ingest/european

curl -X POST \
  -H "Authorization: Bearer TU_CRON_TOKEN" \
  https://macro-dashboard-seven.vercel.app/api/jobs/ingest/calendar
```

O usar el panel admin en `/admin` (si tienes acceso).

---

## 🔍 Verificación Final

Una vez completados los pasos, verificar:

- [ ] ✅ Dashboard carga en producción: `https://macro-dashboard-seven.vercel.app/dashboard`
- [ ] ✅ Datos se muestran correctamente (no hay "—" en todos los campos)
- [ ] ✅ Base de datos es Turso (verificar en `/api/diag`)
- [ ] ✅ Cron jobs están programados (verificar en Vercel Dashboard)
- [ ] ✅ Los datos se actualizan automáticamente (esperar 24h y verificar)

---

## 📝 Notas Importantes

1. **Variables de entorno:** Después de añadir/modificar variables en Vercel, **SIEMPRE** haz "Redeploy" para aplicar los cambios.

2. **Cron jobs:** Los cron jobs en `vercel.json` se activan automáticamente. No necesitas configurarlos manualmente en el Dashboard (a menos que quieras cambiar el schedule).

3. **Primera ejecución:** La primera vez, ejecuta los jobs manualmente para poblar la base de datos. Después, los cron jobs se encargarán automáticamente.

4. **Logs:** Revisa los logs de Vercel regularmente para detectar errores:
   - Vercel Dashboard → Deployments → [Último deployment] → Functions → Ver logs

---

## 🚨 Troubleshooting

### Los datos no se actualizan

1. Verificar que los cron jobs están configurados en Vercel
2. Revisar logs de Vercel para ver errores
3. Verificar que `CRON_TOKEN` está configurado correctamente
4. Verificar que `FRED_API_KEY` y otras API keys están configuradas

### La base de datos está vacía

1. Verificar que `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN` están configurados
2. Ejecutar manualmente los jobs de ingesta desde la URL de producción
3. Verificar que los datos se guardaron en Turso (usar CLI de Turso)

### Error 401 en cron jobs

1. Verificar que `CRON_TOKEN` está configurado en Vercel
2. Verificar que los cron jobs en Vercel incluyen el header de autorización
3. Nota: Los cron jobs de Vercel automáticamente añaden el token si está configurado en `vercel.json`

---

## ✅ Checklist Final

Antes de considerar el proyecto 100% autónomo:

- [ ] ✅ Variables de entorno configuradas en Vercel
- [ ] ✅ Base de datos Turso creada y conectada
- [ ] ✅ CRON_TOKEN generado y configurado
- [ ] ✅ Primeros datos ingeridos manualmente
- [ ] ✅ Cron jobs verificados en Vercel Dashboard
- [ ] ✅ Dashboard funciona en producción
- [ ] ✅ Datos se muestran correctamente
- [ ] ✅ Logs sin errores críticos

**Una vez completado todo esto, el dashboard funcionará 24/7 sin necesidad de tener tu PC abierto.** 🎉









