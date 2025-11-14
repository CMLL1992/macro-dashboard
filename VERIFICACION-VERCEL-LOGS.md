# 🔍 Verificación de Logs en Vercel - Guía Paso a Paso

## 🎯 Objetivo

Verificar que el código corregido está desplegado en Vercel y que la base de datos se está inicializando correctamente en `/tmp/macro.db`.

---

## ✅ Paso 1: Verificar que el Código Está en GitHub

### 1.1 Verificar Último Commit

```bash
cd /Users/carlosmontagutllarch/Desktop/macro-dashboard-with-data
git log --oneline -3
```

**Busca un commit que contenga:**
- `fix: detectar Vercel de forma robusta`
- O cambios relacionados con `isVercel` y `DB_PATH`

### 1.2 Verificar que los Cambios Están en GitHub

1. **Ve a GitHub:**
   - https://github.com/CMLL1992/macro-dashboard
   - Ve a la rama `main`
   - Click en el último commit

2. **Verifica el archivo `lib/db/schema.ts`:**
   - Busca las líneas:
     ```typescript
     const isVercel = !!(process.env.VERCEL || process.env.VERCEL_ENV || process.env.VERCEL_URL)
     const DB_PATH = isVercel ? '/tmp/macro.db' : join(process.cwd(), 'macro.db')
     ```
   - Debe estar presente en el código

---

## ✅ Paso 2: Verificar Deployment en Vercel

### 2.1 Acceder a Vercel Dashboard

1. **Ve a:** https://vercel.com
2. **Inicia sesión**
3. **Selecciona el proyecto:** `macro-dashboard`

### 2.2 Verificar Último Deployment

1. **Ve a "Deployments"**
2. **Busca el último deployment:**
   - Debe estar en estado "Ready" (verde) o "Building"
   - Click en el deployment para ver detalles

3. **Verifica el commit:**
   - En el deployment, busca el mensaje del commit
   - Debe corresponder al commit con los cambios de `isVercel` y `DB_PATH`

4. **Verifica el estado:**
   - ✅ "Ready" (verde) = Deployment completado
   - ⚠️ "Building" = Aún en proceso
   - ❌ "Error" = Hubo un error

---

## ✅ Paso 3: Verificar Logs de Vercel

### 3.1 Acceder a Logs

1. **En Vercel Dashboard:**
   - Ve a **"Logs"** o **"Monitoring"** → **"Logs"**
   - O desde el deployment: Click en **"Logs"**

2. **Aplicar Filtros:**
   - **Environment:** `Production`
   - **Type:** `Function` o `Serverless / Edge`
   - **Buscar:** `/api/health` o `/api/diag`

### 3.2 Reproducir las Llamadas

**En tu terminal, ejecuta:**

```bash
# Llamar a /api/health
curl https://macro-dashboard-seven.vercel.app/api/health

# Llamar a /api/diag
curl https://macro-dashboard-seven.vercel.app/api/diag
```

**Espera 5-10 segundos** entre cada llamada para que aparezcan en los logs.

### 3.3 Buscar en los Logs

**Busca estas líneas específicas:**

#### ✅ Líneas que DEBEN aparecer (si todo está bien):

```
[db] DB_PATH: /tmp/macro.db
[db] NODE_ENV: [valor o undefined]
[db] isVercel: true
[db] isProduction: [true/false]
[db] VERCEL: [valor o undefined]
[db] VERCEL_ENV: [valor o undefined]
[db] VERCEL_URL: [valor o undefined]
[db] Initializing database at: /tmp/macro.db
[db] Database initialized successfully at: /tmp/macro.db
```

#### ❌ Líneas que NO deben aparecer (si hay error):

```
SqliteError: unable to open database file
SQLITE_CANTOPEN
Error opening database at
```

#### ⚠️ Líneas que indican problemas:

