# 📋 Información para Verificar en Vercel

## ✅ Estado Actual del Código

**Último commit en GitHub:**
- `254dbfe` - "fix: detectar Vercel de forma robusta para usar /tmp/macro.db"

**Código correcto en `lib/db/schema.ts`:**
```typescript
const isVercel = !!(process.env.VERCEL || process.env.VERCEL_ENV || process.env.VERCEL_URL)
const DB_PATH = isVercel ? '/tmp/macro.db' : join(process.cwd(), 'macro.db')
```

**Estado Git:** ✅ Todos los cambios están commiteados y en GitHub

---

## 🔍 Qué Verificar en Vercel

### 1. Verificar Último Deployment

**En Vercel Dashboard:**
1. Ve a: https://vercel.com → Tu proyecto → Deployments
2. Busca el último deployment
3. **Verifica:**
   - ✅ Estado: ¿"Ready" (verde) o "Building"?
   - ✅ Commit: ¿Corresponde a `254dbfe` o posterior?
   - ✅ Mensaje: ¿"fix: detectar Vercel de forma robusta..."?

### 2. Probar Endpoints

**Ejecuta este script:**
```bash
cd /Users/carlosmontagutllarch/Desktop/macro-dashboard-with-data
./scripts/test-endpoints-vercel.sh
```

**O manualmente:**
```bash
# Probar /api/health
curl https://macro-dashboard-seven.vercel.app/api/health | jq

# Probar /api/diag
curl https://macro-dashboard-seven.vercel.app/api/diag | jq
```

### 3. Revisar Logs en Vercel

**Pasos:**
1. Ve a Vercel → **Logs** (o Monitoring → Logs)
2. **Filtros:**
   - Environment: `Production`
   - Type: `Function`
   - Buscar: `/api/health` o `/api/diag`
3. **Después de hacer las llamadas curl**, busca en los logs:

**Líneas que DEBEN aparecer (si todo está bien):**
```
[db] DB_PATH: /tmp/macro.db
[db] isVercel: true
[db] Initializing database at: /tmp/macro.db
[db] Database initialized successfully at: /tmp/macro.db
```

**Líneas que NO deben aparecer (si hay error):**
```
SqliteError: unable to open database file
SQLITE_CANTOPEN
[db] ERROR: In Vercel, DB_PATH must be in /tmp, got: [otro path]
```

---

## 📝 Información que Necesito

**Copia y pega aquí:**

### 1. Estado del Deployment
- Estado: [Ready/Building/Error]
- Commit: [mensaje del commit]
- Fecha: [fecha]

### 2. Líneas de Debug de [db] en los Logs

```
[PEGAR AQUÍ todas las líneas que empiezan con [db]]
```

**Ejemplo de lo que busco:**
```
[db] DB_PATH: /tmp/macro.db
[db] NODE_ENV: production
[db] isVercel: true
[db] isProduction: true
[db] VERCEL: 1
[db] VERCEL_ENV: production
[db] VERCEL_URL: macro-dashboard-seven.vercel.app
[db] Initializing database at: /tmp/macro.db
[db] Database initialized successfully at: /tmp/macro.db
```

### 3. Errores (si los hay)

```
[PEGAR AQUÍ cualquier error relacionado con SQLite, BD, o [db] ERROR]
```

### 4. Respuesta de los Endpoints

**/api/health:**
```json
[PEGAR AQUÍ la respuesta JSON completa]
```

**/api/diag:**
```json
[PEGAR AQUÍ la respuesta JSON completa]
```

---

## 🎯 Interpretación de Resultados

### Escenario 1: Todo Funciona ✅

**Logs muestran:**
- `[db] DB_PATH: /tmp/macro.db`
- `[db] isVercel: true`
- `[db] Database initialized successfully`

**Endpoints responden:**
- `/api/health` retorna JSON con `hasData: false` (normal si no hay datos aún)
- `/api/diag` retorna datos de FRED

**✅ Conclusión:** Todo está funcionando correctamente

### Escenario 2: Path Incorrecto ❌

**Logs muestran:**
- `[db] DB_PATH: /var/task/...` (o cualquier path que NO sea `/tmp/macro.db`)
- `[db] isVercel: false`

**❌ Problema:** Vercel no se está detectando correctamente

**Solución:** Verificar variables de entorno `VERCEL`, `VERCEL_ENV`, `VERCEL_URL`

### Escenario 3: Error SQLITE_CANTOPEN ❌

**Logs muestran:**
- `SqliteError: unable to open database file`
- `SQLITE_CANTOPEN`

**❌ Problema:** No se puede crear/abrir la BD en `/tmp`

**Posibles causas:**
- Permisos en `/tmp`
- Path incorrecto
- Problema con better-sqlite3 en Vercel

### Escenario 4: Endpoint No Responde ⚠️

**Curl no recibe respuesta o timeout**

**Posibles causas:**
- Deployment no completado
- Error en runtime que causa cuelgue
- Timeout en inicialización de BD

---

## 🚀 Siguiente Paso

Una vez que tengas la información de los logs:

1. **Copia las líneas de `[db]`** (especialmente `DB_PATH` e `isVercel`)
2. **Copia cualquier error** que aparezca
3. **Indica el estado del deployment**
4. **Pega las respuestas de los endpoints**

Con esta información podremos identificar exactamente qué está pasando y qué necesita corregirse.

---

**Última actualización:** $(date +"%d/%m/%Y %H:%M")

