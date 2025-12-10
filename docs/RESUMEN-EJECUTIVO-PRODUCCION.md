# 📋 Resumen Ejecutivo - Producción CM11 Trading

**Objetivo:** Dejar el proyecto funcionando 100% autónomo en producción usando Vercel + Turso, accesible desde dominio propio, sin depender del ordenador personal.

---

## ✅ Checklist Rápido (5 minutos)

### 1. Vercel - Proyecto y GitHub
- [ ] Proyecto conectado a GitHub (rama `main`)
- [ ] URL de producción anotada: `___________________________`

### 2. Variables de Entorno (Vercel → Settings → Environment Variables)
- [ ] `TURSO_DATABASE_URL` ✅
- [ ] `TURSO_AUTH_TOKEN` ✅
- [ ] `FRED_API_KEY` ✅
- [ ] `CRON_TOKEN` ✅
- [ ] `APP_URL` → Primero URL de Vercel, luego dominio final
- [ ] `TELEGRAM_BOT_TOKEN` (opcional)
- [ ] `TELEGRAM_CHAT_ID` (opcional)
- [ ] `ENABLE_TELEGRAM_NOTIFICATIONS` = `"true"` (opcional)

### 3. Base de Datos Turso
- [ ] Variables de Turso configuradas → Se usa automáticamente
- [ ] Verificar en `/api/diag` que `database.type` = `"Turso"`

### 4. Cron Jobs
- [ ] `vercel.json` existe y está commiteado a `main`
- [ ] Vercel → Settings → Cron Jobs muestra los jobs automáticamente

### 5. Dominio Propio (Opcional pero Recomendado)
- [ ] Dominio añadido en Vercel → Settings → Domains
- [ ] DNS configurado en el proveedor del dominio
- [ ] Estado "Valid" en Vercel
- [ ] `APP_URL` actualizada al dominio final
- [ ] Redeploy realizado

### 6. Verificación Final
- [ ] `/api/health` responde correctamente
- [ ] `/api/diag` muestra `database.type: "Turso"`
- [ ] Dashboard carga con datos recientes
- [ ] Apagar ordenador → Dashboard sigue funcionando desde otro dispositivo

---

## 🚀 Pasos Detallados

### Paso 1: Revisar Proyecto en Vercel

