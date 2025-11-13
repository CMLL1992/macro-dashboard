# 🔗 Integración de Múltiples Fuentes de Datos

## ✅ Fuentes Implementadas

### 📰 Noticias

1. **RSS Feeds** (Gratis)
   - Bloomberg Economics RSS
   - Reuters Business News RSS
   - Financial Times RSS
   - Script: `scripts/ingest-news-rss.ts`

2. **Financial Modeling Prep** (API Key requerida)
   - Noticias financieras
   - Script: `scripts/ingest-fmp.ts`
   - Variable: `FMP_API_KEY`

3. **Finnhub** (API Key requerida)
   - Noticias en tiempo casi real
   - Script: `scripts/ingest-finnhub.ts`
   - Variable: `FINNHUB_API_KEY`

4. **NewsAPI** (API Key requerida, plan gratuito: 100 requests/día)
   - Noticias económicas generales
   - Script: `scripts/ingest-newsapi.ts`
   - Variable: `NEWSAPI_KEY`

### 📅 Calendario Económico

1. **FRED** (API Key requerida)
   - Eventos de releases de indicadores
   - Script: `scripts/ingest-calendar-fred.ts`
   - Variable: `FRED_API_KEY`

2. **Forex Factory** (Gratis - RSS/XML)
   - Calendario semanal con high impact news
   - Script: `scripts/ingest-calendar-forexfactory.ts`
   - URL: `https://www.forexfactory.com/ff_calendar_thisweek.xml`

3. **Financial Modeling Prep** (API Key requerida)
   - Calendario económico estructurado
   - Script: `scripts/ingest-fmp.ts`
   - Variable: `FMP_API_KEY`

4. **Finnhub** (API Key requerida)
   - Calendario económico
   - Script: `scripts/ingest-finnhub.ts`
   - Variable: `FINNHUB_API_KEY`

5. **Trading Economics** (Gratis con acceso guest)
   - Calendario económico
   - Script: `scripts/ingest-tradingeconomics.ts`
   - Variable: `TRADING_ECONOMICS_API_KEY` (opcional, usa guest:guest si no está)

## 🚀 Script Maestro

**`scripts/ingest-all-sources.ts`** - Ejecuta todas las fuentes automáticamente

Este script:
- Ejecuta todas las fuentes disponibles
- Maneja errores de forma independiente (si una falla, las demás continúan)
- Muestra un resumen completo al final
- Respeta las variables de entorno (si no hay API key, omite esa fuente)

## ⚙️ Configuración

### Variables de Entorno Requeridas

```bash
APP_URL=https://macro-dashboard-seven.vercel.app
INGEST_KEY=tu_ingest_key
FRED_API_KEY=tu_fred_key  # Requerido para FRED calendar
```

### Variables de Entorno Opcionales

```bash
FMP_API_KEY=tu_fmp_key  # Para Financial Modeling Prep
FINNHUB_API_KEY=tu_finnhub_key  # Para Finnhub
NEWSAPI_KEY=tu_newsapi_key  # Para NewsAPI
TRADING_ECONOMICS_API_KEY=tu_te_key  # Opcional, usa guest:guest si no está
```

### Configurar en GitHub Secrets

1. Ve a: https://github.com/CMLL1992/macro-dashboard/settings/secrets/actions
2. Añade los secrets opcionales:
   - `FMP_API_KEY` (si tienes cuenta de Financial Modeling Prep)
   - `FINNHUB_API_KEY` (si tienes cuenta de Finnhub)
   - `NEWSAPI_KEY` (si tienes cuenta de NewsAPI)
   - `TRADING_ECONOMICS_API_KEY` (opcional, para acceso premium)

### Configurar en Vercel

1. Ve a: Vercel Dashboard → Tu proyecto → Settings → Environment Variables
2. Añade las mismas variables de entorno

## 🔄 Automatización

### GitHub Actions Workflow

