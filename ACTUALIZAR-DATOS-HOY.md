# 🔄 Actualizar Todos los Datos hasta Hoy (13/11/2025)

## 📋 Opciones para Actualizar

Tienes 3 opciones para actualizar todos los datos:

---

## Opción 1: Ejecutar Script Local (Recomendado)

### Requisitos:
- Variables de entorno configuradas localmente
- O pasarlas como parámetros

### Pasos:

1. **Configura las variables de entorno:**
   ```bash
   export APP_URL="https://macro-dashboard-seven.vercel.app"
   export CRON_TOKEN="tu_cron_token"
   export INGEST_KEY="tu_ingest_key"
   export FRED_API_KEY="tu_fred_api_key"
   ```

2. **Ejecuta el script:**
   ```bash
   pnpm tsx scripts/update-all-data.ts
   ```

   O si prefieres usar el script de refresh existente:
   ```bash
   pnpm refresh
   ```

3. **Para actualizar noticias y calendario también:**
   ```bash
   # Noticias
   APP_URL="https://macro-dashboard-seven.vercel.app" \
   INGEST_KEY="tu_ingest_key" \
   pnpm tsx scripts/ingest-news-rss.ts

   # Calendario
   APP_URL="https://macro-dashboard-seven.vercel.app" \
   INGEST_KEY="tu_ingest_key" \
   FRED_API_KEY="tu_fred_api_key" \
   pnpm tsx scripts/ingest-calendar-fred.ts
   ```

---

## Opción 2: Ejecutar Workflows de GitHub Actions Manualmente

### Para Datos FRED, Correlaciones y Bias:

1. **Ve a GitHub:**
   - https://github.com/CMLL1992/macro-dashboard/actions

2. **Busca "Daily Macro Jobs":**
   - Click en "Run workflow"
   - Selecciona branch: `main`
   - Click en "Run workflow"

3. **Espera 2-3 minutos** a que complete

### Para Noticias y Calendario:

1. **Busca "News & Calendar Ingest":**
   - Click en "Run workflow"
   - Selecciona branch: `main`
   - Click en "Run workflow"

2. **Espera 1-2 minutos** a que complete

---

## Opción 3: Llamar Endpoints Directamente (Desde Terminal)

### Actualizar Datos FRED:
```bash
curl -X POST \
  -H "Authorization: Bearer tu_cron_token" \
  https://macro-dashboard-seven.vercel.app/api/jobs/ingest/fred
```

### Calcular Correlaciones:
```bash
curl -X POST \
  -H "Authorization: Bearer tu_cron_token" \
  https://macro-dashboard-seven.vercel.app/api/jobs/correlations
```

### Calcular Bias:
```bash
curl -X POST \
  -H "Authorization: Bearer tu_cron_token" \
  https://macro-dashboard-seven.vercel.app/api/jobs/compute/bias
```

### Actualizar Todo (Bootstrap):
```bash
curl -X POST \
  -H "Authorization: Bearer tu_cron_token" \
  https://macro-dashboard-seven.vercel.app/api/jobs/ingest/fred && \
curl -X POST \
  -H "Authorization: Bearer tu_cron_token" \
  https://macro-dashboard-seven.vercel.app/api/jobs/correlations && \
curl -X POST \
  -H "Authorization: Bearer tu_cron_token" \
  https://macro-dashboard-seven.vercel.app/api/jobs/compute/bias
```

---

## 📝 Valores Necesarios

### CRON_TOKEN
```
cbc3d1139031a75f4721ddb45bf8cca4a79b115d4c15ba83e1a1713898cdbc82
```
(O el que tengas configurado en Vercel)

### INGEST_KEY
```
cbc3d1139031a75f4721ddb45bf8cca4a79b115d4c15ba83e1a1713898cdbc82
```

### FRED_API_KEY
```
ccc90330e6a50afa217fb55ac48c4d28
```

### APP_URL
```
https://macro-dashboard-seven.vercel.app
```

---

## ✅ Qué Se Actualiza

1. **Datos FRED:**
   - 14 series macroeconómicas
   - CPI, Core CPI, PCE, Core PCE, PPI
   - GDP, Industrial Production, Retail Sales
   - NFP, Unemployment, Jobless Claims
   - Fed Funds Rate, 10Y-2Y Spread, VIX

2. **Correlaciones:**
   - Correlaciones entre pares FX y activos
   - Ventanas de 12 meses y 3 meses

3. **Bias Macro:**
   - Sesgo USD (Fuerte/Débil/Neutral)
   - Narrativas por par
   - Score macro

4. **Noticias:**
   - Noticias de Bloomberg, Reuters, Financial Times
   - Últimas 24 horas
   - Solo noticias de alto/medio impacto

5. **Calendario:**
   - Eventos económicos desde FRED API
   - Próximos eventos de la semana

---

## 🔍 Verificar Actualización

Después de ejecutar, verifica:

1. **Dashboard:**
   - https://macro-dashboard-seven.vercel.app/dashboard
   - Debe mostrar datos actualizados

2. **Noticias:**
   - https://macro-dashboard-seven.vercel.app/noticias
   - Debe mostrar noticias recientes

3. **Admin:**
   - https://macro-dashboard-seven.vercel.app/admin
   - Verifica estado del sistema

---

**Nota:** Los datos se actualizan automáticamente cada día, pero puedes forzar una actualización manual en cualquier momento usando cualquiera de estas opciones.



