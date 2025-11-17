# ✅ Corrección de Path de Base de Datos

## 🎯 Problema Identificado

El error `SQLITE_CANTOPEN` ocurría porque la base de datos se intentaba abrir en un path de solo lectura en Vercel (`/var/task/...` o `.next/...`).

**Causa:** Vercel solo permite escribir en `/tmp`, no en otros directorios.

## ✅ Solución Aplicada

### 1. Modificado `lib/db/schema.ts`

**Cambios:**
- ✅ Usa `NODE_ENV === "production"` para detectar producción
- ✅ En producción: **SIEMPRE** usa `/tmp/macro.db`
- ✅ En desarrollo: usa `./macro.db` (en la raíz del proyecto)
- ✅ La BD se crea automáticamente si no existe
- ✅ Las migraciones se ejecutan **SIEMPRE** antes de cualquier consulta

**Código:**
```typescript
const isProduction = process.env.NODE_ENV === 'production'

const DB_PATH = process.env.DATABASE_PATH || (
  isProduction
    ? '/tmp/macro.db'
    : join(process.cwd(), 'macro.db')
)
```

### 2. Actualizado `app/api/jobs/maintenance/route.ts`

**Cambios:**
- ✅ Usa la misma lógica de `NODE_ENV === "production"`
- ✅ Paths de backup consistentes con el path principal

### 3. Restaurado `/api/health`

**Cambios:**
- ✅ Versión original restaurada (con mejor manejo de errores)
- ✅ Usa `getDB()` que ahora tiene la lógica correcta

## 📋 Verificaciones Realizadas

### Archivos que usan SQLite

Todos los archivos que usan SQLite usan `getDB()` de `lib/db/schema.ts`, por lo que automáticamente usan el path correcto:

- ✅ `lib/db/schema.ts` - Path centralizado
- ✅ `app/api/health/route.ts` - Usa `getDB()`
- ✅ `app/api/jobs/maintenance/route.ts` - Actualizado para usar misma lógica
- ✅ Todos los demás archivos - Usan `getDB()`

### Migraciones

- ✅ `initializeSchema()` se ejecuta **SIEMPRE** en `getDB()` antes de cualquier consulta
- ✅ Usa `CREATE TABLE IF NOT EXISTS` para evitar errores si las tablas ya existen

## 🚀 Próximos Pasos

### 1. Desplegar a Vercel

```bash
cd /Users/carlosmontagutllarch/Desktop/macro-dashboard-with-data
git add lib/db/schema.ts app/api/jobs/maintenance/route.ts app/api/health/route.ts
git commit -m "fix: usar /tmp/macro.db en producción para Vercel"
git push origin main
```

### 2. Esperar Deployment (1-2 minutos)

Espera a que Vercel termine de desplegar.

### 3. Probar Endpoints

**Probar /api/health:**
```bash
curl https://macro-dashboard-seven.vercel.app/api/health | jq
```

**Resultado esperado:**
```json
{
  "hasData": false,
  "observationCount": 0,
  "biasCount": 0,
  "correlationCount": 0,
  "latestDate": null,
  "health": {
    "hasObservations": false,
    "hasBias": false,
    "hasCorrelations": false,
    "observationCount": 0,
    "biasCount": 0,
    "correlationCount": 0,
    "latestDate": null
  }
}
```

**Probar /api/fred/CPIAUCSL:**
```bash
curl "https://macro-dashboard-seven.vercel.app/api/fred/CPIAUCSL?observation_start=2024-01-01" | jq '.observations | length'
```

**Resultado esperado:**
- Debe retornar datos de FRED (no depende de la BD)

### 4. Verificar Logs

En Vercel → Logs, busca:
```
[db] Initializing database at: /tmp/macro.db
[db] Database initialized successfully at: /tmp/macro.db
```

## 🔍 Limpieza de BD Local (Opcional)

Si quieres limpiar la BD local para empezar de cero:

```bash
# Eliminar BD local
rm -f macro.db
rm -f data/macro.db

# La BD se creará automáticamente en el próximo acceso
```

**Nota:** En producción (Vercel), la BD en `/tmp` se crea automáticamente en cada función serverless. No necesitas limpiarla manualmente.

## 📝 Notas Importantes

### Paths en Vercel

| Carpeta | Permisos | Uso |
|---------|----------|-----|
| `/var/task` | Solo lectura ❌ | Código empaquetado |
| `/tmp` | Lectura/escritura ✅ | **Base de datos aquí** |
| `.next/` | Empaquetado, no editable ❌ | Build de Next.js |

### Comportamiento en Vercel

- ✅ La BD en `/tmp` se crea automáticamente si no existe
- ✅ Las tablas se crean automáticamente en el primer acceso
- ⚠️ La BD en `/tmp` es **temporal** (se limpia entre deployments)
- ⚠️ Para datos persistentes, considera usar una BD externa (PostgreSQL, etc.)

### Desarrollo Local

- ✅ La BD se crea en `./macro.db` (raíz del proyecto)
- ✅ Se puede eliminar y recrear sin problemas
- ✅ Usa WAL mode para mejor rendimiento

## ✅ Checklist

- [x] Modificado `lib/db/schema.ts` para usar `/tmp/macro.db` en producción
- [x] Actualizado `app/api/jobs/maintenance/route.ts` para usar misma lógica
- [x] Restaurado `/api/health` a versión original
- [x] Verificado que todos los archivos usan `getDB()`
- [x] Verificado que las migraciones se ejecutan automáticamente
- [ ] Desplegar a Vercel
- [ ] Probar `/api/health`
- [ ] Probar `/api/fred/CPIAUCSL`
- [ ] Verificar logs de Vercel

---

**Última actualización:** $(date +"%d/%m/%Y %H:%M")