El workflow `.github/workflows/news-calendar-ingest.yml` se ejecuta:
- **Automáticamente:** Cada 6 horas (`0 */6 * * *`)
- **Manualmente:** Desde GitHub Actions → "Run workflow"

### Ejecución Local

```bash
# Ejecutar todas las fuentes
APP_URL="https://macro-dashboard-seven.vercel.app" \
INGEST_KEY="tu_key" \
FRED_API_KEY="tu_fred_key" \
FMP_API_KEY="tu_fmp_key" \
FINNHUB_API_KEY="tu_finnhub_key" \
NEWSAPI_KEY="tu_newsapi_key" \
pnpm tsx scripts/ingest-all-sources.ts

# O ejecutar fuentes individuales
pnpm tsx scripts/ingest-news-rss.ts
pnpm tsx scripts/ingest-calendar-forexfactory.ts
pnpm tsx scripts/ingest-fmp.ts
pnpm tsx scripts/ingest-finnhub.ts
pnpm tsx scripts/ingest-tradingeconomics.ts
pnpm tsx scripts/ingest-newsapi.ts
```

## 📊 Resumen de Fuentes

| Fuente | Tipo | Costo | API Key | Estado |
|--------|------|-------|---------|--------|
| RSS (Bloomberg, Reuters, FT) | Noticias | Gratis | No | ✅ Implementado |
| Forex Factory | Calendario | Gratis | No | ✅ Implementado |
| Trading Economics | Calendario | Gratis (guest) | Opcional | ✅ Implementado |
| FRED | Calendario | Gratis | Sí | ✅ Implementado |
| Financial Modeling Prep | Noticias + Calendario | Gratis/Pago | Sí | ✅ Implementado |
| Finnhub | Noticias + Calendario | Gratis/Pago | Sí | ✅ Implementado |
| NewsAPI | Noticias | Gratis (100/día) | Sí | ✅ Implementado |

## 🎯 Recomendaciones

### Para Máxima Cobertura (Recomendado)

1. **Gratis (siempre activo):**
   - RSS News (Bloomberg, Reuters, Financial Times)
   - Forex Factory Calendar
   - Trading Economics Calendar (guest)

2. **Con API Keys gratuitas:**
   - FRED Calendar (ya configurado)
   - NewsAPI (100 requests/día - suficiente para 6 horas)
   - Finnhub (plan gratuito)
   - Financial Modeling Prep (plan gratuito)

### Prioridad de Configuración

1. **Alta:** FRED_API_KEY (ya configurado)
2. **Media:** FINNHUB_API_KEY, FMP_API_KEY
3. **Baja:** NEWSAPI_KEY, TRADING_ECONOMICS_API_KEY

## ✅ Verificación

Después de configurar, verifica:

1. **Dashboard de Noticias:**
   - https://macro-dashboard-seven.vercel.app/noticias
   - Debe mostrar noticias de múltiples fuentes

2. **Calendario:**
   - Los eventos deben aparecer en la página de noticias
   - Deben incluir eventos de Forex Factory, FRED, etc.

3. **GitHub Actions:**
   - Ve a: https://github.com/CMLL1992/macro-dashboard/actions
   - Verifica que el workflow "News & Calendar Ingest (All Sources)" se ejecute correctamente

## 🔧 Troubleshooting

### Si una fuente falla:

- El script maestro continúa con las demás fuentes
- Revisa los logs en GitHub Actions
- Verifica que las API keys sean válidas
- Algunas APIs tienen límites de rate (espera entre requests)

### Si no hay datos:

- Verifica que las variables de entorno estén configuradas
- Algunas fuentes requieren API keys (ver tabla arriba)
- Las fuentes gratuitas (RSS, Forex Factory) deberían funcionar siempre

---

**Última actualización:** 13/11/2025  
**Estado:** ✅ Todas las fuentes implementadas y funcionando automáticamente

