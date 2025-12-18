# Resumen: Implementación de Turso para Persistencia de Datos

## 📋 Contexto del Problema

### Problema Inicial
- El dashboard desplegado en Vercel mostraba datos vacíos (`datoAnterior: "—"`, `hasData: false`)
- Los datos desaparecían después de cada deploy
- La base de datos SQLite local (`macro.db`) funcionaba bien en desarrollo, pero en Vercel:
  - Se guardaba en `/tmp/macro.db` (directorio efímero)
  - Se borraba en cada nuevo deploy o reinicio del servidor
  - No había persistencia entre deployments

### Requisitos del Usuario
- **Persistencia permanente**: Los datos deben mantenerse entre deployments
- **Actualización diaria**: Cron job automático para mantener datos actualizados
- **Sin pérdida de datos**: Los datos anteriores deben actualizarse, no desaparecer

---

## ✅ Solución Implementada: Turso (libSQL)

### ¿Qué es Turso?
- **Turso** es una base de datos SQLite distribuida y serverless
- Compatible con SQLite (mismo SQL, misma estructura)
- Persistente en la nube (no se borra entre deployments)
- Gratis hasta cierto límite de uso
- Perfecto para aplicaciones Next.js/Vercel

### Ventajas
- ✅ Persistencia real (datos no se pierden)
- ✅ Compatible con código SQLite existente
- ✅ Escalable y serverless
- ✅ Fácil de configurar

---

## 🔧 Cambios Técnicos Realizados

### 1. Nuevo Archivo: `lib/db/unified-db.ts`

**Propósito**: Abstracción unificada para usar `better-sqlite3` (local) o Turso (producción)

**Funcionalidades**:
- `isUsingTurso()`: Detecta si Turso está configurado
- `getUnifiedDB()`: Retorna wrapper compatible con ambas bases de datos
- `initializeSchemaUnified()`: Crea todas las tablas necesarias en Turso

**Características clave**:
- Wrapper que simula la API de `better-sqlite3` pero usa Turso internamente
- Operaciones asíncronas para Turso (requerido)
- Compatibilidad total con código existente

### 2. Actualización: `lib/db/schema.ts`

**Cambios**:
- `getDB()` ahora detecta automáticamente si usar Turso o SQLite local
- Inicializa el esquema de Turso si está configurado
- Mantiene compatibilidad con desarrollo local

### 3. Migración a Operaciones Asíncronas

**Archivos actualizados** (todos ahora son `async`):
- `lib/db/read-macro.ts`: Funciones de lectura
  - `getSeriesObservations()`
  - `getSeriesFrequency()`
  - `getLatestObservation()`
  - `getAllLatestFromDB()`
  - `getAllLatestFromDBWithPrev()`
- `lib/db/upsert.ts`: Funciones de escritura
  - `upsertMacroSeries()`
  - `upsertMacroBias()`
  - `upsertCorrelation()`
- `domain/diagnostic.ts`: `getMacroDiagnosis()`

**Razón**: Turso requiere operaciones asíncronas, mientras que `better-sqlite3` es síncrono.

### 4. Esquema Completo para Turso

**Tablas incluidas en `initializeSchemaUnified()`**:
- `macro_series` - Series macroeconómicas
- `macro_observations` - Observaciones históricas
- `macro_bias` - Sesgos calculados
- `correlations` - Correlaciones entre activos
- `correlations_history` - Historial de correlaciones
- `indicator_history` - Historial de indicadores
- `news_items` - Noticias económicas
- `narrative_state` - Estado de narrativas
- `macro_calendar` - Calendario macroeconómico
- `notification_history` - Historial de notificaciones
- `weekly_sent` - Control de envíos semanales
- `user_notification_preferences` - Preferencias de usuarios
- `notification_settings` - Configuración de notificaciones
- `daily_digest_sent` - Control de digest diario
- `notification_metrics` - Métricas de notificaciones
- `ingest_history` - Historial de ingestas de datos
- `settings` - Configuración general

**Índices**: Todos los índices necesarios para rendimiento

### 5. Nuevo Endpoint: `/api/jobs/daily-update`

