# 🚀 Guía de Migración Segura a Vercel

## ✅ PASO 1: Inventario del Proyecto Actual

### 🔐 Variables de Entorno Requeridas

**OBLIGATORIAS:**
- `TURSO_DATABASE_URL` - URL de la base de datos Turso
- `TURSO_AUTH_TOKEN` - Token de autenticación de Turso
- `FRED_API_KEY` - API key de FRED para datos macroeconómicos
- `CRON_TOKEN` - Token para autenticar endpoints de jobs (`/api/jobs/*`)
- `INGEST_KEY` - Clave secreta para endpoints de ingesta (`/api/news/insert`, `/api/calendar/insert`)
- `APP_URL` - URL base de la aplicación (ej: `https://tu-proyecto.vercel.app`)

**OPCIONALES (solo si las usas):**
- `TELEGRAM_BOT_TOKEN` - Token del bot de Telegram
- `TELEGRAM_CHAT_ID` - ID del chat de Telegram
- `TELEGRAM_TEST_CHAT_ID` - ID del chat de Telegram para pruebas
- `FMP_API_KEY` - API key de Financial Modeling Prep
- `FINNHUB_API_KEY` - API key de Finnhub
- `NEWSAPI_KEY` - API key de NewsAPI
- `TRADING_ECONOMICS_API_KEY` - API key de Trading Economics
- `DATABASE_PATH` - Ruta personalizada de la base de datos (por defecto: `/tmp/macro.db` en Vercel)

### 🕒 Cron Jobs Actuales (según vercel.json)

| Ruta | Frecuencia | Método | Descripción |
|------|------------|--------|-------------|
| `/api/jobs/ingest/fred` | `0 6 * * *` (6:00 AM diario) | POST | Ingesta de datos FRED |
| `/api/jobs/ingest/european` | `0 7 * * *` (7:00 AM diario) | POST | Ingesta de datos europeos |
| `/api/jobs/ingest/calendar` | `0 8 * * *` (8:00 AM diario) | POST | Ingesta de calendario económico |
| `/api/jobs/daily/calendar` | `0 8 * * *` (8:00 AM diario) | POST | Actualización diaria de calendario |
| `/api/jobs/correlations` | `0 9 * * *` (9:00 AM diario) | POST | Cálculo de correlaciones |
| `/api/jobs/compute/bias` | `0 10 * * *` (10:00 AM diario) | POST | Cálculo de sesgos macro |
| `/api/jobs/weekly` | `0 18 * * 0` (6:00 PM domingos) | POST | Job semanal |

**Jobs adicionales disponibles (no en cron actual):**
- `/api/jobs/ingest/assets` - Ingesta de precios de activos (forex, índices, crypto)
- `/api/jobs/transform/indicators` - Transformación de indicadores (GDP QoQ, NFP Delta)
- `/api/jobs/ingest/releases` - Ingesta de releases económicos
- `/api/jobs/ingest/pmi` - Ingesta de datos PMI
- `/api/jobs/ingest/uk` - Ingesta de datos UK
- `/api/jobs/ingest/jp` - Ingesta de datos Japón

### 🌍 Dominios y Webhooks

**Verificar en el proyecto actual de Vercel:**
- [ ] ¿Hay algún dominio personalizado conectado? (ej: `dashboard.tudominio.com`)
- [ ] ¿Hay webhooks externos que llamen a rutas del dashboard?
- [ ] ¿Hay sistemas externos que dependan de URLs específicas?

---

## ✅ PASO 2: Crear Nuevo Proyecto en Vercel

### 2.1. Preparación

1. **Asegurar que el código está en GitHub:**
   ```bash
   git status
   git add .
   git commit -m "Preparación para migración a Vercel"
   git push origin main
   ```

2. **Verificar que `package.json` tiene Node 20:**
   ```json
   {
     "engines": {
       "node": "20.x"
     }
   }
   ```

### 2.2. Crear Proyecto Nuevo

1. **Ir a Vercel Dashboard:**
   - https://vercel.com
   - Iniciar sesión

2. **Crear Nuevo Proyecto:**
   - Click en **"Add New..."** → **"Project"**
   - Seleccionar **"Import from GitHub"**
   - Seleccionar el repositorio del dashboard
   - **Branch:** `main`
   - **Framework Preset:** Next.js (debería detectarse automáticamente)
   - **Root Directory:** `./` (raíz del proyecto)

3. **Configuración Inicial:**
   - **Project Name:** `macro-dashboard-new` (o nombre temporal)
   - **Environment Variables:** Dejar vacío por ahora (se configurará después)
   - Click en **"Deploy"**

