# 🚀 Guía Completa de Producción - CM11 Trading Dashboard

Esta guía te llevará paso a paso para dejar el proyecto **100% autónomo en producción** usando Vercel + Turso.

---

## 📋 Índice

1. [Revisión del Proyecto en Vercel](#1-revisión-del-proyecto-en-vercel)
2. [Variables de Entorno](#2-variables-de-entorno-en-vercel)
3. [Base de Datos Turso](#3-base-de-datos-turso-en-producción)
4. [Cron Jobs Automáticos](#4-cron-jobs-jobs-automáticos-en-vercel)
5. [Configurar Dominio Propio](#5-configurar-el-dominio-propio)
6. [Verificación desde Producción](#6-verificación-desde-producción)
7. [Telegram (Notificaciones)](#7-telegram-si-activamos-notificaciones)
8. [Criterio de "Listo"](#8-criterio-de-listo)

---

## 1. Revisión del Proyecto en Vercel

### 1.1. Verificar Conexión con GitHub

1. Ve a [Vercel Dashboard](https://vercel.com/dashboard)
2. Selecciona tu proyecto **CM11 Trading**
3. Ve a **Settings** → **Git**
4. Verifica que:
   - ✅ Está conectado al repositorio correcto de GitHub
   - ✅ La rama de producción es `main`
   - ✅ Los deployments automáticos están activados

### 1.2. Anotar URL de Producción

1. Ve a **Settings** → **Domains**
2. Anota la URL de Vercel (ej: `https://cm11-macro-dashboard.vercel.app`)
3. **Esta será tu `APP_URL` temporal** hasta configurar el dominio propio

---

## 2. Variables de Entorno en Vercel

### 2.1. Acceder a Variables de Entorno

1. Ve a **Settings** → **Environment Variables**

### 2.2. Configurar Variables Obligatorias

Añade o verifica estas variables para **Production** (y opcionalmente Preview/Development):

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `TURSO_DATABASE_URL` | URL de tu base de datos Turso | `libsql://tu-db.turso.io` |
| `TURSO_AUTH_TOKEN` | Token de autenticación de Turso | `eyJ...` |
| `FRED_API_KEY` | API key de FRED | `ccc90330e6a50afa217fb55ac48c4d28` |
| `CRON_TOKEN` | Token secreto para proteger jobs | `tu-token-secreto-aleatorio` |

**⚠️ IMPORTANTE:** 
- Marca todas como **Production** (y Preview si quieres)
- No las marques como "Exposed" a menos que sea necesario

### 2.3. Configurar Variables Opcionales (Recomendadas)

| Variable | Descripción | Valor Recomendado |
|----------|-------------|-------------------|
| `TELEGRAM_BOT_TOKEN` | Token del bot de Telegram | `123456789:ABC...` |
| `TELEGRAM_CHAT_ID` | ID de tu chat de Telegram | `123456789` |
| `ENABLE_TELEGRAM_NOTIFICATIONS` | Activar notificaciones | `"true"` o `"false"` |
| `APP_URL` | URL de producción | Primero: URL de Vercel<br>Luego: Tu dominio final |

### 2.4. Redeploy Después de Cambios

Después de añadir o modificar variables:

1. Ve a **Deployments**
2. Haz clic en el menú (⋯) del último deployment
3. Selecciona **Redeploy**
4. Espera a que termine

**Alternativa:** Haz un pequeño cambio y push a `main` para forzar un nuevo deployment.

---

## 3. Base de Datos Turso en Producción

### 3.1. Verificar que se Usa Turso

El código detecta automáticamente Turso si `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN` están configuradas.

**Verificación:**

1. Abre en producción: `https://tu-dominio.com/api/diag`
2. Busca en la respuesta:
   ```json
   {
     "database": {
       "type": "Turso",
       "isProduction": true,
       "isVercel": true,
       "hasTursoUrl": true,
       "hasTursoToken": true
     }
   }
   ```

Si `type` es `"Turso"` → ✅ Correcto  
Si `type` es `"SQLite"` → ❌ Revisa las variables de entorno

### 3.2. Aplicar Migraciones en Turso

Las migraciones se aplican automáticamente al inicializar la base de datos, pero puedes verificarlas:

**Verificar tablas existentes:**

1. Accede a [Turso Dashboard](https://turso.tech/)
2. Selecciona tu base de datos
3. Ve a **Data** → **Tables**
4. Verifica que existen:
   - `macro_observations`
   - `macro_series`
   - `macro_bias`
   - `correlations`
   - `economic_events`
   - `economic_releases`

**Si faltan tablas o columnas:**

Las migraciones se ejecutan automáticamente en `lib/db/unified-db.ts` mediante `initializeSchemaUnified()`.

Si hay problemas, revisa los logs de Vercel para errores de migración.

---

## 4. Cron Jobs (Jobs Automáticos) en Vercel

### 4.1. Verificar vercel.json

El archivo `vercel.json` en la raíz del proyecto ya define los cron jobs:

```json
{
  "crons": [
    { "path": "/api/jobs/ingest/fred", "schedule": "0 6 * * *" },
    { "path": "/api/jobs/ingest/european", "schedule": "0 7 * * *" },
    { "path": "/api/jobs/ingest/calendar", "schedule": "0 8 * * *" },
    { "path": "/api/jobs/correlations", "schedule": "0 9 * * *" },
    { "path": "/api/jobs/compute/bias", "schedule": "0 10 * * *" },
    { "path": "/api/jobs/notify/calendar", "schedule": "*/5 * * * *" }
  ]
}
```

**Horarios:**
- `0 6 * * *` → 06:00 UTC (FRED)
- `0 7 * * *` → 07:00 UTC (Europeos)
- `0 8 * * *` → 08:00 UTC (Calendario)
- `0 9 * * *` → 09:00 UTC (Correlaciones)
- `0 10 * * *` → 10:00 UTC (Sesgos)
- `*/5 * * * *` → Cada 5 minutos (Notificaciones)

### 4.2. Verificar que Vercel Reconoce los Cron Jobs

1. Ve a Vercel → **Settings** → **Cron Jobs**
2. Deberías ver los cron jobs listados automáticamente desde `vercel.json`
3. Si no aparecen:
   - Verifica que `vercel.json` está en la raíz del proyecto
   - Verifica que está commiteado a `main`
   - Haz un nuevo deployment

### 4.3. Verificar Ejecución de Jobs

**Opción A: Logs de Vercel**

1. Ve a **Logs** en Vercel
2. Filtra por:
   - Environment: `Production`
   - Type: `Cron`
3. Busca ejecuciones recientes de los jobs

**Opción B: Endpoint de Diagnóstico**

Los jobs registran su ejecución. Puedes verificar en `/api/diag` o revisar los logs.

---

## 5. Configurar el Dominio Propio

### 5.1. Añadir Dominio en Vercel

1. Ve a **Settings** → **Domains**
2. Haz clic en **"Add Domain"**
3. Introduce tu dominio:
   - Dominio raíz: `mi-dominio.com`
   - O subdominio: `macro.mi-dominio.com`
4. Vercel te mostrará las instrucciones de DNS

### 5.2. Configurar DNS en el Proveedor

Sigue las instrucciones que te da Vercel:

**Para dominio raíz (`mi-dominio.com`):**
- Tipo: `A`
- Nombre: `@` o en blanco
- Valor: IP que te indique Vercel (ej: `76.76.21.21`)

**Para subdominio (`macro.mi-dominio.com`):**
- Tipo: `CNAME`
- Nombre: `macro`
- Valor: `cname.vercel-dns.com` (o el que te indique Vercel)

### 5.3. Esperar Propagación DNS

- CNAME: 5-15 minutos
- A: 15 minutos - 2 horas

Verifica en Vercel → **Domains** que el estado cambie a **"Valid"**.

### 5.4. Actualizar APP_URL

Una vez que el dominio funcione con HTTPS:

1. Ve a **Settings** → **Environment Variables**
2. Cambia `APP_URL` a: `https://mi-dominio.com` (o tu subdominio)
3. Marca para **Production**
4. Haz **Redeploy**

📚 **Guía detallada:** Ver [CONFIGURACION-DOMINIO.md](./CONFIGURACION-DOMINIO.md)

---

## 6. Verificación desde Producción

### 6.1. Probar Páginas Principales

Abre en tu navegador (usando tu dominio o URL de Vercel):

- ✅ `https://tu-dominio.com/dashboard`
- ✅ `https://tu-dominio.com/correlaciones`
- ✅ `https://tu-dominio.com/sesgos`
- ✅ `https://tu-dominio.com/calendario`

**Verifica:**
- No hay errores en la consola del navegador (F12)
- Las fechas de los datos son recientes
- Los datos se muestran correctamente

### 6.2. Verificar Endpoints de Diagnóstico

**Health Check:**
```bash
curl https://tu-dominio.com/api/health
```

**Respuesta esperada:**
```json
{
  "ready": true,
  "hasData": true,
  "observationCount": 50,
  "biasCount": 25,
  "correlationCount": 30,
  "latestDate": "2025-01-15",
  "database": {
    "type": "Turso",
    "isProduction": true,
    "isVercel": true
  }
}
```

**Diagnóstico:**
```bash
curl https://tu-dominio.com/api/diag
```

**Respuesta esperada:**
```json
{
  "t10y2y_last": {...},
  "unrate_last": {...},
  "gdpc1_len": 100,
  "lastIngestAt": "2025-01-15T10:00:00Z",
  "database": {
    "type": "Turso",
    "isProduction": true,
    "isVercel": true,
    "hasTursoUrl": true,
    "hasTursoToken": true
  }
}
```

### 6.3. Script de Verificación Automática

Ejecuta desde local (usando la URL de producción):

```bash
APP_URL=https://tu-dominio.com pnpm tsx scripts/verificar-produccion.ts
```

Este script verifica:
- ✅ Variables de entorno críticas
- ✅ Endpoints de salud
- ✅ Configuración de base de datos
- ✅ Cron jobs en `vercel.json`

---

## 7. Telegram (Si Activamos Notificaciones)

### 7.1. Configurar Variables

En Vercel → **Settings** → **Environment Variables**:

- `TELEGRAM_BOT_TOKEN`: Token de tu bot
- `TELEGRAM_CHAT_ID`: ID de tu chat
- `ENABLE_TELEGRAM_NOTIFICATIONS`: `"true"`

### 7.2. Redeploy

Haz redeploy después de configurar las variables.

### 7.3. Probar Notificaciones

**Opción A: Endpoint de Prueba**

```bash
curl -X POST https://tu-dominio.com/api/test/notifications
```

**Opción B: Esperar Evento Real**

El cron job `/api/jobs/notify/calendar` se ejecuta cada 5 minutos y enviará notificaciones automáticamente cuando haya eventos de alta importancia en las próximas 30 minutos.

### 7.4. Verificar Enlaces en Notificaciones

Los mensajes de Telegram deben usar `APP_URL` para los enlaces. Verifica que los enlaces apuntan a tu dominio final (no `vercel.app`).

📚 **Guía detallada:** Ver [CONFIGURACION-NOTIFICACIONES-CALENDARIO.md](./CONFIGURACION-NOTIFICACIONES-CALENDARIO.md)

---

## 8. Criterio de "Listo"

El proyecto está **100% listo para producción** cuando:

### ✅ Checklist Final

- [ ] Proyecto desplegado en Vercel desde la rama `main`
- [ ] Base de datos en producción es **Turso** (verificado en `/api/diag`)
- [ ] Todas las variables de entorno configuradas en Vercel
- [ ] Cron jobs se ejecutan automáticamente (verificado en logs)
- [ ] Dashboard accesible mediante tu dominio (`https://...`)
- [ ] Certificado SSL activo (HTTPS funciona)
- [ ] Endpoints `/api/health` y `/api/diag` responden correctamente
- [ ] Datos recientes en el dashboard (fechas actuales)
- [ ] Notificaciones de Telegram funcionan (si están activadas)

### 🧪 Prueba Final: Apagar tu Ordenador

1. Apaga tu ordenador personal
2. Desde otro dispositivo (móvil, tablet, otro PC):
   - Abre `https://tu-dominio.com/dashboard`
   - Verifica que carga correctamente
   - Verifica que los datos son recientes
3. Espera 24 horas y verifica que:
   - Los cron jobs se ejecutaron (revisa logs de Vercel)
   - Los datos se actualizaron automáticamente
   - Las notificaciones llegaron (si están activas)

**Si todo funciona → ✅ Producción 100% autónoma**

---

## 🐛 Solución de Problemas Comunes

### Problema: Base de datos muestra "SQLite" en `/api/diag`

**Causa:** Variables de entorno `TURSO_DATABASE_URL` o `TURSO_AUTH_TOKEN` no configuradas.

**Solución:**
1. Verifica en Vercel → Settings → Environment Variables
2. Asegúrate de que están marcadas para **Production**
3. Haz redeploy

### Problema: Cron jobs no se ejecutan

**Causa:** `vercel.json` no está en la raíz o no está commiteado.

**Solución:**
1. Verifica que `vercel.json` existe en la raíz del proyecto
2. Verifica que está commiteado a `main`
3. Haz push a `main` si falta
4. Verifica en Vercel → Settings → Cron Jobs que aparecen

### Problema: Datos antiguos en el dashboard

**Causa:** Los cron jobs no se han ejecutado aún o fallaron.

**Solución:**
1. Revisa los logs de Vercel para ver si hay errores en los jobs
2. Ejecuta manualmente los jobs desde la URL:
   ```bash
   curl -X POST https://tu-dominio.com/api/jobs/ingest/fred?token=TU_CRON_TOKEN
   ```
3. Verifica que `FRED_API_KEY` está configurada correctamente

### Problema: Dominio no funciona

**Causa:** DNS no propagado o configuración incorrecta.

**Solución:**
1. Verifica en Vercel → Domains el estado del dominio
2. Usa `dig` o `nslookup` para verificar la propagación DNS
3. Revisa [CONFIGURACION-DOMINIO.md](./CONFIGURACION-DOMINIO.md)

---

## 📚 Documentación Adicional

- [CHECKLIST-PRODUCCION.md](./CHECKLIST-PRODUCCION.md) - Checklist detallado paso a paso
- [RESUMEN-PRODUCCION-PARA-DEV.md](./RESUMEN-PRODUCCION-PARA-DEV.md) - Resumen ejecutivo
- [CONFIGURACION-DOMINIO.md](./CONFIGURACION-DOMINIO.md) - Guía de configuración de dominio
- [CONFIGURACION-NOTIFICACIONES-CALENDARIO.md](./CONFIGURACION-NOTIFICACIONES-CALENDARIO.md) - Configuración de Telegram

---

## 🎉 ¡Listo!

Una vez completado este checklist, tu dashboard **CM11 Trading** funcionará 100% autónomo en producción, accesible desde cualquier dispositivo, sin necesidad de que tu ordenador esté encendido.

**El sistema:**
- ✅ Se actualiza automáticamente cada día
- ✅ Envía notificaciones de eventos importantes
- ✅ Está disponible 24/7 desde tu dominio
- ✅ Funciona completamente sin tu ordenador











