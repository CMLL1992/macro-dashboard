# ⏰ Configuración de Crons en Vercel

Este documento explica cómo funcionan los crons de Vercel y cómo verificar que están activos.

## 📋 Crons Configurados

En `vercel.json` tenemos configurados 2 crons:

```json
{
  "crons": [
    {
      "path": "/api/warmup",
      "schedule": "0 0 * * *"
    },
    {
      "path": "/api/jobs/weekly",
      "schedule": "0 17 * * 0"
    }
  ]
}
```

### 1. `/api/warmup` - Diario
- **Schedule:** `0 0 * * *` (00:00 UTC / 01:00 Madrid invierno)
- **Qué hace:**
  - Actualiza datos FRED (14 series macroeconómicas)
  - Inicializa sistema de notificaciones
  - Pre-calienta diagnóstico macro y correlaciones
- **Autenticación:** No requiere (endpoint público GET)

### 2. `/api/jobs/weekly` - Semanal
- **Schedule:** `0 17 * * 0` (17:00 UTC / 18:00 Madrid invierno, domingos)
- **Qué hace:**
  - Envía previa semanal por Telegram
  - Incluye eventos del calendario económico de la semana
- **Autenticación:** Acepta llamadas desde Vercel crons (header `x-vercel-cron`)

## 🔍 Cómo Verificar que los Crons Están Activos

### Paso 1: Verificar en Vercel Dashboard

1. Ve a **Vercel Dashboard** → Tu proyecto (`macro-dashboard`)
2. Click en **Settings** (Configuración)
3. En el menú lateral, busca **Cron Jobs** (puede estar bajo "Functions" o directamente en Settings)
4. Deberías ver 2 crons listados:
   - `/api/warmup` - `0 0 * * *`
   - `/api/jobs/weekly` - `0 17 * * 0`

**Nota:** Los crons aparecen **después del primer deployment exitoso** que incluye `vercel.json` con la sección `crons`.

### Paso 2: Verificar Ejecuciones

1. En la misma página de **Cron Jobs**, deberías ver:
   - Última ejecución
   - Próxima ejecución
   - Estado (Active/Inactive)
   - Historial de ejecuciones

2. También puedes verificar en **Deployments** → Último deployment → **Functions** → Buscar los endpoints

### Paso 3: Verificar en Logs

1. Ve a **Deployments** → Último deployment
2. Click en **Runtime Logs** o **Function Logs**
3. Busca logs que empiecen con `[warmup]` o `[weekly]`
4. Los logs aparecerán cuando los crons se ejecuten según su schedule

## ⚠️ Limitaciones del Plan Hobby

El plan **Hobby** de Vercel tiene limitaciones:

- **1 ejecución diaria por cron** (máximo)
- Los crons se ejecutan en horarios específicos
- No hay garantía de ejecución exacta (puede haber retrasos)

**Nuestros crons están optimizados para Hobby:**
- `/api/warmup`: 1 vez al día ✅
- `/api/jobs/weekly`: 1 vez a la semana (domingo) ✅

## 🔧 Troubleshooting

### Los crons no aparecen en el Dashboard

**Causa:** El deployment aún no se ha completado o `vercel.json` tiene errores.

**Solución:**
1. Verifica que el último deployment fue exitoso
2. Verifica que `vercel.json` está en la raíz del proyecto
3. Verifica que el formato JSON es válido (sin comentarios)
4. Espera 2-3 minutos después del deployment

### Los crons no se ejecutan

**Causa:** Puede ser un problema de autenticación o el endpoint devuelve error.

**Solución:**
1. Revisa los **Runtime Logs** para ver errores
2. Verifica que las variables de entorno están configuradas:
   - `FRED_API_KEY` (para `/api/warmup`)
   - `INGEST_KEY` o `CRON_TOKEN` (para `/api/jobs/weekly`)
3. Prueba los endpoints manualmente:
   ```bash
   # Probar warmup
   curl https://macro-dashboard-seven.vercel.app/api/warmup
   
   # Probar weekly (requiere autenticación)
   curl -X POST https://macro-dashboard-seven.vercel.app/api/jobs/weekly \
     -H "X-INGEST-KEY: tu_ingest_key"
   ```

### El cron se ejecuta pero falla

**Causa:** Error en el código del endpoint o falta de variables de entorno.

**Solución:**
1. Revisa los **Runtime Logs** para ver el error exacto
2. Verifica que todas las variables de entorno están configuradas
3. Verifica que la base de datos funciona (si aplica)
4. Revisa los logs del endpoint específico

## 📅 Horarios en Diferentes Zonas

### `/api/warmup` - Diario 00:00 UTC
- **Madrid (invierno, UTC+1):** 01:00
- **Madrid (verano, UTC+2):** 02:00
- **Nueva York (invierno, UTC-5):** 19:00 (día anterior)
- **Nueva York (verano, UTC-4):** 20:00 (día anterior)

### `/api/jobs/weekly` - Domingos 17:00 UTC
- **Madrid (invierno, UTC+1):** 18:00 domingo
- **Madrid (verano, UTC+2):** 19:00 domingo
- **Nueva York (invierno, UTC-5):** 12:00 domingo
- **Nueva York (verano, UTC-4):** 13:00 domingo

## ✅ Checklist de Verificación

- [ ] `vercel.json` tiene la sección `crons` configurada
- [ ] El último deployment fue exitoso
- [ ] Los crons aparecen en Vercel Dashboard → Settings → Cron Jobs
- [ ] Las variables de entorno están configuradas
- [ ] Los endpoints responden correctamente cuando se prueban manualmente
- [ ] Los logs muestran ejecuciones exitosas (después de la primera ejecución automática)

## 🎯 Próximos Pasos

Una vez que los crons estén activos:

1. **Monitorear ejecuciones:** Revisa los logs después de la primera ejecución automática
2. **Verificar datos:** Comprueba que los datos se actualizan correctamente
3. **Ajustar horarios:** Si es necesario, modifica los schedules en `vercel.json` y haz redeploy

**Nota:** Los cambios en `vercel.json` requieren un nuevo deployment para surtir efecto.