4. **Esperar el primer deploy:**
   - El deploy inicial fallará por falta de variables de entorno
   - **Esto es normal y esperado**
   - Anotar la URL del nuevo proyecto: `https://macro-dashboard-new-xxxxx.vercel.app`

---

## ✅ PASO 3: Configurar Variables de Entorno

### 3.1. Acceder a Settings

1. En el proyecto nuevo de Vercel:
   - Click en **"Settings"** (menú superior)
   - Click en **"Environment Variables"** (menú lateral)

### 3.2. Añadir Variables Obligatorias

Para cada variable, seguir estos pasos:

1. **Click en "Add New"**
2. **Name:** Nombre de la variable (ej: `TURSO_DATABASE_URL`)
3. **Value:** Copiar el valor del proyecto antiguo
4. **Environments:** Marcar ✅ Production, ✅ Preview, ✅ Development
5. **Click en "Save"**

**Variables a añadir (en este orden):**

```
TURSO_DATABASE_URL=<valor del proyecto antiguo>
TURSO_AUTH_TOKEN=<valor del proyecto antiguo>
FRED_API_KEY=<valor del proyecto antiguo>
CRON_TOKEN=<valor del proyecto antiguo>
INGEST_KEY=<valor del proyecto antiguo>
APP_URL=https://macro-dashboard-new-xxxxx.vercel.app
```

**Nota:** `APP_URL` debe apuntar a la URL del proyecto nuevo.

### 3.3. Añadir Variables Opcionales (si existen)

Si el proyecto antiguo tiene estas variables, añadirlas también:
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `TELEGRAM_TEST_CHAT_ID`
- `FMP_API_KEY`
- `FINNHUB_API_KEY`
- `NEWSAPI_KEY`
- `TRADING_ECONOMICS_API_KEY`
- `DATABASE_PATH` (solo si se usa una ruta personalizada)

### 3.4. Redeploy

Después de añadir todas las variables:

1. Ir a **"Deployments"** (menú superior)
2. Click en los **"..."** (tres puntos) del último deployment
3. Click en **"Redeploy"**
4. Esperar a que termine el deploy

---

## ✅ PASO 4: Recrear Cron Jobs

### 4.1. Acceder a Cron Jobs

1. En el proyecto nuevo de Vercel:
   - Click en **"Settings"** → **"Cron Jobs"**

### 4.2. Añadir Cada Cron Job

Para cada job del inventario, seguir estos pasos:

1. **Click en "Add Cron Job"**
2. **Path:** Ruta del endpoint (ej: `/api/jobs/ingest/fred`)
3. **Schedule:** Frecuencia en formato cron (ej: `0 6 * * *`)
4. **Click en "Save"**

**Cron Jobs a crear:**

| Path | Schedule | Descripción |
|------|----------|-------------|
| `/api/jobs/ingest/fred` | `0 6 * * *` | 6:00 AM diario |
| `/api/jobs/ingest/european` | `0 7 * * *` | 7:00 AM diario |
| `/api/jobs/ingest/calendar` | `0 8 * * *` | 8:00 AM diario |
| `/api/jobs/daily/calendar` | `0 8 * * *` | 8:00 AM diario |
| `/api/jobs/correlations` | `0 9 * * *` | 9:00 AM diario |
| `/api/jobs/compute/bias` | `0 10 * * *` | 10:00 AM diario |
| `/api/jobs/weekly` | `0 18 * * 0` | 6:00 PM domingos |

**Cron Jobs adicionales recomendados:**

| Path | Schedule | Descripción |
|------|----------|-------------|
| `/api/jobs/ingest/assets` | `0 11 * * *` | 11:00 AM diario (después de correlations) |
| `/api/jobs/transform/indicators` | `0 6:30 * * *` | 6:30 AM diario (después de ingest/fred) |

**Nota:** Los cron jobs usarán automáticamente el `CRON_TOKEN` configurado en las variables de entorno.

---

## ✅ PASO 5: Ejecutar Jobs Manualmente para Poblar BD

### 5.1. Obtener CRON_TOKEN

1. En Vercel: **Settings** → **Environment Variables**
2. Buscar `CRON_TOKEN`
3. Click en el ojo 👁️ para ver el valor
4. Copiar el valor (lo necesitarás para los comandos curl)

### 5.2. Obtener URL del Proyecto

La URL será algo como: `https://macro-dashboard-new-xxxxx.vercel.app`

### 5.3. Ejecutar Jobs en Orden

**Importante:** Ejecutar en este orden para evitar dependencias:

