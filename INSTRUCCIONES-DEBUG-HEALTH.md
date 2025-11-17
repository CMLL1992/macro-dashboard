# 🔍 Instrucciones para Debug de /api/health

## 📋 Resumen de Pasos

Este documento guía el proceso de debugging del error 500 en `/api/health` paso a paso.

---

## ✅ Paso 1: Ver el Error Real en Vercel

### Instrucciones para Revisar Logs

1. **Accede a Vercel Dashboard:**
   - Ve a: https://vercel.com
   - Inicia sesión
   - Selecciona el proyecto: `macro-dashboard` (o el nombre que tenga)

2. **Navega a Logs:**
   - Click en **"Monitoring"** o **"Logs"** en el menú superior
   - O ve directamente a: `https://vercel.com/[tu-usuario]/macro-dashboard/logs`

3. **Aplica Filtros:**
   - **Environment:** Selecciona `Production`
   - **Type:** Selecciona `Function` o `Serverless / Edge`
   - En el **buscador de logs**, escribe: `/api/health`

4. **Reproduce el Error:**
   - Abre en tu navegador: `https://macro-dashboard-seven.vercel.app/api/health`
   - Esto generará una nueva entrada en los logs

5. **Revisa la Última Entrada:**
   - Busca la entrada más reciente relacionada con `/api/health`
   - **Copia el mensaje de error completo** (la primera línea del error)
   - **Copia la traza (stack trace)** si está disponible

### Qué Buscar

**Ejemplos de mensajes de error comunes:**

- `[db] Error opening database at /tmp/macro.db`
- `SQLITE_ERROR: no such table: macro_observations`
- `better-sqlite3 requires Node.js runtime`
- `Error: Cannot access /tmp directory in Vercel`
- `Error: Cannot allocate memory`

**🔁 Lo que necesitamos:**
- El mensaje de error principal que aparece en los logs
- Con esa frase podremos identificar exactamente qué está fallando

---

## ✅ Paso 2: Aislar si el Problema es la Ruta o la Base de Datos

### Objetivo

Determinar si:
- **Falla la ruta en sí misma** (problema de configuración de Vercel)
- **Falla al tocar la base de datos** (problema específico de SQLite)

### Proceso

#### 2.1 Probar Versión Simplificada Localmente

1. **Haz backup del archivo actual:**
   ```bash
   cd /Users/carlosmontagutllarch/Desktop/macro-dashboard-with-data
   cp app/api/health/route.ts app/api/health/route.ts.backup
   ```

2. **Usa la versión simplificada:**
   ```bash
   cp app/api/health/route.simple.ts app/api/health/route.ts
   ```

3. **Prueba localmente:**
   ```bash
   pnpm dev
   ```

4. **En otra terminal, prueba el endpoint:**
   ```bash
   curl http://localhost:3000/api/health | jq
   ```

5. **Resultado esperado:**
   ```json
   {
     "status": "ok",
     "message": "Health check simplificado - sin acceso a base de datos",
     "timestamp": "2024-01-15T10:00:00.000Z",
     "environment": "development",
     "isVercel": false,
     "test": {
       "canAccessProcess": true,
       "canAccessEnv": true,
       "nodeVersion": "v20.x.x"
     }
   }
   ```

**Si funciona localmente:** El problema está en la base de datos o en la configuración de producción.

**Si no funciona localmente:** Hay un problema más profundo con la configuración del proyecto.

#### 2.2 Desplegar Versión Simplificada a Vercel

1. **Commit y push:**
   ```bash
   git add app/api/health/route.ts
   git commit -m "test: versión simplificada de /api/health para debugging"
   git push origin main
   ```

2. **Espera a que Vercel despliegue** (1-2 minutos)

3. **Prueba en producción:**
   ```bash
   curl https://macro-dashboard-seven.vercel.app/api/health | jq
   ```

4. **Interpretación de resultados:**

   **✅ Si funciona en producción con versión simplificada:**
   - El problema está en el acceso a la base de datos
   - Continúa con Paso 3

   **❌ Si NO funciona en producción con versión simplificada:**
   - El problema es más profundo (configuración de Vercel, runtime, etc.)
   - Revisa la configuración del proyecto en Vercel
   - Verifica que el runtime sea Node.js

#### 2.3 Restaurar Versión Original

Una vez terminadas las pruebas:

```bash
# Restaurar versión original
cp app/api/health/route.ts.backup app/api/health/route.ts

# O si prefieres, la versión mejorada ya está en route.ts
# (tiene mejor manejo de errores)
```

---

## ✅ Paso 3: Revisar Problemas de Base de Datos

