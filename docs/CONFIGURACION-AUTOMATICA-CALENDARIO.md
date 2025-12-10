# ⚙️ Configuración Automática del Calendario Económico

## 🎯 Objetivo

Configurar el sistema para que el calendario económico se actualice **automáticamente** sin intervención manual.

---

## 📋 Requisitos Previos

### 1. API Key de TradingEconomics

**Obtener API Key:**
1. Regístrate en: https://tradingeconomics.com/api
2. Obtén tu API key gratuita (plan limitado) o de pago
3. Configúrala en variables de entorno

**Nota:** TradingEconomics tiene plan gratuito limitado. Para producción, considera planes de pago.

---

## 🔧 Configuración en Vercel (Producción)

### Paso 1: Configurar Variables de Entorno

En Vercel Dashboard → Settings → Environment Variables:

```
TRADING_ECONOMICS_API_KEY=tu_api_key_aqui
CRON_TOKEN=tu_token_secreto_fuerte
APP_URL=https://tu-app.vercel.app
```

### Paso 2: Verificar Cron Jobs

El archivo `vercel.json` ya está configurado:

```json
{
  "crons": [
    {
      "path": "/api/jobs/ingest/calendar",
      "schedule": "0 2 * * *"
    },
    {
      "path": "/api/jobs/ingest/releases",
      "schedule": "* 8-20 * * *"
    }
  ]
}
```

**Horarios:**
- **Calendario:** Cada día a las 02:00 UTC (actualiza semana completa)
- **Releases:** Cada minuto de 08:00 a 20:00 UTC (solo durante horas de mercado)

### Paso 3: Verificar que Funciona

1. Espera a que se ejecute el cron (o ejecuta manualmente para probar)
2. Verifica en `/calendario` que aparecen eventos
3. Revisa logs en Vercel para confirmar ejecución

---

## 🏠 Configuración Local (Desarrollo)

### Paso 1: Configurar `.env.local`

```bash
TRADING_ECONOMICS_API_KEY=tu_api_key_aqui
CRON_TOKEN=dev_local_token
APP_URL=http://localhost:3000
```

### Paso 2: Ejecutar Job Manualmente (para probar)

```bash
curl -X POST http://localhost:3000/api/jobs/ingest/calendar \
  -H "Authorization: Bearer dev_local_token" \
  -H "Content-Type: application/json"
```

### Paso 3: Verificar Resultado

```bash
# Ver eventos insertados
sqlite3 macro.db "SELECT COUNT(*) FROM economic_events WHERE scheduled_time_utc >= datetime('now')"

# Ver últimos eventos
sqlite3 macro.db "SELECT name, currency, scheduled_time_utc FROM economic_events ORDER BY scheduled_time_utc ASC LIMIT 10"
```

---

## 🔄 Automatización Completa

### En Vercel (Producción)

Los cron jobs se ejecutan automáticamente según `vercel.json`:

1. **Calendario (02:00 UTC):**
   - Actualiza eventos de la próxima semana
   - Se ejecuta una vez al día

2. **Releases (cada minuto 08:00-20:00 UTC):**
   - Busca eventos que deben publicarse
   - Crea releases cuando se publican los datos
   - Recalcula bias automáticamente

### En GitHub Actions (Alternativa)

Si prefieres usar GitHub Actions en vez de Vercel Crons:

**Crear `.github/workflows/calendar-ingest.yml`:**

```yaml
name: Calendar Ingest
on:
  schedule:
    - cron: '0 2 * * *'  # Cada día a las 02:00 UTC
  workflow_dispatch:

jobs:
  ingest:
    runs-on: ubuntu-latest
    steps:
      - name: Call Calendar Ingest
        run: |
          curl -X POST ${{ secrets.APP_URL }}/api/jobs/ingest/calendar \
            -H "Authorization: Bearer ${{ secrets.CRON_TOKEN }}"
```

**Crear `.github/workflows/releases-ingest.yml`:**