```bash
# 1. Ingesta de datos FRED (base para todo)
curl -XPOST -H "Authorization: Bearer <CRON_TOKEN>" \
  https://<NUEVA_URL>/api/jobs/ingest/fred

# 2. Transformación de indicadores (depende de FRED)
curl -XPOST -H "Authorization: Bearer <CRON_TOKEN>" \
  https://<NUEVA_URL>/api/jobs/transform/indicators

# 3. Ingesta de datos europeos
curl -XPOST -H "Authorization: Bearer <CRON_TOKEN>" \
  https://<NUEVA_URL>/api/jobs/ingest/european

# 4. Ingesta de calendario económico
curl -XPOST -H "Authorization: Bearer <CRON_TOKEN>" \
  https://<NUEVA_URL>/api/jobs/ingest/calendar

# 5. Ingesta de precios de activos (necesario para correlaciones)
curl -XPOST -H "Authorization: Bearer <CRON_TOKEN>" \
  https://<NUEVA_URL>/api/jobs/ingest/assets

# 6. Cálculo de correlaciones (depende de assets)
curl -XPOST -H "Authorization: Bearer <CRON_TOKEN>" \
  https://<NUEVA_URL>/api/jobs/correlations

# 7. Cálculo de sesgos macro (depende de indicadores)
curl -XPOST -H "Authorization: Bearer <CRON_TOKEN>" \
  https://<NUEVA_URL>/api/jobs/compute/bias
```

**Ejemplo con valores reales:**
```bash
# Reemplazar <CRON_TOKEN> y <NUEVA_URL> con valores reales
CRON_TOKEN="tu_token_aqui"
NUEVA_URL="macro-dashboard-new-xxxxx.vercel.app"

curl -XPOST -H "Authorization: Bearer ${CRON_TOKEN}" \
  https://${NUEVA_URL}/api/jobs/ingest/fred

curl -XPOST -H "Authorization: Bearer ${CRON_TOKEN}" \
  https://${NUEVA_URL}/api/jobs/transform/indicators

# ... etc
```

### 5.4. Verificar Respuestas

Cada comando debería devolver algo como:
```json
{"success":true,"ingested":16,"errors":0,"duration_ms":8500}
```

Si hay errores, revisar los logs en Vercel:
- **Deployments** → Click en el deployment → **"Functions"** → Ver logs

---

## ✅ PASO 6: Verificar que Todo Funciona

### 6.1. Health Checks

```bash
# Health general
curl https://<NUEVA_URL>/api/health

# Health de base de datos
curl https://<NUEVA_URL>/api/health/db
```

**Respuesta esperada:**
```json
{
  "ok": true,
  "status": "healthy",
  "timestamp": "2025-12-11T15:00:00.000Z"
}
```

### 6.2. Verificar Indicadores Críticos

```bash
# Dashboard data
curl https://<NUEVA_URL>/api/dashboard | jq '.data.indicators[] | select(.key == "gdp_qoq" or .key == "payems_delta")'
```

**Valores esperados:**
- `gdp_qoq`: `value: 3.84` (aproximadamente), `date: "2025-04-01"`
- `payems_delta`: `value: 119` (aproximadamente), `date: "2025-09-01"`

**Si muestra "Dato pendiente":**
- Verificar que el job `/api/jobs/transform/indicators` se ejecutó correctamente
- Verificar logs del job en Vercel
- Re-ejecutar el job si es necesario

### 6.3. Verificar Correlaciones

```bash
# Correlaciones
curl https://<NUEVA_URL>/api/correlations | jq '. | length'
```

**Resultado esperado:**
- Aproximadamente 74 símbolos con correlaciones no-null
- Al menos los forex majors (EURUSD, GBPUSD, AUDUSD, etc.) deberían tener correlaciones

### 6.4. Verificar UI

1. **Abrir el dashboard en el navegador:**
   ```
   https://<NUEVA_URL>/dashboard
   ```

2. **Verificar:**
   - [ ] Badge verde (no amarillo/rojo)
   - [ ] Sin errores en consola del navegador (F12)
   - [ ] GDP QoQ muestra valor real (no "Dato pendiente")
   - [ ] NFP Delta muestra valor real (no "Dato pendiente")
   - [ ] Correlaciones se muestran (al menos algunos símbolos)
   - [ ] Dashboard carga sin errores

3. **Si hay problemas:**
   - Hard refresh: `Cmd+Shift+R` (Mac) o `Ctrl+Shift+R` (Windows)
   - Verificar logs en Vercel
   - Verificar que los jobs se ejecutaron correctamente

---

## ✅ PASO 7: Migrar Dominio (si existe)

### 7.1. Verificar Dominio Actual

En el proyecto antiguo de Vercel:
1. **Settings** → **Domains**
2. Anotar todos los dominios conectados