1. Ve a [Vercel Dashboard](https://vercel.com/dashboard)
2. Selecciona tu proyecto **CM11 Trading**
3. Verifica:
   - ✅ Conectado al repo correcto de GitHub
   - ✅ Rama de producción: `main`
   - ✅ Deployments automáticos activados
4. Anota la URL de producción (ej: `https://cm11-macro-dashboard.vercel.app`)

---

### Paso 2: Configurar Variables de Entorno

**Ubicación:** Vercel → Settings → Environment Variables

**Variables Obligatorias:**

| Variable | Valor | Notas |
|----------|-------|-------|
| `TURSO_DATABASE_URL` | `libsql://...` | URL de tu base de datos Turso |
| `TURSO_AUTH_TOKEN` | `eyJ...` | Token de autenticación de Turso |
| `FRED_API_KEY` | `ccc90330e6a50afa217fb55ac48c4d28` | Tu API key de FRED |
| `CRON_TOKEN` | `tu-token-secreto` | Token para proteger jobs |

**Variables Opcionales:**

| Variable | Valor | Notas |
|----------|-------|-------|
| `APP_URL` | `https://tu-dominio.com` | Primero URL de Vercel, luego dominio final |
| `TELEGRAM_BOT_TOKEN` | `123456789:ABC...` | Token del bot de Telegram |
| `TELEGRAM_CHAT_ID` | `123456789` | ID del chat de Telegram |
| `ENABLE_TELEGRAM_NOTIFICATIONS` | `"true"` | Activar notificaciones |

**⚠️ IMPORTANTE:**
- Marca todas como **Production**
- Después de cambiar variables → **Redeploy**

---

### Paso 3: Verificar Base de Datos Turso

**Verificación Automática:**

El código detecta Turso automáticamente si las variables están configuradas.

**Verificar manualmente:**

1. Abre: `https://tu-dominio.com/api/diag`
2. Busca en la respuesta:
   ```json
   {
     "database": {
       "type": "Turso",  ← Debe decir "Turso"
       "isProduction": true,
       "hasTursoUrl": true,
       "hasTursoToken": true
     }
   }
   ```

Si dice `"SQLite"` → Revisa las variables de entorno.

---

### Paso 4: Cron Jobs Automáticos

**Configuración Automática:**

El archivo `vercel.json` ya define todos los cron jobs:

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

**Verificar:**

1. Ve a Vercel → Settings → Cron Jobs
2. Deberías ver los jobs listados automáticamente
3. Si no aparecen:
   - Verifica que `vercel.json` está en la raíz
   - Verifica que está commiteado a `main`
   - Haz push a `main` si falta

**Horarios:**
- 06:00 UTC → Ingesta FRED
- 07:00 UTC → Ingesta Europeos
- 08:00 UTC → Ingesta Calendario
- 09:00 UTC → Correlaciones
- 10:00 UTC → Cálculo de Sesgos
- Cada 5 minutos → Notificaciones de calendario

---

### Paso 5: Configurar Dominio Propio

**5.1. Añadir Dominio en Vercel**

1. Ve a Vercel → Settings → Domains
2. Haz clic en "Add Domain"
3. Introduce tu dominio: `mi-dominio.com` o `macro.mi-dominio.com`
4. Vercel te mostrará las instrucciones de DNS

**5.2. Configurar DNS**

Sigue las instrucciones de Vercel:

- **Dominio raíz:** Registro `A` con IP de Vercel
- **Subdominio:** Registro `CNAME` con `cname.vercel-dns.com`

**5.3. Esperar Propagación**

- CNAME: 5-15 minutos
- A: 15 minutos - 2 horas

Verifica en Vercel que el estado cambie a **"Valid"**.

**5.4. Actualizar APP_URL**

1. Ve a Vercel → Settings → Environment Variables
2. Cambia `APP_URL` a: `https://mi-dominio.com`
3. Marca para **Production**
4. Haz **Redeploy**

📚 **Guía detallada:** Ver [CONFIGURACION-DOMINIO.md](./CONFIGURACION-DOMINIO.md)

---

### Paso 6: Verificación Final

**6.1. Probar Endpoints**

```bash
# Health check
curl https://tu-dominio.com/api/health

# Diagnóstico
curl https://tu-dominio.com/api/diag
```

**Respuestas esperadas:**

`/api/health`:
```json
{
  "ready": true,
  "hasData": true,
  "database": {
    "type": "Turso",
    "isProduction": true
  }
}
```

`/api/diag`:
```json
{
  "database": {
    "type": "Turso",
    "hasTursoUrl": true,
    "hasTursoToken": true
  }
}
```

**6.2. Probar Páginas**

Abre en tu navegador:
- ✅ `https://tu-dominio.com/dashboard`
- ✅ `https://tu-dominio.com/correlaciones`
- ✅ `https://tu-dominio.com/sesgos`
- ✅ `https://tu-dominio.com/calendario`

**6.3. Script de Verificación Automática**

```bash
APP_URL=https://tu-dominio.com pnpm tsx scripts/verificar-produccion.ts
```

**6.4. Prueba Final: Apagar Ordenador**

1. Apaga tu ordenador personal
2. Desde otro dispositivo (móvil, tablet, otro PC):
   - Abre `https://tu-dominio.com/dashboard`
   - Verifica que carga correctamente
   - Verifica que los datos son recientes
3. Espera 24 horas y verifica:
   - Los cron jobs se ejecutaron (revisa logs de Vercel)
   - Los datos se actualizaron automáticamente
   - Las notificaciones llegaron (si están activas)

---

## 🐛 Solución de Problemas Rápidos

### Base de datos muestra "SQLite" en `/api/diag`
**Solución:** Verifica que `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN` están configuradas en Vercel → Settings → Environment Variables → Production

### Cron jobs no aparecen en Vercel
**Solución:** Verifica que `vercel.json` está en la raíz del proyecto y commiteado a `main`

### Dominio no funciona
**Solución:** Revisa [CONFIGURACION-DOMINIO.md](./CONFIGURACION-DOMINIO.md) para guía detallada de DNS

### Datos antiguos en el dashboard
**Solución:** 
1. Revisa logs de Vercel para errores en jobs
2. Ejecuta manualmente: `curl -X POST https://tu-dominio.com/api/jobs/ingest/fred?token=TU_CRON_TOKEN`

---

## 📚 Documentación Completa

- **[GUIA-PRODUCCION-COMPLETA.md](./GUIA-PRODUCCION-COMPLETA.md)** - Guía paso a paso completa
- **[CHECKLIST-PRODUCCION.md](./CHECKLIST-PRODUCCION.md)** - Checklist detallado
- **[CONFIGURACION-DOMINIO.md](./CONFIGURACION-DOMINIO.md)** - Configuración de dominio
- **[CONFIGURACION-NOTIFICACIONES-CALENDARIO.md](./CONFIGURACION-NOTIFICACIONES-CALENDARIO.md)** - Configuración de Telegram

---

## ✅ Criterio de "Listo"

El proyecto está **100% listo** cuando:

- ✅ Dashboard accesible desde `https://tu-dominio.com`
- ✅ Base de datos es **Turso** (verificado en `/api/diag`)
- ✅ Cron jobs ejecutándose automáticamente
- ✅ Datos recientes en el dashboard
- ✅ Apagando tu ordenador → Dashboard sigue funcionando desde otro dispositivo

---

## 🎉 ¡Listo!

Una vez completado este checklist, tu dashboard **CM11 Trading** funcionará 100% autónomo en producción, accesible desde cualquier dispositivo, sin necesidad de que tu ordenador esté encendido.

**El sistema:**
- ✅ Se actualiza automáticamente cada día
- ✅ Envía notificaciones de eventos importantes
- ✅ Está disponible 24/7 desde tu dominio
- ✅ Funciona completamente sin tu ordenador
