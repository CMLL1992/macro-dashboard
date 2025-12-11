# ✅ Checklist: Verificación Local al 100%

Este documento guía la verificación paso a paso para asegurar que el dashboard funciona perfectamente en local antes de desplegar a Vercel.

---

## 📋 Paso 1: Código y Dependencias

### 1.1. Pull del código principal
```bash
git checkout main
git pull
```

### 1.2. Instalar dependencias
```bash
pnpm install
# o
npm install
```

### 1.3. Verificar versión de Node
```bash
node --version
# Debe ser 20.x (según package.json: "node": "20.x")
```

**✅ Checklist:**
- [ ] Código actualizado desde main/master
- [ ] Dependencias instaladas sin errores
- [ ] Node versión 20.x

---

## 🔐 Paso 2: Variables de Entorno

### 2.1. Crear/verificar .env.local

Copia `.env.local.example` a `.env.local` y completa los valores:

```bash
cp .env.local.example .env.local
```

### 2.2. Variables OBLIGATORIAS

**Base de Datos:**
- [ ] `TURSO_DATABASE_URL` - Si quieres usar Turso (misma DB que producción)
- [ ] `TURSO_AUTH_TOKEN` - Token de Turso
- ⚠️ **Opcional:** Si NO configuras Turso, se usará SQLite local (`macro.db`)

**API Keys:**
- [ ] `FRED_API_KEY` - API key de FRED (obligatorio para datos macro)

**Seguridad:**
- [ ] `CRON_TOKEN` - Token para proteger endpoints de jobs
- [ ] `INGEST_KEY` - Key para proteger endpoints de ingesta

**Configuración:**
- [ ] `APP_URL` - URL base (en local: `http://localhost:3000`)

### 2.3. Variables OPCIONALES

- [ ] `TELEGRAM_BOT_TOKEN` - Si usas Telegram
- [ ] `TELEGRAM_CHAT_ID` - Si usas Telegram
- [ ] `FMP_API_KEY` - Si usas Financial Modeling Prep
- [ ] `FINNHUB_API_KEY` - Si usas Finnhub
- [ ] `NEWSAPI_KEY` - Si usas NewsAPI
- [ ] `TRADING_ECONOMICS_API_KEY` - Si usas Trading Economics

**✅ Checklist:**
- [ ] Archivo `.env.local` existe en la raíz del proyecto
- [ ] Todas las variables obligatorias están configuradas
- [ ] Los valores coinciden con los de Vercel (si aplica)

---

## 🗄️ Paso 3: Conexión con Turso / Base de Datos

### 3.1. Probar conexión con script

```bash
pnpm tsx scripts/test-db.ts
```

**Resultado esperado:**
- ✅ Conexión exitosa
- ✅ Esquema inicializado
- ✅ Tablas existentes listadas
- ✅ Conteos de registros mostrados

### 3.2. Probar endpoint de health de DB

```bash
# Con el servidor corriendo (pnpm dev)
curl http://localhost:3000/api/health/db | jq
```

**Resultado esperado:**
```json
{
  "ok": true,
  "database": {
    "type": "Turso" o "SQLite",
    "url": "configured",
    "hasToken": true
  },
  "connection": {
    "test": "ok"
  },
  "health": {
    "connected": true,
    "hasData": true/false,
    "hasBias": true/false,
    "hasCorrelations": true/false
  }
}
```

**✅ Checklist:**
- [ ] Script `test-db.ts` ejecuta sin errores
- [ ] Endpoint `/api/health/db` responde con `ok: true`
- [ ] La base de datos está conectada correctamente
- [ ] Las tablas existen y están inicializadas

---

## 🔌 Paso 4: Endpoints de Datos

### 4.1. Health Check General

```bash
curl http://localhost:3000/api/health | jq
```

**Verificar:**
- [ ] Status 200
- [ ] `ready: true` o `ready: false` (según si hay datos)
- [ ] `database.type` muestra "Turso" o "SQLite"
- [ ] No hay errores en la respuesta