### 7.2. Quitar Dominio del Proyecto Antiguo

1. En el proyecto antiguo: **Settings** → **Domains**
2. Para cada dominio:
   - Click en los **"..."** (tres puntos)
   - Click en **"Remove"**
   - Confirmar

### 7.3. Añadir Dominio al Proyecto Nuevo

1. En el proyecto nuevo: **Settings** → **Domains**
2. Click en **"Add Domain"**
3. Escribir el dominio (ej: `dashboard.tudominio.com`)
4. Seguir las instrucciones de DNS
5. Esperar a que se verifique (puede tardar unos minutos)

### 7.4. Actualizar APP_URL

1. En el proyecto nuevo: **Settings** → **Environment Variables**
2. Editar `APP_URL`
3. Cambiar a la URL del dominio personalizado (ej: `https://dashboard.tudominio.com`)
4. Guardar y hacer Redeploy

### 7.5. Actualizar Webhooks Externos

Si hay sistemas externos que llaman a rutas del dashboard:
1. Identificar todos los sistemas
2. Actualizar sus URLs para apuntar al nuevo proyecto
3. Verificar que funcionan correctamente

---

## ✅ PASO 8: Borrar Proyecto Antiguo

### ⚠️ ADVERTENCIA: Solo hacer esto cuando:

- [x] El nuevo proyecto está funcionando correctamente
- [x] Todos los jobs están ejecutándose
- [x] El dominio está migrado (si aplica)
- [x] Los webhooks están actualizados (si aplica)
- [x] Has verificado que el dashboard funciona igual que en local
- [x] Has hecho pruebas durante al menos 24 horas

### 8.1. Pasos para Borrar

1. **Ir al proyecto antiguo en Vercel**
2. **Settings** → Scroll hasta el final
3. **Click en "Delete Project"**
4. **Escribir el nombre del proyecto para confirmar**
5. **Click en "Delete"**

**⚠️ Esta acción NO se puede deshacer.**

---

## 📋 Checklist Final de Migración

### Pre-Migración
- [x] Inventario de variables de entorno completado
- [x] Inventario de cron jobs completado
- [x] Inventario de dominios/webhooks completado
- [x] Código actualizado y pusheado a GitHub

### Migración
- [ ] Nuevo proyecto creado en Vercel
- [ ] Todas las variables de entorno configuradas
- [ ] Todos los cron jobs recreados
- [ ] Jobs ejecutados manualmente
- [ ] Health checks pasando
- [ ] Indicadores críticos verificados (GDP QoQ, NFP Delta)
- [ ] Correlaciones verificadas (~74 símbolos)
- [ ] UI verificada (sin errores, badge verde)

### Post-Migración
- [ ] Dominio migrado (si aplica)
- [ ] APP_URL actualizado con dominio personalizado
- [ ] Webhooks externos actualizados (si aplica)
- [ ] Pruebas durante 24 horas
- [ ] Proyecto antiguo borrado

---

## 🆘 Troubleshooting

### Problema: Deploy falla con error de variables

**Solución:**
- Verificar que todas las variables obligatorias están configuradas
- Verificar que están marcadas para Production
- Hacer Redeploy después de añadir variables

### Problema: Jobs devuelven 401 Unauthorized

**Solución:**
- Verificar que `CRON_TOKEN` está configurado correctamente
- Verificar que el header `Authorization: Bearer <TOKEN>` es correcto
- Verificar que el token coincide con el del proyecto antiguo

### Problema: Dashboard muestra "Dato pendiente"

**Solución:**
- Verificar que el job `/api/jobs/transform/indicators` se ejecutó
- Verificar logs del job en Vercel
- Re-ejecutar el job manualmente
- Hard refresh del navegador

### Problema: Correlaciones están vacías

**Solución:**
- Verificar que `/api/jobs/ingest/assets` se ejecutó correctamente
- Verificar que `/api/jobs/correlations` se ejecutó después
- Verificar logs de ambos jobs
- Verificar que DXY tiene datos en `asset_prices`

### Problema: Base de datos vacía

**Solución:**
- Ejecutar todos los jobs de ingest en orden
- Verificar que `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN` son correctos
- Verificar conexión a Turso desde Vercel

---

## 📝 Notas Importantes

1. **No borrar el proyecto antiguo hasta estar 100% seguro** de que el nuevo funciona
2. **Mantener ambos proyectos activos** durante al menos 24 horas para comparar
3. **Verificar logs regularmente** durante las primeras horas
4. **Tener un backup** de todas las variables de entorno antes de empezar
5. **Documentar cualquier cambio** en la configuración durante la migración

---

**Última actualización:** 2025-12-11


