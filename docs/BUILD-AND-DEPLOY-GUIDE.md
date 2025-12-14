# Build and Deploy Guide

Guía completa para entender el proceso de build, deploy y cómo interpretar los logs en Vercel.

## Tabla de Contenidos

1. [Flujos de Build](#flujos-de-build)
2. [Warnings Conocidos y Seguros](#warnings-conocidos-y-seguros)
3. [Errores que Sí Deben Investigarse](#errores-que-sí-deben-investigarse)
4. [Checklist de Deploy](#checklist-de-deploy)
5. [Cómo Interpretar Logs de Vercel](#cómo-interpretar-logs-de-vercel)

---

## Flujos de Build

### Build Local vs Producción

#### Build Local (`pnpm build`)

**Qué compila Next.js:**
- Páginas estáticas (SSG)
- Páginas dinámicas (SSR)
- API Routes
- Módulos nativos (Node.js addons)
- Assets estáticos

**Características:**
- Usa `better-sqlite3` para desarrollo local
- Compila módulos nativos para tu plataforma (macOS, Linux, Windows)
- Genera `.next/` con el build completo

#### Build en Vercel (Producción)

**Qué compila Next.js:**
- Todo lo anterior, pero optimizado para producción
- Módulos nativos compilados para el runtime de Vercel (Linux x64)
- Output: `standalone` (ver `next.config.mjs`)

**Diferencia clave:**
- **Local**: SQLite con `better-sqlite3`
- **Producción**: Turso (SQLite remoto) con `@libsql/client`

⚠️ **Importante:** En producción, `better-sqlite3` NO se carga ni se ejecuta porque Next.js genera un bundle "standalone" que solo incluye `@libsql/client` y excluye las rutas que usan SQLite local. Esto aclara por qué ver esos warnings de compilación no significa nada en runtime.

### ¿Por qué se compilan addons nativos en Vercel si no se usan?

**Razón técnica:**
Next.js compila **todos** los módulos nativos durante el build, incluso si no se usan en runtime. Esto es porque:

1. Next.js no puede determinar en tiempo de build qué código se ejecutará en runtime
2. Los módulos nativos deben compilarse para la arquitectura del servidor (Linux x64 en Vercel)
3. Es más seguro compilar todo que arriesgarse a un error en runtime

**En nuestro caso:**
- `better-sqlite3` está en `dependencies` (necesario para desarrollo local)
- En producción usamos Turso, pero Next.js compila `better-sqlite3` de todas formas
- Esto genera warnings de compilación C++, pero **no afecta la funcionalidad**

### Dependencias: Runtime Local vs Producción

| Dependencia | Local | Producción | Notas |
|------------|-------|------------|-------|
| `better-sqlite3` | ✅ Usado | ❌ No usado | Compilado pero no ejecutado |
| `@libsql/client` | ❌ No usado | ✅ Usado | Cliente para Turso |
| Módulos nativos | Compilados | Compilados | Siempre se compilan en build |

---

## Warnings Conocidos y Seguros

### 1. better-sqlite3 C++ Warnings

**Cómo identificarlos:**
```
../src/util/data.cpp: In function 'v8::Local<v8::Value> Data::GetValueJS(...)':
warning: this statement may fall through [-Wimplicit-fallthrough=]
...
SOLINK_MODULE(target) Release/obj.target/better_sqlite3.node
COPY Release/better_sqlite3.node
```

**Qué significan:**
- Warnings del compilador C++ dentro del código de `better-sqlite3`
- El compilador detecta un posible "fall-through" en un `switch`
- **No son errores de nuestro código**

**Por qué son seguros:**
- ✅ El build se completa exitosamente (exit code 0)
- ✅ El módulo se compila y se copia correctamente
- ✅ No afectan la funcionalidad de la aplicación
- ✅ Son warnings internos de `better-sqlite3`

**Cómo ignorarlos:**
- **No hacer nada** - son seguros de ignorar
- El build continúa normalmente
- La aplicación funciona correctamente

**Referencia completa:** Ver [BUILD-WARNINGS-BETTER-SQLITE3.md](./BUILD-WARNINGS-BETTER-SQLITE3.md)

### 2. Yahoo Finance API Warnings

**Cómo identificarlos:**
```
502 Bad Gateway
429 Too Many Requests
503 Service Unavailable
```

**Qué significan:**
- Yahoo Finance puede devolver ocasionalmente errores 429/502/503
- Esto es normal y no indica un problema con nuestro código
- Los jobs están diseñados para reintentar automáticamente

**Por qué son seguros:**
- ✅ No son errores del proyecto
- ✅ Los jobs tienen lógica de retry automático
- ✅ Son temporales y se resuelven solos

**Cómo manejarlos:**
- **No hacer nada** - los jobs reintentan automáticamente
- Si persisten por más de 1 hora, verificar el estado de Yahoo Finance
- En casos extremos, los datos se marcan como "insuficientes" pero no rompen el sistema

### 3. Next.js Cache Warnings

**Cómo identificarlos:**
```
⚠ fetch for https://... specified "cache: no-store" and "revalidate: 0", 
only one should be specified.
```

**Qué significan:**
- Se está usando `cache: 'no-store'` y `next: { revalidate: 0 }` simultáneamente
- Next.js recomienda usar solo uno de los dos

**Por qué son seguros:**
- No rompen la funcionalidad
- Son advertencias de optimización

**Cómo corregirlos:**
```typescript
// ❌ Incorrecto
const res = await fetch(url, {
  cache: 'no-store',
  next: { revalidate: 0 }
})

// ✅ Correcto (opción 1)
const res = await fetch(url, {
  cache: 'no-store'
})

// ✅ Correcto (opción 2) - en el route handler
export const dynamic = 'force-dynamic'
export const revalidate = 0
// Y en el fetch solo:
const res = await fetch(url)
```

---

## Errores que Sí Deben Investigarse

### 1. ERR_DYNAMIC_SERVER_USAGE

**Cómo identificarlo:**
```
Error: Route "/api/..." used `cache: 'no-store'` or similar dynamic API 
but was statically generated. This is not allowed.
```

**Qué significa:**
- Una ruta dinámica está siendo generada estáticamente
- Next.js detectó uso de APIs dinámicas (`cache: 'no-store'`, `headers()`, etc.) en una ruta estática

**Cómo corregirlo:**
```typescript
// Añadir al inicio del archivo route.ts
export const dynamic = 'force-dynamic'
export const revalidate = 0
```

**Archivos afectados comúnmente:**
- `/app/api/debug/*/route.ts`
- `/app/api/jobs/*/route.ts`
- Cualquier API route que use `cache: 'no-store'`

### 2. TypeError en Imports

**Cómo identificarlo:**
```
TypeError: Cannot find module '...'
Module not found: Can't resolve '...'
```

**Qué significa:**
- Un módulo no se puede resolver
- Puede ser un import incorrecto, dependencia faltante, o problema de path

**Cómo investigar:**
1. Verificar que el módulo existe en `node_modules`
2. Verificar que el path del import es correcto
3. Verificar que la dependencia está en `package.json`
4. Ejecutar `pnpm install` si es necesario

**Ejemplo común:**
```typescript
// ❌ Incorrecto
import { something } from '@/lib/non-existent'

// ✅ Verificar que el archivo existe
import { something } from '@/lib/existing-file'
```

### 3. Fallos en Cron Jobs

**Cómo identificarlo:**
- Logs en Vercel muestran errores 500/504 en `/api/jobs/*`
- Los jobs no se ejecutan según el schedule en `vercel.json`

**Qué verificar:**
1. **Timeout**: Vercel tiene límite de 300 segundos (5 minutos)
   - Si un job tarda más, se corta con 504
   - Solución: Optimizar el job o dividirlo en múltiples jobs

2. **Autenticación**: Verificar que `CRON_TOKEN` está configurado
   ```bash
   # Verificar en Vercel Dashboard > Settings > Environment Variables
   ```

3. **Errores en el código**: Revisar logs de runtime para errores específicos

**Ejemplo de optimización:**
```typescript
// ❌ Job lento (puede timeout)
for (const item of largeArray) {
  await processItem(item) // Lento
}

// ✅ Job optimizado (batch processing)
const batches = chunk(largeArray, 100)
for (const batch of batches) {
  await Promise.all(batch.map(processItem)) // Paralelo
}
```

### 4. Problemas de Fetch con Cache / Revalidate

**Cómo identificarlo:**
- Warnings sobre `cache` y `revalidate` (ver sección de warnings)
- Errores de build relacionados con fetch

**Cómo corregirlo:**
```typescript
// En route handlers dinámicos
export const dynamic = 'force-dynamic'
export const revalidate = 0

// En fetch dentro del handler
const res = await fetch(url, {
  cache: 'no-store' // Solo esto, sin next.revalidate
})
```

---

## Checklist de Deploy

### Antes del Deploy

- [ ] **Build local exitoso**
  ```bash
  pnpm build
  ```
  - Verificar que no hay errores de TypeScript
  - Verificar que no hay errores de linting

- [ ] **Tests pasan** (si existen)
  ```bash
  pnpm test
  ```

- [ ] **Variables de entorno verificadas**
  - `CRON_TOKEN` configurado en Vercel
  - `TURSO_DATABASE_URL` configurado
  - `TURSO_AUTH_TOKEN` configurado
  - Otras variables necesarias

- [ ] **Cron jobs configurados**
  - Verificar `vercel.json` tiene los schedules correctos
  - Verificar que los paths de los jobs existen

- [ ] **Commits y push**
  ```bash
  git add .
  git commit -m "feat: descripción del cambio"
  git push origin main
  ```

### Después del Deploy

- [ ] **Build en Vercel exitoso**
  - Verificar en Vercel Dashboard que el build pasó
  - Revisar logs de build para warnings conocidos (seguros de ignorar)
  - Verificar que no hay errores nuevos

- [ ] **Verificación con endpoints de debug**

  **1. Bias State**
  ```bash
  curl https://tu-dominio.com/api/debug/bias-state
  ```
  - Verificar que `tableTactical` contiene solo los 19 pares permitidos
  - Verificar que no hay `extraPairs` o `missingPairs`

  **2. Dashboard Data**
  ```bash
  curl https://tu-dominio.com/api/debug/dashboard-data
  ```
  - Verificar estructura de datos
  - Verificar que los indicadores tienen valores

  **3. European Indicators**
  ```bash
  curl https://tu-dominio.com/api/debug/european-indicators
  ```
  - Verificar que los indicadores europeos se están ingiriendo correctamente

  **4. Macro Diagnosis**
  ```bash
  curl https://tu-dominio.com/api/debug/macro-diagnosis
  ```
  - Verificar que los indicadores USA tienen valores
  - Verificar que los zScores se calculan correctamente

- [ ] **Ejecutar jobs manualmente** (primera vez después del deploy)

  ```bash
  # 1. Ingesta FRED (USA)
  curl -X POST https://tu-dominio.com/api/jobs/ingest/fred \
    -H "Authorization: Bearer ${CRON_TOKEN}"

  # 2. Transformar indicadores
  curl -X POST https://tu-dominio.com/api/jobs/transform/indicators \
    -H "Authorization: Bearer ${CRON_TOKEN}"

  # 3. Ingesta Europea
  curl -X POST https://tu-dominio.com/api/jobs/ingest/european \
    -H "Authorization: Bearer ${CRON_TOKEN}"

  # 4. Correlaciones
  curl -X POST https://tu-dominio.com/api/jobs/correlations \
    -H "Authorization: Bearer ${CRON_TOKEN}"

  # 5. Bias
  curl -X POST https://tu-dominio.com/api/jobs/compute/bias \
    -H "Authorization: Bearer ${CRON_TOKEN}"
  ```

- [ ] **Verificar logs de runtime**
  - Revisar logs en Vercel Dashboard > Functions
  - Verificar que no hay errores 500/504
  - Verificar que los jobs se ejecutan correctamente

- [ ] **Verificar dashboard en producción**
  - Abrir el dashboard en el navegador
  - Verificar que los datos se muestran correctamente
  - Verificar que las correlaciones aparecen
  - Verificar que los indicadores tienen "Dato actual" y "Dato anterior"

### Endpoints de Debug Disponibles

| Endpoint | Propósito | Verifica |
|----------|-----------|----------|
| `/api/debug/bias-state` | Estado del bias | Pares tácticos, bias state |
| `/api/debug/dashboard-data` | Datos del dashboard | Estructura completa de datos |
| `/api/debug/european-indicators` | Indicadores europeos | Ingesta de Eurostat/ECB |
| `/api/debug/macro-diagnosis` | Diagnóstico macro | Indicadores USA, zScores |
| `/api/debug/indicator-history` | Historial de indicadores | Valores históricos |
| `/api/debug/db` | Estado de la DB | Conexión, tablas, conteos |

**Notas importantes:**
- Todos los endpoints de debug están marcados como `dynamic = 'force-dynamic'` y no se cachean
- Es normal que tarden entre 200ms y 2s según la cantidad de datos
- Estos endpoints son útiles para verificar el estado del sistema después de un deploy

⚠️ **Advertencia de Seguridad:** Los endpoints de debug no deben exponerse en aplicaciones públicas sin autenticación. Actualmente están permitidos porque la app no es pública para usuarios finales. Cuando se abra la app al público, se deberán proteger con:
- Token de acceso
- Middleware de autenticación
- O eliminarlos del build final

---

## Cómo Interpretar Logs de Vercel

### Fases del Deploy

#### 1. Build Phase

**Qué es:**
- Compilación del código
- Generación de assets
- Compilación de módulos nativos

**Qué buscar:**
- ✅ `Compiled successfully` - Build exitoso
- ⚠️ Warnings de `better-sqlite3` - Seguros de ignorar
- ❌ `Error:` - Debe investigarse

**Ejemplo de build exitoso:**
```
✓ Compiled successfully
  Linting and checking validity of types ...
  Collecting page data ...
✓ Generating static pages (X/X)
```

#### 2. Runtime Phase

**Qué es:**
- Ejecución de la aplicación en producción
- API routes, serverless functions
- Ejecución de cron jobs

**Qué buscar:**
- ✅ `200 OK` - Request exitoso
- ⚠️ `429 Too Many Requests` - Rate limiting (normal en algunos casos)
- ❌ `500 Internal Server Error` - Debe investigarse
- ❌ `504 Gateway Timeout` - Job demasiado lento

**Ejemplo de runtime exitoso:**
```
[GET] /api/debug/bias-state 200 in 1234ms
[job] Starting correlations calculation
[job] Processed 19 symbols, 0 errors
```

### Edge vs Serverless

#### Edge Functions

**Características:**
- Ejecución en edge locations (cerca del usuario)
- Muy rápidas (< 50ms típicamente)
- Limitaciones: No pueden usar módulos nativos, APIs limitadas

**Cuándo se usan:**
- Middleware
- Algunas API routes marcadas con `export const runtime = 'edge'`

**En nuestro proyecto:**
- No usamos Edge Functions actualmente
- Todo corre en Serverless Functions

#### Serverless Functions

**Características:**
- Ejecución en servidores de Vercel
- Pueden usar módulos nativos (con limitaciones)
- Timeout: 10s (Hobby) o 300s (Pro)
- Memoria: 1024 MB

**En nuestro proyecto:**
- Todas las API routes corren como Serverless Functions
- **Nota:** El proyecto actual corre en plan Vercel Pro, por lo que los cron jobs pueden ejecutarse hasta 300 segundos. En plan Hobby el límite sería 10 segundos y varios de nuestros jobs no funcionarían.

**Ejemplo de log:**
```
[POST] /api/jobs/ingest/fred
Duration: 45.2s
Memory: 256 MB
Status: 200
```

### Interpretación de Errores Comunes

#### 1. Timeout (504)

```
Task timed out after 300 seconds
```

**Causa:** Job tarda más de 5 minutos

**Solución:**
- Optimizar el job (batch processing, paralelización)
- Dividir el job en múltiples jobs más pequeños
- Reducir la cantidad de datos procesados

#### 2. Out of Memory

```
FATAL ERROR: Reached heap limit
```

**Causa:** Job usa más de 1024 MB de memoria

**Solución:**
- Procesar datos en chunks más pequeños
- Liberar memoria explícitamente
- Reducir el tamaño de los datos en memoria

#### 3. Module Not Found

```
Error: Cannot find module '@/lib/...'
```

**Causa:** Import incorrecto o archivo faltante

**Solución:**
- Verificar que el path del import es correcto
- Verificar que el archivo existe
- Verificar que está en el workspace

#### 4. Database Connection Error

```
Error: Failed to connect to database
```

**Causa:** Variables de entorno no configuradas o incorrectas

**Solución:**
- Verificar `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN` en Vercel
- Verificar que la URL es correcta (debe incluir `libsql://`)
- Verificar que el token tiene permisos

### Logs de Cron Jobs

**Cómo identificarlos:**
```
[Vercel Cron] Executing scheduled function: /api/jobs/ingest/fred
```

**Qué buscar:**
- ✅ `Executing scheduled function` - Job iniciado
- ✅ `200 OK` - Job completado exitosamente
- ❌ `500 Internal Server Error` - Error en el job
- ❌ `504 Gateway Timeout` - Job demasiado lento

**Ejemplo de log exitoso:**
```
[Vercel Cron] Executing scheduled function: /api/jobs/ingest/fred
[job] Starting FRED data ingestion
[job] Ingested 15 series, 0 errors
[Vercel Cron] Completed: /api/jobs/ingest/fred (200) in 45.2s
```

---

## Referencias Rápidas

### Comandos Útiles

```bash
# Build local
pnpm build

# Verificar tipos
pnpm tsc --noEmit

# Linting
pnpm lint

# Tests
pnpm test

# Verificar datos localmente
pnpm verify:local
```

### Variables de Entorno Críticas

| Variable | Uso | Dónde configurar |
|----------|-----|-------------------|
| `CRON_TOKEN` | Autenticación de jobs | Vercel Dashboard |
| `TURSO_DATABASE_URL` | Conexión a Turso | Vercel Dashboard |
| `TURSO_AUTH_TOKEN` | Auth token de Turso | Vercel Dashboard |
| `FRED_API_KEY` | API key de FRED | Vercel Dashboard |

**Nota:** Alpha Vantage ya no se usa en el proyecto. Todo el sistema de correlaciones se migró a Yahoo Finance debido a rate limits. Si aparece `ALPHA_VANTAGE_API_KEY` en algún lugar, puede eliminarse de forma segura.

### Enlaces Útiles

- [Vercel Dashboard](https://vercel.com/dashboard)
- [Vercel Logs](https://vercel.com/docs/monitoring/logs)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Turso Documentation](https://docs.turso.tech/)

---

## Resumen de Buenas Prácticas

1. **Siempre verificar el build local antes de hacer push**
2. **Revisar logs de build para errores nuevos** (ignorar warnings conocidos)
3. **Usar endpoints de debug después del deploy** para verificar funcionalidad
4. **Ejecutar jobs manualmente la primera vez** después de cambios importantes
5. **Monitorear logs de runtime** para detectar errores temprano
6. **Documentar nuevos warnings** si aparecen y son seguros de ignorar

---

## Actualizaciones Recomendadas

Este documento forma parte de la documentación viva del proyecto y debe mantenerse actualizado. Se recomienda revisar y actualizar este documento cada vez que:

- **Se migra una API externa** (ej. Yahoo Finance → otro proveedor)
- **Se cambia el sistema de ingesta o cron jobs** (nuevos jobs, cambios en schedules)
- **Se actualiza Next.js a una nueva versión mayor** (cambios en build, runtime, etc.)
- **Se actualiza el sistema de DB** (paso a SQLite local, Postgres, etc.)
- **Se cambia el plan de Vercel** (Hobby → Pro, o viceversa)
- **Se añaden nuevas dependencias nativas** (nuevos módulos que compilan en build)
- **Se cambian las variables de entorno críticas** (nuevas APIs, nuevos servicios)

**Nota sobre fuentes de datos externas:**
- Si se migra de WorldBank a IMF (o viceversa) para algún indicador, actualizar la sección correspondiente
- Si se elimina o añade una fuente de datos (ej. Alpha Vantage fue eliminado, Yahoo Finance es la fuente principal), actualizar las variables de entorno y las secciones de warnings/errores
- **Nota sobre Current Account Balance (External Balance):** Aunque el endpoint original era de WorldBank, este indicador ahora utiliza IMF como fuente principal debido a inconsistencias en el formato del API de WorldBank para este indicador. WorldBank permanece como fallback validado en el código, pero IMF es la fuente preferida.

---

## 📚 Documentación relacionada

- **Runbook de producción (jobs chunked):** `docs/RUNBOOK-JOBS-CHUNKED-PRODUCCION.md` - Guía completa para ejecutar jobs con batch mode en producción
- **Migración de job_state:** `docs/MIGRACION-JOB-STATE.md` - Instrucciones para crear la tabla `job_state` en Turso

---

**Última actualización:** Diciembre 2024