**Propósito**: Actualización diaria automática de todos los datos

**Funcionalidad**:
1. Ingesta de datos FRED
2. Cálculo de correlaciones
3. Cálculo de sesgos (bias)

**Configuración en `vercel.json`**:
```json
{
  "crons": [
    {
      "path": "/api/jobs/daily-update",
      "schedule": "0 6 * * *"  // Diario a las 6:00 AM UTC
    },
    {
      "path": "/api/jobs/weekly",
      "schedule": "0 17 * * 0"  // Semanal domingos 17:00 UTC
    }
  ]
}
```

**Nota**: Eliminamos el cron job de `/api/warmup` para no exceder el límite de 2 cron jobs en Vercel.

### 6. Actualización de Dependencias

**`package.json`**:
- Añadido: `@libsql/client@0.15.15` para conexión a Turso

---

## 🚀 Configuración de Turso

### Paso 1: Instalación del CLI de Turso
```bash
# macOS
brew install tursodatabase/tap/turso

# O con curl
curl -sSfL https://get.tur.so/install.sh | bash
```

### Paso 2: Autenticación
```bash
turso auth login
```

### Paso 3: Crear Base de Datos
```bash
turso db create macro-dashboard-cmll1992 --region aws-eu-west-1
```

**Región elegida**: `aws-eu-west-1` (Europa Oeste, cerca de España)

### Paso 4: Generar Token de Autenticación
```bash
turso db tokens create macro-dashboard-cmll1992
```

### Paso 5: Obtener URL de la Base de Datos
```bash
turso db show macro-dashboard-cmll1992
```

### Paso 6: Configurar Variables de Entorno en Vercel

**Variables necesarias**:
- `TURSO_DATABASE_URL`: `libsql://macro-dashboard-cmll1992.aws-eu-west-1.turso.io`
- `TURSO_AUTH_TOKEN`: Token generado en el paso 4

**Cómo configurar**:
1. Ir a Vercel Dashboard → Tu Proyecto → Settings → Environment Variables
2. Añadir ambas variables
3. Asegurarse de que están marcadas para "Production", "Preview" y "Development"
4. Hacer redeploy

---

## 📊 Flujo de Funcionamiento

### Desarrollo Local
1. Si `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN` **NO** están configurados:
   - Usa `better-sqlite3` con `macro.db` local
   - Operaciones síncronas
   - Base de datos en el directorio del proyecto

### Producción (Vercel)
1. Si `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN` **SÍ** están configurados:
   - Usa Turso automáticamente
   - Operaciones asíncronas
   - Base de datos persistente en la nube

### Inicialización del Esquema
- Se ejecuta automáticamente la primera vez que se usa Turso
- Crea todas las tablas e índices necesarios
- No requiere migraciones manuales

### Actualización de Datos
- **Cron job diario** (`/api/jobs/daily-update`): A las 6:00 AM UTC
  - Actualiza datos FRED
  - Recalcula correlaciones
  - Recalcula sesgos
- **Cron job semanal** (`/api/jobs/weekly`): Domingos a las 17:00 UTC
  - Envío de resumen semanal

---

## 🔍 Detección Automática

El sistema detecta automáticamente qué base de datos usar:

```typescript
// En lib/db/schema.ts
const USE_TURSO = !!(TURSO_DATABASE_URL && TURSO_AUTH_TOKEN)

if (USE_TURSO) {
  // Usa Turso
} else {
  // Usa better-sqlite3 local
}
```

**Ventaja**: El mismo código funciona en desarrollo y producción sin cambios.

---

## ⚠️ Consideraciones Importantes

### 1. Operaciones Asíncronas
- **Turso requiere `await`** en todas las operaciones
- Todas las funciones que usan la base de datos deben ser `async`
- El código existente fue migrado para soportar ambas bases de datos

### 2. Límites de Vercel
- **Cron Jobs**: Máximo 2 en el plan gratuito
- Solución: Eliminamos `/api/warmup`, mantenemos solo `daily-update` y `weekly`

