# 🔍 Verificación de Error 500 en /api/health

## 📋 Resumen del Problema

El endpoint `/api/health` está devolviendo error 500. Este documento guía la verificación paso a paso.

---

## ✅ Paso 1: Análisis del Código de /api/health

### Ubicación del Archivo
- **Ruta:** `app/api/health/route.ts`
- **Estado:** ✅ Archivo existe y está en la ubicación correcta para Next.js 14

### Configuración de Runtime
```typescript
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
```
- ✅ **Runtime:** `nodejs` (correcto, no Edge)
- ✅ **Dynamic:** `force-dynamic` (correcto para datos en tiempo real)

### Uso de Base de Datos
- ✅ Usa `getDB()` de `lib/db/schema.ts`
- ✅ `getDB()` usa `better-sqlite3` (requiere runtime Node.js, no Edge)
- ✅ El código detecta Vercel y usa `/tmp/macro.db` (único directorio escribible en Vercel)

### Manejo de Errores
- ✅ Tiene `try/catch` que captura errores
- ✅ Devuelve JSON con mensaje de error en caso de fallo
- ✅ Logs errores con `console.error('[api/health] Error:', error)`

### Dependencias de Variables de Entorno
- ❌ **NO depende directamente de variables de entorno**
- ✅ La base de datos se inicializa automáticamente si no existe
- ⚠️ **Posible problema:** Si la base de datos no puede crearse en `/tmp` en Vercel

---

## 🔍 Paso 2: Verificar Logs en Vercel

### Instrucciones para Revisar Logs

1. **Accede a Vercel Dashboard:**
   - Ve a: https://vercel.com
   - Inicia sesión
   - Selecciona el proyecto: `macro-dashboard` (o el nombre que tenga)

2. **Navega a Logs:**
   - Click en **"Monitoring"** o **"Logs"** en el menú superior
   - O ve directamente a: `https://vercel.com/[tu-usuario]/macro-dashboard/logs`

3. **Filtra los Logs:**
   - **Environment:** Selecciona `Production`
   - **Type:** Selecciona `Function` o `Serverless / Edge`
   - En el **buscador de logs**, escribe: `/api/health`

4. **Reproduce el Error:**
   - Abre en el navegador: `https://macro-dashboard-seven.vercel.app/api/health`
   - Esto generará una nueva entrada en los logs

5. **Revisa la Última Entrada:**
   - Busca la entrada más reciente relacionada con `/api/health`
   - Copia el mensaje de error completo y la traza (stack trace)

### Qué Buscar en los Logs

**Errores Comunes:**

1. **Error de Base de Datos:**
   ```
   [db] Error opening database at /tmp/macro.db
   Error: Cannot access /tmp directory in Vercel
   ```
   - **Causa:** Problema con permisos o acceso a `/tmp`

2. **Error de Tabla No Existe:**
   ```
   SQLITE_ERROR: no such table: macro_observations
   ```
   - **Causa:** La base de datos no se inicializó correctamente

3. **Error de Runtime:**
   ```
   better-sqlite3 requires Node.js runtime
   ```
   - **Causa:** El endpoint se está ejecutando en Edge runtime (no debería pasar)

4. **Error de Memoria:**
   ```
   Error: Cannot allocate memory
   ```
   - **Causa:** Límite de memoria en función serverless

---

## 🔧 Paso 3: Verificaciones de Código

### 3.1 Verificar Inicialización de Base de Datos

**Archivo:** `lib/db/schema.ts`

**Puntos a Verificar:**
- ✅ Detecta Vercel correctamente: `process.env.VERCEL || process.env.VERCEL_ENV || process.env.VERCEL_URL`
- ✅ Usa `/tmp/macro.db` en Vercel
- ✅ Crea el esquema automáticamente si no existe
- ✅ Usa `journal_mode = DELETE` en Vercel (no WAL)

**Posibles Problemas:**
- ⚠️ Si `/tmp` no es accesible, fallará
- ⚠️ Si la base de datos no se puede crear, fallará
- ⚠️ Si hay un error en `initializeSchema()`, fallará

### 3.2 Verificar Funciones de Lectura

**Archivo:** `lib/db/read-macro.ts`

**Funciones Usadas por /api/health:**
- `checkMacroDataHealth()` - Verifica estado de datos
- `getLatestObservationDate()` - Obtiene última fecha

**Puntos a Verificar:**
- ✅ Manejan errores con `try/catch`
- ✅ Retornan valores por defecto si fallan

---

## 📝 Paso 4: Variables de Entorno Esperadas

### Variables en Vercel (Production)

**Variables OBLIGATORIAS:**

| Variable | Descripción | Requerida para /api/health |
|----------|-------------|---------------------------|
| `FRED_API_KEY` | API key de FRED | ❌ No (solo para ingesta) |
| `CRON_TOKEN` | Token para jobs | ❌ No (solo para jobs protegidos) |
| `INGEST_KEY` | Key para ingesta | ❌ No (solo para ingesta) |
| `APP_URL` | URL de la app | ❌ No (solo para jobs) |

**Variables AUTOMÁTICAS de Vercel:**
- `VERCEL` - Siempre presente en Vercel
- `VERCEL_ENV` - `production`, `preview`, o `development`
- `VERCEL_URL` - URL de la instancia

**Variables OPCIONALES:**
- `DATABASE_PATH` - Ruta personalizada de BD (por defecto usa `/tmp/macro.db` en Vercel)
- `TELEGRAM_BOT_TOKEN` - Solo si usas Telegram
- `TELEGRAM_CHAT_ID` - Solo si usas Telegram