```
[db] ERROR: In Vercel, DB_PATH must be in /tmp, got: [otro path]
[db] ERROR: /tmp does not exist in Vercel environment!
[db] Error opening database at [path]
```

---

## ✅ Paso 4: Verificar Código Desplegado

### 4.1 Verificar en el Deployment

1. **En Vercel Dashboard:**
   - Ve al último deployment
   - Click en **"Source"** o **"View Source"**
   - Busca el archivo `lib/db/schema.ts`

2. **Verifica que contenga:**
   ```typescript
   const isVercel = !!(process.env.VERCEL || process.env.VERCEL_ENV || process.env.VERCEL_URL)
   const DB_PATH = isVercel ? '/tmp/macro.db' : join(process.cwd(), 'macro.db')
   ```

### 4.2 Verificar Build Logs

1. **En el deployment:**
   - Click en **"Build Logs"**
   - Busca mensajes de compilación
   - Verifica que no haya errores de TypeScript

---

## 📋 Checklist de Verificación

### Código en GitHub
- [ ] Último commit contiene cambios de `isVercel` y `DB_PATH`
- [ ] `lib/db/schema.ts` en GitHub tiene el código correcto

### Deployment en Vercel
- [ ] Último deployment está en estado "Ready" (verde)
- [ ] El commit del deployment corresponde al commit con los cambios
- [ ] Build logs muestran compilación exitosa

### Logs de Vercel
- [ ] Llamé a `/api/health` y `/api/diag`
- [ ] Aparecen líneas `[db] DB_PATH: /tmp/macro.db`
- [ ] Aparece `[db] isVercel: true`
- [ ] Aparece `[db] Database initialized successfully at: /tmp/macro.db`
- [ ] NO aparece `SQLITE_CANTOPEN` o `unable to open database file`

---

## 📝 Información que Necesito

**Copia y pega aquí la información de los logs:**

### 1. Líneas de Debug de [db]

```
[PEGAR AQUÍ las líneas que empiezan con [db]]
```

### 2. Errores (si los hay)

```
[PEGAR AQUÍ cualquier error relacionado con SQLite o la BD]
```

### 3. Estado del Deployment

- Estado: [Ready/Building/Error]
- Commit: [mensaje del commit]
- Fecha: [fecha del deployment]

### 4. Respuesta de los Endpoints

**/api/health:**
```json
[PEGAR AQUÍ la respuesta JSON]
```

**/api/diag:**
```json
[PEGAR AQUÍ la respuesta JSON]
```

---

## 🔍 Qué Buscar Específicamente

### Si TODO está bien, deberías ver:

1. **En los logs:**
   ```
   [db] DB_PATH: /tmp/macro.db
   [db] isVercel: true
   [db] Database initialized successfully at: /tmp/macro.db
   ```

2. **En la respuesta de /api/health:**
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
       ...
     }
   }
   ```

3. **En la respuesta de /api/diag:**
   ```json
   {
     "t10y2y_last": {...},
     "unrate_last": {...},
     "gdpc1_len": 123,
     ...
   }
   ```

### Si HAY problemas, verás:

1. **Error SQLITE_CANTOPEN:**
   ```
   SqliteError: unable to open database file (code: SQLITE_CANTOPEN)
   ```

2. **Path incorrecto:**
   ```
   [db] DB_PATH: /var/task/... (o cualquier path que NO sea /tmp/macro.db)
   ```

3. **isVercel: false:**
   ```
   [db] isVercel: false
   ```

---

## 🚀 Siguiente Paso

Una vez que tengas esta información:

1. **Copia las líneas de los logs** (especialmente las que empiezan con `[db]`)
2. **Copia cualquier error** que aparezca
3. **Indica el estado del deployment**
4. **Pega las respuestas de los endpoints**

Con esta información podremos identificar exactamente qué está pasando y qué necesita corregirse.

---

**Última actualización:** $(date +"%d/%m/%Y %H:%M")