### 3. Warnings Durante Build
- Los warnings "Turso requires async operations" durante el build son **normales**
- Ocurren cuando Next.js intenta generar páginas estáticas
- No son errores fatales, el build se completa correctamente
- Se pueden ignorar o corregir haciendo las funciones de notificaciones también async (trabajo futuro)

### 4. Tablas Faltantes
- Si aparecen errores de "table not found" en producción:
  - El esquema se inicializa automáticamente en el primer uso
  - Si persisten, verificar que `initializeSchemaUnified()` se ejecute correctamente

---

## 📝 Archivos Modificados/Creados

### Nuevos Archivos
- `lib/db/unified-db.ts` - Wrapper unificado para Turso/SQLite
- `app/api/jobs/daily-update/route.ts` - Endpoint de actualización diaria
- `CONFIGURAR-TURSO.md` - Guía de configuración (si existe)
- `GUIA-RAPIDA-TURSO.md` - Guía rápida (si existe)

### Archivos Modificados
- `lib/db/schema.ts` - Detección automática Turso/SQLite
- `lib/db/read-macro.ts` - Migrado a async
- `lib/db/upsert.ts` - Migrado a async
- `domain/diagnostic.ts` - Migrado a async
- `vercel.json` - Añadido cron job diario, eliminado warmup
- `package.json` - Añadido `@libsql/client`

### Archivos con `export const dynamic = 'force-dynamic'`
- `app/dashboard/page.tsx` - Para evitar prerendering estático
- `app/api/admin/calendar/recent/route.ts` - Para usar `searchParams`
- `app/api/admin/news/recent/route.ts` - Para usar `searchParams`

---

## ✅ Estado Actual

### Funcionando
- ✅ Detección automática de Turso vs SQLite local
- ✅ Esquema completo inicializado en Turso
- ✅ Operaciones asíncronas para Turso
- ✅ Cron job diario configurado
- ✅ Dashboard muestra datos correctamente
- ✅ Persistencia de datos entre deployments

### Pendiente (Opcional)
- ⚠️ Migrar funciones de notificaciones a async (para eliminar warnings)
- ⚠️ Añadir manejo de errores más robusto para conexiones Turso
- ⚠️ Monitoreo de uso de Turso (límites del plan gratuito)

---

## 🧪 Cómo Verificar que Funciona

### 1. Verificar en Vercel
```bash
# Verificar que las variables de entorno están configuradas
# Vercel Dashboard → Settings → Environment Variables
```

### 2. Verificar Datos en Turso
```bash
# Conectar a la base de datos
turso db shell macro-dashboard-cmll1992

# Verificar tablas
.tables

# Verificar datos
SELECT COUNT(*) FROM macro_observations;
SELECT COUNT(*) FROM macro_series;
```

### 3. Verificar Dashboard
- Abrir `https://tu-proyecto.vercel.app/dashboard`
- Verificar que muestra datos (no "—" en `datoAnterior`)
- Verificar que `/api/health` retorna `hasData: true`

### 4. Verificar Cron Jobs
- Vercel Dashboard → Deployments → Ver logs del cron job
- Verificar que `/api/jobs/daily-update` se ejecuta diariamente

---

## 📚 Recursos Útiles

- **Documentación Turso**: https://docs.turso.tech
- **Turso CLI**: https://docs.turso.tech/cli
- **libSQL Client**: https://github.com/tursodatabase/libsql-client-ts

---

## 🎯 Resumen Ejecutivo

**Problema**: Datos desaparecían en Vercel porque SQLite se guardaba en `/tmp` (efímero).

**Solución**: Implementamos Turso (SQLite distribuido) como base de datos persistente.

**Resultado**: 
- ✅ Datos persisten entre deployments
- ✅ Actualización automática diaria con cron job
- ✅ Compatible con código existente (mismo SQL)
- ✅ Funciona en desarrollo (SQLite local) y producción (Turso)

**Configuración necesaria**:
1. Crear base de datos en Turso
2. Configurar `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN` en Vercel
3. El sistema detecta automáticamente y usa Turso

**Estado**: ✅ Implementado y funcionando
