```yaml
name: Releases Ingest
on:
  schedule:
    - cron: '* 8-20 * * *'  # Cada minuto de 08:00 a 20:00 UTC
  workflow_dispatch:

jobs:
  ingest:
    runs-on: ubuntu-latest
    steps:
      - name: Call Releases Ingest
        run: |
          curl -X POST ${{ secrets.APP_URL }}/api/jobs/ingest/releases \
            -H "Authorization: Bearer ${{ secrets.CRON_TOKEN }}"
```

**Secrets necesarios en GitHub:**
- `APP_URL`: URL de tu app (ej: `https://tuapp.vercel.app`)
- `CRON_TOKEN`: Token secreto (debe coincidir con Vercel)

---

## ✅ Verificación de Funcionamiento

### 1. Verificar que los Jobs se Ejecutan

**En Vercel:**
- Ve a Dashboard → Deployments → Logs
- Busca ejecuciones de `/api/jobs/ingest/calendar`
- Verifica que no hay errores

**En GitHub Actions:**
- Ve a Actions → Calendar Ingest
- Verifica que los workflows se ejecutan correctamente

### 2. Verificar Datos en Base de Datos

```sql
-- Contar eventos futuros
SELECT COUNT(*) FROM economic_events 
WHERE scheduled_time_utc >= datetime('now');

-- Ver próximos eventos
SELECT name, currency, scheduled_time_utc, importance
FROM economic_events
WHERE scheduled_time_utc >= datetime('now')
ORDER BY scheduled_time_utc ASC
LIMIT 10;
```

### 3. Verificar en la UI

- Navega a `/calendario`
- Deberías ver eventos en "Próximos Eventos"
- Si hay releases, aparecerán en "Releases Recientes"

---

## 🐛 Troubleshooting

### Problema: No aparecen eventos en `/calendario`

**Posibles causas:**
1. `TRADING_ECONOMICS_API_KEY` no configurada o inválida
2. El job no se ha ejecutado aún
3. La API de TradingEconomics no retornó eventos

**Solución:**
```bash
# 1. Verificar API key
echo $TRADING_ECONOMICS_API_KEY

# 2. Ejecutar job manualmente
curl -X POST http://localhost:3000/api/jobs/ingest/calendar \
  -H "Authorization: Bearer dev_local_token"

# 3. Verificar logs del job para errores
```

### Problema: Cron jobs no se ejecutan en Vercel

**Solución:**
1. Verifica que `vercel.json` está en la raíz del proyecto
2. Verifica que las variables de entorno están configuradas
3. Verifica que el deployment incluye `vercel.json`
4. Revisa logs en Vercel Dashboard

### Problema: Error "TRADING_ECONOMICS_API_KEY is required"

**Solución:**
```bash
# En local, añadir a .env.local
echo "TRADING_ECONOMICS_API_KEY=tu_key_aqui" >> .env.local

# En Vercel, añadir en Environment Variables
# Settings → Environment Variables → Add
```

---

## 📊 Monitoreo

### Ver Estado de Jobs

```bash
curl http://localhost:3000/api/status/jobs
```

Respuesta:
```json
{
  "calendar": {
    "last_success_at": "2025-12-09T02:00:00Z",
    "status": "ok"
  },
  "releases": {
    "last_success_at": "2025-12-09T14:15:00Z",
    "status": "ok"
  }
}
```

### Ver en Dashboard

El componente `JobStatusIndicator` en el dashboard muestra el estado visual:
- ✅ Verde: Todo funcionando
- ⚠️ Amarillo: Posible retraso
- ❌ Rojo: Error

---

## 🎯 Resumen

**Para que todo sea automático:**

1. ✅ Configurar `TRADING_ECONOMICS_API_KEY` en Vercel
2. ✅ Verificar que `vercel.json` tiene los cron jobs configurados
3. ✅ Los jobs se ejecutarán automáticamente según el schedule
4. ✅ La página `/calendario` mostrará los eventos automáticamente

**No necesitas hacer nada manualmente** una vez configurado. Los jobs se ejecutan solos y la página se actualiza automáticamente.

