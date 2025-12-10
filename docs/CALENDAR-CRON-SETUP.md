# 📅 Configuración del Calendario Macroeconómico - CRON

## ✅ Configuración Completada

### 1. CRON_TOKEN Configurado
El CRON_TOKEN ha sido configurado:
```
cbc3d1139031a75f4721ddb45bf8cca4a79b115d4c15ba83e1a1713898cdbc82
```

### 2. Workflow de GitHub Actions Actualizado
El workflow `.github/workflows/daily-jobs.yml` ha sido actualizado para incluir el job de calendario.

**Horario de ejecución:** Todos los días a las 06:00 UTC (07:00 Madrid invierno, 08:00 verano)

**Jobs ejecutados:**
1. Ingest FRED
2. Correlaciones
3. Compute Bias
4. Auto-ingest PMI from calendar
5. **Update Calendar Events** ← NUEVO

### 3. Endpoint del Job
```
POST /api/jobs/calendar/update
Authorization: Bearer {CRON_TOKEN}
```

## 🔧 Configuración Requerida

### En Vercel (Producción)
1. Ve a **Settings → Environment Variables**
2. Añade o verifica la variable:
   - **Name:** `CRON_TOKEN`
   - **Value:** `cbc3d1139031a75f4721ddb45bf8cca4a79b115d4c15ba83e1a1713898cdbc82`
   - **Environment:** Production, Preview, Development

### En GitHub Secrets
1. Ve a **Settings → Secrets and variables → Actions**
2. Añade o verifica el secret:
   - **Name:** `CRON_TOKEN`
   - **Value:** `cbc3d1139031a75f4721ddb45bf8cca4a79b115d4c15ba83e1a1713898cdbc82`

⚠️ **IMPORTANTE:** El CRON_TOKEN debe ser **idéntico** en Vercel y GitHub.

## 🧪 Probar el Job

### Opción 1: Script de Prueba
```bash
CRON_TOKEN="cbc3d1139031a75f4721ddb45bf8cca4a79b115d4c15ba83e1a1713898cdbc82" \
APP_URL="https://tu-app.vercel.app" \
pnpm tsx scripts/test-calendar-job.ts
```

### Opción 2: cURL Directo
```bash
curl -X POST "https://tu-app.vercel.app/api/jobs/calendar/update" \
  -H "Authorization: Bearer cbc3d1139031a75f4721ddb45bf8cca4a79b115d4c15ba83e1a1713898cdbc82" \
  -H "Content-Type: application/json"
```

### Opción 3: Ejecutar Manualmente en GitHub Actions
1. Ve a **Actions** en GitHub
2. Selecciona el workflow **Daily Macro Jobs**
3. Haz clic en **Run workflow**
4. Selecciona la rama (normalmente `main`)
5. Haz clic en **Run workflow**

## 📊 Qué Hace el Job

1. **Obtiene eventos de Trading Economics** para los próximos 7 días
2. **Mapea eventos** a indicadores internos usando `config/calendar-indicators.json`
3. **Guarda eventos** en la tabla `macro_events` de la base de datos
4. **Añade eventos estimados** (fallback) para indicadores importantes sin evento en TE

## 🔍 Verificar que Funciona

### 1. Verificar en la Base de Datos
```sql
SELECT COUNT(*) as total, 
       COUNT(CASE WHEN source = 'trading_economics' THEN 1 END) as from_te,
       COUNT(CASE WHEN source = 'estimated' THEN 1 END) as estimated
FROM macro_events 
WHERE date >= date('now') 
  AND date <= date('now', '+7 days');
```

### 2. Verificar en la Página de Noticias
1. Ve a `/noticias` en tu aplicación
2. Deberías ver eventos de la semana actual (o próxima si es domingo)
3. Los eventos mostrarán:
   - Fecha y hora
   - País
   - Indicador
   - Dato anterior
   - Consenso (previsión)

### 3. Verificar Logs
- **Vercel:** Dashboard → Deployments → Logs
- **GitHub Actions:** Actions → Daily Macro Jobs → Ver logs del último run

## 🚨 Troubleshooting

### Error 401 Unauthorized
- Verifica que `CRON_TOKEN` esté configurado en Vercel
- Verifica que `CRON_TOKEN` en GitHub sea idéntico al de Vercel
- Verifica que el token en la llamada sea correcto

### No se obtienen eventos
- Verifica que Trading Economics API esté funcionando
- Revisa los logs del job para ver errores de mapeo
- Verifica que `config/calendar-indicators.json` esté correcto

### Eventos no aparecen en la página
- Verifica que la tabla `macro_events` tenga datos
- Verifica que `getUpcomingEventsForWeek()` esté funcionando
- Revisa la consola del navegador para errores

## 📝 Notas

- El job se ejecuta **diariamente a las 06:00 UTC**
- Solo muestra eventos de **indicadores del motor macro** (los que están en `calendar-indicators.json`)
- Si no hay eventos en Trading Economics, se usan **eventos estimados** basados en frecuencia
- La página de Noticias tiene **fallback automático** al sistema legacy si no hay eventos en `macro_events`