**⚠️ IMPORTANTE:** `/api/health` **NO requiere** ninguna variable de entorno específica. Si falla, es probablemente un problema de:
1. Base de datos no accesible
2. Tablas no inicializadas
3. Error en la inicialización del esquema

---

## 🔐 Paso 5: Secrets de GitHub Actions

### Secrets Esperados en GitHub

**Para referencia (no afectan a /api/health directamente):**

| Secret | Descripción | Valor Esperado |
|--------|-------------|----------------|
| `APP_URL` | URL de Vercel | `https://macro-dashboard-seven.vercel.app` |
| `CRON_TOKEN` | Token para jobs | `cbc3d1139031a75f4721ddb45bf8cca4a79b115d4c15ba83e1a1713898cdbc82` |
| `INGEST_KEY` | Key para ingesta | `cbc3d1139031a75f4721ddb45bf8cca4a79b115d4c15ba83e1a1713898cdbc82` |
| `FRED_API_KEY` | API key de FRED | `ccc90330e6a50afa217fb55ac48c4d28` |

**Verificación:**
1. Ve a: https://github.com/CMLL1992/macro-dashboard/settings/secrets/actions
2. Verifica que existan estos secrets (solo nombres, no valores)
3. **Nota:** Estos secrets NO afectan directamente a `/api/health`, solo a los jobs automatizados

---

## 🛠️ Paso 6: Soluciones Comunes

### Solución 1: Base de Datos No Inicializada

**Síntoma:** Error `no such table: macro_observations`

**Solución:**
1. La base de datos se inicializa automáticamente en la primera llamada
2. Si falla, verifica que `/tmp` sea accesible
3. Verifica logs de inicialización: `[db] Initializing database at: /tmp/macro.db`

### Solución 2: Error de Permisos en /tmp

**Síntoma:** `Cannot access /tmp directory in Vercel`

**Solución:**
- `/tmp` debería ser siempre accesible en Vercel
- Si falla, puede ser un problema temporal de Vercel
- Intenta hacer un redeploy

### Solución 3: Base de Datos Corrupta

**Síntoma:** Errores SQLite inesperados

**Solución:**
1. En Vercel, la base de datos se recrea en cada deploy si está corrupta
2. Haz un redeploy forzado
3. O añade lógica para recrear la BD si detecta corrupción

### Solución 4: Memoria Insuficiente

**Síntoma:** `Cannot allocate memory`

**Solución:**
- Verifica el plan de Vercel (Hobby tiene límites)
- Considera usar una base de datos externa (PostgreSQL, etc.) si el proyecto crece

---

## 📊 Paso 7: Comandos de Verificación

### Verificar Endpoint Localmente

```bash
# Desde la raíz del proyecto
cd /Users/carlosmontagutllarch/Desktop/macro-dashboard-with-data

# Ejecutar servidor local
pnpm dev

# En otra terminal, probar el endpoint
curl http://localhost:3000/api/health | jq
```

### Verificar Endpoint en Producción

```bash
# Probar endpoint en Vercel
curl "https://macro-dashboard-seven.vercel.app/api/health" | jq

# Ver respuesta completa (incluyendo headers)
curl -v "https://macro-dashboard-seven.vercel.app/api/health"
```

### Verificar Base de Datos Localmente

```bash
# Verificar que la BD existe
ls -la data/macro.db

# Verificar esquema (requiere sqlite3 instalado)
sqlite3 data/macro.db ".tables"
sqlite3 data/macro.db "SELECT COUNT(*) FROM macro_observations;"
```

---

## 📋 Checklist de Verificación

### Antes de Revisar Logs
- [ ] Código de `/api/health` revisado
- [ ] Runtime configurado como `nodejs` (no Edge)
- [ ] Manejo de errores presente

### Revisión de Logs
- [ ] Acceso a Vercel Dashboard
- [ ] Filtros aplicados (Production, Function, `/api/health`)
- [ ] Error reproducido en navegador
- [ ] Última entrada de log revisada
- [ ] Mensaje de error copiado
- [ ] Stack trace copiado

### Verificación de Variables
- [ ] Variables de entorno en Vercel listadas
- [ ] Secrets de GitHub listados
- [ ] Confirmado que `/api/health` no requiere variables específicas

### Próximos Pasos
- [ ] Error identificado en logs
- [ ] Solución aplicada según tipo de error
- [ ] Endpoint verificado después de la solución

---

## 🎯 Información Necesaria para Continuar

Para poder ayudar mejor, necesito:

1. **Mensaje de Error Completo de los Logs:**
   - Copia la línea de error de Vercel
   - Incluye el stack trace si está disponible
   - Tapa cualquier dato sensible si es necesario

2. **Variables de Entorno en Vercel (solo nombres):**
   - Lista de variables configuradas en Production
   - No necesito los valores, solo los nombres

3. **Secrets de GitHub (solo nombres):**
   - Lista de secrets configurados
   - No necesito los valores, solo los nombres

4. **Resultado de Prueba Local (opcional):**
   - Si puedes probar localmente, ¿funciona?
   - ¿Qué error obtienes localmente?

---

## 📚 Archivos Relacionados

- `app/api/health/route.ts` - Endpoint de health
- `lib/db/schema.ts` - Inicialización de base de datos
- `lib/db/read-macro.ts` - Funciones de lectura de datos
- `RESUMEN-VERIFICACION.md` - Resumen general de verificación

---

**Última actualización:** $(date +"%d/%m/%Y %H:%M")  
**Estado:** Pendiente de revisión de logs de Vercel