### 4.2. Dashboard

```bash
curl http://localhost:3000/api/dashboard | jq
```

**Verificar:**
- [ ] Status 200
- [ ] Estructura JSON correcta
- [ ] Datos reales (no mocks)
- [ ] Fechas recientes

### 4.3. Bias (Sesgos)

```bash
curl http://localhost:3000/api/bias | jq
```

**Verificar:**
- [ ] Status 200
- [ ] `regime` con valores válidos
- [ ] `table` con sesgos por par
- [ ] `tableTactical` con sesgos tácticos

### 4.4. Correlaciones

```bash
curl http://localhost:3000/api/correlations | jq
```

**Verificar:**
- [ ] Status 200
- [ ] `points` con correlaciones
- [ ] `windows` con ventanas temporales
- [ ] `updatedAt` con fecha reciente

### 4.5. Diagnóstico

```bash
curl http://localhost:3000/api/diag | jq
```

**Verificar:**
- [ ] Status 200
- [ ] `items` con indicadores
- [ ] `trends` con tendencias
- [ ] `categoryCounts` con conteos

**✅ Checklist:**
- [ ] Todos los endpoints responden con status 200
- [ ] Estructura JSON correcta en todos
- [ ] Datos reales (no mocks ni vacíos)
- [ ] Fechas recientes en los datos
- [ ] No hay errores en consola del servidor

---

## 🖥️ Paso 5: Dashboard en Modo Local

### 5.1. Levantar el servidor

```bash
pnpm dev
```

**Verificar:**
- [ ] Servidor inicia sin errores
- [ ] Escucha en `http://localhost:3000`
- [ ] No hay errores de compilación

### 5.2. Recorrer vistas principales

Abre en el navegador y verifica:

**Dashboard Principal (`/dashboard`):**
- [ ] Carga sin errores
- [ ] Muestra indicadores macro
- [ ] Muestra sesgos por par
- [ ] Muestra regímenes por moneda
- [ ] No hay errores en consola del navegador

**Correlaciones (`/correlations`):**
- [ ] Carga sin errores
- [ ] Muestra matriz de correlaciones
- [ ] Muestra shifts y summary
- [ ] No hay errores en consola

**Sesgos (`/sesgos`):**
- [ ] Carga sin errores
- [ ] Muestra sesgos tácticos
- [ ] No hay errores en consola

**Calendario (`/calendario`):**
- [ ] Carga sin errores
- [ ] Muestra eventos próximos
- [ ] No hay errores en consola

### 5.3. Verificar datos reales

**En cada vista, verificar:**
- [ ] No hay datos mock (si existe código de mock, debe estar deshabilitado)
- [ ] Las fechas son recientes (no de hace meses)
- [ ] Los valores coinciden con datos oficiales
- [ ] Los filtros y timeframes funcionan correctamente

### 5.4. Verificar consola del navegador

Abre DevTools (F12) → Console y verifica:
- [ ] No hay errores en rojo
- [ ] No hay warnings críticos
- [ ] Las llamadas a API se completan exitosamente

**✅ Checklist:**
- [ ] Servidor corre sin errores
- [ ] Todas las vistas principales cargan correctamente
- [ ] Datos reales (no mocks)
- [ ] Fechas recientes
- [ ] No hay errores en consola del navegador
- [ ] No hay errores en consola del servidor

---

## ⚙️ Paso 6: Jobs, Cron y Actualización de Datos

### 6.1. Probar job de ingesta FRED

```bash
# Con CRON_TOKEN configurado en .env.local
curl -X POST \
  -H "Authorization: Bearer ${CRON_TOKEN}" \
  http://localhost:3000/api/jobs/ingest/fred
```

**Verificar:**
- [ ] Status 200 o 201
- [ ] Respuesta indica éxito
- [ ] Datos se actualizan en la base de datos
- [ ] Dashboard refleja los nuevos datos

