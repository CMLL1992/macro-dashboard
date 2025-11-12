# ✅ Verificación de Crons en Vercel

## 📍 Dónde Verificar los Crons

### Opción 1: Settings → Cron Jobs (Recomendado)

1. Ve a **Vercel Dashboard** → Tu proyecto (`macro-dashboard`)
2. Click en **Settings** (Configuración) en el menú superior
3. En el menú lateral izquierdo, busca y click en **Cron Jobs**
4. Deberías ver una lista de crons configurados

**Si no ves "Cron Jobs" en el menú:**
- Puede estar bajo otra sección como "Functions" o "Integrations"
- Los crons aparecen **solo después del primer deployment exitoso** con `vercel.json` que incluye la sección `crons`
- Espera 2-3 minutos después del deployment

### Opción 2: Deployments → Functions

1. Ve a **Deployments** → Último deployment
2. Busca la sección **Functions** o **Serverless Functions**
3. Los crons aparecen como funciones especiales con su schedule

### Opción 3: API de Vercel

Los crons también se pueden verificar mediante la API de Vercel, pero requiere autenticación.

## ✅ Qué Deberías Ver

Si los crons están configurados correctamente, deberías ver:

### Cron 1: `/api/warmup`
- **Path:** `/api/warmup`
- **Schedule:** `0 0 * * *` (diario a las 00:00 UTC)
- **Status:** Active
- **Última ejecución:** [fecha/hora]
- **Próxima ejecución:** [fecha/hora]

### Cron 2: `/api/jobs/weekly`
- **Path:** `/api/jobs/weekly`
- **Schedule:** `0 17 * * 0` (domingos a las 17:00 UTC)
- **Status:** Active
- **Última ejecución:** [fecha/hora o "Nunca" si aún no se ha ejecutado]
- **Próxima ejecución:** [fecha/hora del próximo domingo]

## 🔍 Verificar Ejecuciones

### En Runtime Logs

1. Ve a **Deployments** → Último deployment
2. Click en **Runtime Logs** o **Function Logs**
3. Busca logs que contengan:
   - `[warmup]` para el cron diario
   - `[weekly]` o `[jobs/weekly]` para el cron semanal

### Ejemplo de Logs Esperados

**Para `/api/warmup`:**
```
[warmup] start
[warmup] ingesting FRED data...
[warmup] ingested CPIAUCSL (180 points)
[warmup] done { updatedSeriesCount: 14, durationMs: 5000, errorsCount: 0 }
```

**Para `/api/jobs/weekly`:**
```
[jobs/weekly] Sending weekly ahead notification
[jobs/weekly] Weekly ahead notification sent
```

## ⚠️ Troubleshooting

### Los crons no aparecen

**Posibles causas:**
1. El deployment aún no se ha completado
2. `vercel.json` tiene errores de sintaxis
3. El plan Hobby no permite crons (debería permitirlos con limitaciones)

**Soluciones:**
1. Espera 2-3 minutos después del deployment
2. Verifica que `vercel.json` es JSON válido (sin comentarios)
3. Verifica que el deployment fue exitoso (status "Ready")

### Los crons aparecen pero no se ejecutan

**Posibles causas:**
1. El endpoint devuelve error
2. Falta autenticación (aunque debería funcionar con header `x-vercel-cron`)
3. Variables de entorno faltantes

**Soluciones:**
1. Revisa los **Runtime Logs** para ver errores
2. Prueba los endpoints manualmente:
   ```bash
   # Probar warmup
   curl https://macro-dashboard-seven.vercel.app/api/warmup
   
   # Probar weekly (debería funcionar desde cron de Vercel)
   curl -X POST https://macro-dashboard-seven.vercel.app/api/jobs/weekly
   ```
3. Verifica que las variables de entorno están configuradas

## 📅 Próximas Ejecuciones

### `/api/warmup`
- **Próxima ejecución:** Mañana a las 00:00 UTC (01:00 Madrid invierno)
- **Frecuencia:** Diario

### `/api/jobs/weekly`
- **Próxima ejecución:** Próximo domingo a las 17:00 UTC (18:00 Madrid invierno)
- **Frecuencia:** Semanal (domingos)

## ✅ Checklist de Verificación

- [ ] Los crons aparecen en Vercel Dashboard → Settings → Cron Jobs
- [ ] Ambos crons tienen status "Active"
- [ ] Los schedules son correctos (`0 0 * * *` y `0 17 * * 0`)
- [ ] Los endpoints responden correctamente cuando se prueban manualmente
- [ ] Las variables de entorno están configuradas
- [ ] Los logs muestran ejecuciones exitosas (después de la primera ejecución)

## 🎯 Siguiente Paso

Una vez verificados los crons, el sistema funcionará completamente automático:
- Datos FRED se actualizarán diariamente
- Previa semanal se enviará cada domingo
- Todo sin intervención manual