### Sospecha Principal: Base de Datos en /tmp

En Vercel, la base de datos se guarda en `/tmp/macro.db`. Problemas comunes:

1. **No se puede crear el archivo**
2. **No se puede abrir**
3. **Falta inicializar el esquema (las tablas)**
4. **El archivo se ha quedado corrupto**

### Verificaciones que Cursor Debe Hacer

#### 3.1 Verificar Inicialización de Base de Datos

**Archivo:** `lib/db/schema.ts`

**Puntos a verificar:**
- ✅ La función `getDB()` detecta Vercel correctamente
- ✅ Usa `/tmp/macro.db` en Vercel
- ✅ Crea el archivo automáticamente si no existe
- ✅ Inicializa el esquema (tablas) automáticamente
- ✅ Maneja errores de inicialización

**Código relevante:**
```typescript
// En lib/db/schema.ts
const isVercel = !!(process.env.VERCEL || process.env.VERCEL_ENV || process.env.VERCEL_URL)
const DB_PATH = isVercel ? '/tmp/macro.db' : join(process.cwd(), 'data', 'macro.db')
```

#### 3.2 Verificar Manejo de Base de Datos Vacía

**Archivo:** `app/api/health/route.ts` (versión mejorada)

**Puntos a verificar:**
- ✅ Maneja el caso de base de datos no inicializada
- ✅ Maneja el caso de tablas no existentes
- ✅ Retorna valores por defecto en lugar de fallar
- ✅ Logs errores específicos para debugging

**La versión mejorada ya incluye:**
- Verificación de existencia de tablas antes de consultarlas
- Manejo de errores por cada operación de BD
- Respuestas con valores por defecto si algo falla

---

## ✅ Paso 4: Verificar Variables de Entorno

### Variables en Vercel (solo verificar que existen)

**Variables OBLIGATORIAS que deben existir:**
- [ ] `FRED_API_KEY`
- [ ] `CRON_TOKEN`
- [ ] `INGEST_KEY`
- [ ] `APP_URL`

**Nota:** `/api/health` NO requiere estas variables, pero es bueno verificar que existan.

### Secrets en GitHub (solo verificar que existen)

**Secrets OBLIGATORIOS que deben existir:**
- [ ] `APP_URL`
- [ ] `CRON_TOKEN`
- [ ] `INGEST_KEY`
- [ ] `FRED_API_KEY`

**Verificación:**
1. Ve a: https://github.com/CMLL1992/macro-dashboard/settings/secrets/actions
2. Verifica que existan estos secrets (solo nombres, no valores)

---

## 📊 Resumen de Resultados Esperados

### Escenario 1: Versión Simplificada Funciona en Producción

**Diagnóstico:** El problema está en el acceso a la base de datos.

**Siguiente paso:**
- Revisar logs de Vercel para errores específicos de SQLite
- Verificar que `/tmp` sea accesible
- Verificar que las tablas se inicialicen correctamente

### Escenario 2: Versión Simplificada NO Funciona en Producción

**Diagnóstico:** Problema más profundo (configuración de Vercel, runtime, etc.).

**Siguiente paso:**
- Verificar configuración del proyecto en Vercel
- Verificar que el runtime sea Node.js
- Revisar logs de build/deploy

### Escenario 3: Versión Simplificada Funciona Localmente pero NO en Producción

**Diagnóstico:** Problema específico del entorno de producción.

**Siguiente paso:**
- Comparar configuración local vs producción
- Verificar variables de entorno en Vercel
- Revisar límites de recursos en Vercel

---

## 🎯 Información que Necesitamos

Para poder ayudar mejor, necesitamos:

1. **Mensaje de error de los logs de Vercel:**
   - La primera línea del error
   - El stack trace si está disponible

2. **Resultado de la versión simplificada:**
   - ¿Funciona localmente?
   - ¿Funciona en producción?

3. **Confirmación de variables:**
   - ¿Existen las variables obligatorias en Vercel? (solo nombres)
   - ¿Existen los secrets obligatorios en GitHub? (solo nombres)

---

## 📚 Archivos Relacionados

- `app/api/health/route.ts` - Versión mejorada con mejor manejo de errores
- `app/api/health/route.simple.ts` - Versión simplificada para testing
- `lib/db/schema.ts` - Inicialización de base de datos
- `VERIFICACION-ERROR-500-HEALTH.md` - Análisis detallado del código
- `LISTA-VARIABLES-ENTORNO.md` - Lista de variables esperadas

---

**Última actualización:** $(date +"%d/%m/%Y %H:%M")