### 6.2. Probar job de correlaciones

```bash
curl -X POST \
  -H "Authorization: Bearer ${CRON_TOKEN}" \
  http://localhost:3000/api/jobs/correlations
```

**Verificar:**
- [ ] Status 200
- [ ] Correlaciones se calculan y guardan
- [ ] Endpoint `/api/correlations` muestra datos actualizados

### 6.3. Probar job de bias

```bash
curl -X POST \
  -H "Authorization: Bearer ${CRON_TOKEN}" \
  http://localhost:3000/api/jobs/compute/bias
```

**Verificar:**
- [ ] Status 200
- [ ] Sesgos se calculan y guardan
- [ ] Endpoint `/api/bias` muestra datos actualizados

### 6.4. Probar scripts manuales

```bash
# Bootstrap completo (fred + correlations + bias)
pnpm job:bootstrap

# O individualmente:
pnpm job:ingest:fred
pnpm job:correlations
pnpm job:bias
```

**Verificar:**
- [ ] Scripts ejecutan sin errores
- [ ] Usan las mismas variables de entorno que el servidor
- [ ] Datos se actualizan correctamente
- [ ] Dashboard refleja los cambios

**✅ Checklist:**
- [ ] Jobs se pueden ejecutar manualmente
- [ ] Funcionan con las variables de entorno de .env.local
- [ ] Datos se actualizan en la base de datos
- [ ] Dashboard refleja los cambios tras la actualización
- [ ] Scripts de package.json funcionan correctamente

---

## ✅ Paso 7: Checklist Final - "Local está al 100%"

Considera que el objetivo está cumplido cuando:

- [ ] ✅ El proyecto arranca en local sin errores (`pnpm dev`)
- [ ] ✅ Turso/SQLite responde correctamente (`/api/health/db` OK)
- [ ] ✅ Todos los endpoints (`/api/...`) devuelven datos reales y correctos
- [ ] ✅ El dashboard muestra indicadores, bits, correlaciones sin usar mocks
- [ ] ✅ No hay errores de consola en el navegador ni en el backend
- [ ] ✅ Se puede simular la actualización de datos (scripts/cron) en local y ver el resultado en el dashboard
- [ ] ✅ Todas las variables de entorno están configuradas correctamente
- [ ] ✅ La base de datos tiene datos reales (no está vacía)

---

## 🚀 Siguiente Paso: Vercel

Una vez que **TODOS** los items del checklist estén ✅, entonces puedes proceder a:

1. **Borrar el proyecto antiguo en Vercel**
2. **Crear proyecto nuevo desde cero**
3. **Configurar variables de entorno en Vercel** (copiar desde .env.local)
4. **Desplegar el código que ya funciona en local**

Ver documento: `GUIA-REDEPLOY-VERCEL.md` (si existe) o seguir las instrucciones del usuario.

---

## 🐛 Troubleshooting

### Error: "TURSO_DATABASE_URL not set"
- Verifica que `.env.local` existe y tiene `TURSO_DATABASE_URL`
- Si no quieres usar Turso, está bien - se usará SQLite local

### Error: "Cannot connect to database"
- Si usas Turso: verifica token y URL
- Si usas SQLite: verifica permisos de escritura en el directorio

### Error: "FRED_API_KEY not found"
- Verifica que `FRED_API_KEY` esté en `.env.local`
- Obtén una key en: https://fred.stlouisfed.org/docs/api/api_key.html

### Endpoints devuelven datos vacíos
- Ejecuta los jobs de ingesta: `pnpm job:bootstrap`
- Verifica que la base de datos tenga datos: `pnpm tsx scripts/test-db.ts`

### Dashboard muestra "—" o datos antiguos
- Ejecuta actualización de datos: `pnpm job:bootstrap`
- Verifica que los jobs se ejecuten correctamente
- Revisa logs del servidor para errores
