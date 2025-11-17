# 📊 Información para ChatGPT - Debug de /api/health

## 🎯 Objetivo

Obtener información específica sobre el error de `/api/health` para que ChatGPT pueda indicar la solución exacta.

---

## ✅ Paso 1: Revisar Logs de Vercel

### Instrucciones

1. **Accede a Vercel:**
   - Ve a: https://vercel.com
   - Inicia sesión
   - Selecciona el proyecto: `macro-dashboard`

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

5. **Copia el Error:**
   - Busca la entrada más reciente relacionada con `/api/health`
   - **Copia el mensaje de error completo** (primera línea)
   - **Copia el stack trace** si está disponible

### Ejemplo de lo que necesitamos:

```
[db] Error opening database at /tmp/macro.db
Error: Cannot access /tmp directory in Vercel
```

O:

```
SQLITE_ERROR: no such table: macro_observations
```

---

## ✅ Paso 2: Simplificar /api/health Temporalmente

### Opción A: Usar el Script (Recomendado)

```bash
cd /Users/carlosmontagutllarch/Desktop/macro-dashboard-with-data
chmod +x scripts/simplify-health-endpoint.sh
./scripts/simplify-health-endpoint.sh enable
```

### Opción B: Manual

```bash
cd /Users/carlosmontagutllarch/Desktop/macro-dashboard-with-data

# Hacer backup
cp app/api/health/route.ts app/api/health/route.ts.backup

# Usar versión simplificada
cp app/api/health/route.simple.ts app/api/health/route.ts
```

### Desplegar a Vercel

```bash
git add app/api/health/route.ts
git commit -m "test: versión simplificada /api/health para debug"
git push origin main
```

### Esperar Deployment (1-2 minutos)

Espera a que Vercel termine de desplegar. Puedes verificar en:
- Vercel Dashboard → Deployments → Último deployment

### Probar en Producción

```bash
curl https://macro-dashboard-seven.vercel.app/api/health | jq
```

### Resultado Esperado (si funciona):

```json
{
  "status": "ok",
  "message": "Health check simplificado - sin acceso a base de datos",
  "timestamp": "2024-01-15T10:00:00.000Z",
  "environment": "production",
  "isVercel": true,
  "test": {
    "canAccessProcess": true,
    "canAccessEnv": true,
    "nodeVersion": "v20.x.x"
  }
}
```

### Restaurar Versión Original (después de las pruebas)

```bash
./scripts/simplify-health-endpoint.sh disable
# O manualmente:
cp app/api/health/route.ts.backup app/api/health/route.ts
```

---

## ✅ Paso 3: Verificar /api/diag

### Probar el Endpoint

```bash
curl https://macro-dashboard-seven.vercel.app/api/diag | jq
```

### Qué Verificar

- ✅ **¿Responde correctamente?** (status 200)
- ❌ **¿Da error 500?** (igual que /api/health)
- ⚠️ **¿Da otro error?** (404, 503, etc.)

### Información del Endpoint

**Archivo:** `app/api/diag/route.ts`

**Funcionalidad:**
- Llama directamente a FRED (no usa base de datos)
- Obtiene datos de: T10Y2Y, UNRATE, GDPC1
- Retorna última fecha de ingesta y resultado de warmup

**Si funciona:** Confirma que el problema está en la base de datos, no en la configuración general.

**Si no funciona:** El problema puede ser más profundo (FRED_API_KEY, configuración de Vercel, etc.)

---

## 📋 Resumen de Información Necesaria

Para pasar a ChatGPT, necesitamos:

### 1. Error de Logs de Vercel
- [ ] Mensaje de error principal de `/api/health`
- [ ] Stack trace (si está disponible)

### 2. Resultado de Versión Simplificada
- [ ] ¿Funciona la versión simplificada en producción?
  - ✅ Sí → El problema está en la base de datos
  - ❌ No → El problema es más profundo (configuración de Vercel)

### 3. Estado de /api/diag
- [ ] ¿Funciona `/api/diag`?
  - ✅ Sí → Confirma que el problema es específico de la base de datos
  - ❌ No → El problema puede ser más general

### 4. Variables de Entorno (solo confirmar que existen)
- [ ] En Vercel: `FRED_API_KEY`, `CRON_TOKEN`, `INGEST_KEY`, `APP_URL`
- [ ] En GitHub: `APP_URL`, `CRON_TOKEN`, `INGEST_KEY`, `FRED_API_KEY`

---

## 🔍 Análisis del Código Actual

### /api/health (Versión Actual)

**Archivo:** `app/api/health/route.ts`

**Funcionalidad:**
- Usa `getDB()` para obtener la base de datos
- Consulta tablas: `macro_observations`, `macro_bias`, `correlations`
- Retorna conteos y estado de salud

**Mejoras ya aplicadas:**
- ✅ Verifica existencia de tablas antes de consultarlas
- ✅ Maneja errores de inicialización de BD
- ✅ Retorna valores por defecto si algo falla
- ✅ Logs detallados para debugging

### /api/diag

**Archivo:** `app/api/diag/route.ts`

**Funcionalidad:**
- Llama directamente a FRED (no usa base de datos)
- Obtiene: T10Y2Y, UNRATE, GDPC1
- Retorna última fecha de ingesta

**Diferencia clave:**
- `/api/diag` NO toca la base de datos
- `/api/health` SÍ toca la base de datos

---

## 🎯 Preguntas para ChatGPT

Una vez tengas la información, pregunta a ChatGPT:

1. **"El endpoint /api/health en Vercel está dando error 500. El error en los logs es: [PEGAR ERROR AQUÍ]"**

2. **"He simplificado el endpoint para que no toque la base de datos y [FUNCIONA/NO FUNCIONA] en producción. ¿Qué significa esto?"**

3. **"El endpoint /api/diag [FUNCIONA/NO FUNCIONA]. ¿Qué implica esto?"**

4. **"¿Cómo puedo hacer que /api/health funcione correctamente y muestre el estado real de los datos?"**

5. **"¿Por qué los jobs de FRED / correlaciones / bias no están metiendo datos reales en la base de datos?"**

---

## 📝 Template para ChatGPT

Copia y pega esto en ChatGPT, rellenando los campos:

```
Hola, tengo un problema con mi aplicación Next.js desplegada en Vercel.

1. ERROR EN LOGS DE VERCEL:
[PEGAR ERROR AQUÍ]

2. VERSIÓN SIMPLIFICADA DE /api/health:
- ¿Funciona en producción? [SÍ/NO]
- Si funciona, el problema está en la base de datos
- Si no funciona, el problema es más profundo

3. ENDPOINT /api/diag:
- ¿Funciona? [SÍ/NO]
- Si funciona, confirma que el problema es específico de la base de datos

4. VARIABLES DE ENTORNO:
- En Vercel existen: FRED_API_KEY, CRON_TOKEN, INGEST_KEY, APP_URL
- En GitHub existen: APP_URL, CRON_TOKEN, INGEST_KEY, FRED_API_KEY

5. PROBLEMA:
- /api/health devuelve error 500
- Los jobs de FRED / correlaciones / bias no están metiendo datos reales en la base de datos

¿Puedes indicarme paso a paso qué hay que corregir?
```

---

**Última actualización:** $(date +"%d/%m/%Y %H:%M")

