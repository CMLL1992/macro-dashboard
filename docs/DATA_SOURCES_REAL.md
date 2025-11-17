# Fuentes de Datos Reales - Sistema de Actualización

## 📊 Estado Actual de Datos Reales

### ✅ Datos que SÍ se actualizan automáticamente con datos reales:

#### 1. **Indicadores Macroeconómicos (FRED)**
- **Fuente:** Federal Reserve Economic Data (FRED API)
- **Actualización:** Diaria automática
- **Endpoints:**
  - Vercel Cron: `/api/warmup` (00:00 UTC diario)
  - GitHub Actions: `/api/jobs/ingest/fred` (06:00 UTC diario)
- **Indicadores actualizados:**
  - CPI, Core CPI, PCE, Core PCE, PPI
  - GDP (QoQ y YoY)
  - Industrial Production, Retail Sales
  - NFP, Unemployment Rate, Jobless Claims
  - Fed Funds Rate, 10Y-2Y Spread
  - VIX
- **Estado:** ✅ **FUNCIONANDO** - Datos reales de FRED

#### 2. **Correlaciones**
- **Fuente:** Cálculo basado en datos reales de precios (FRED, Yahoo Finance, Binance)
- **Actualización:** Diaria automática
- **Endpoint:** `/api/jobs/correlations` (06:00 UTC diario)
- **Estado:** ✅ **FUNCIONANDO** - Cálculos basados en datos reales

#### 3. **Bias y Narrativas**
- **Fuente:** Cálculo basado en indicadores macro reales
- **Actualización:** Diaria automática
- **Endpoint:** `/api/jobs/compute/bias` (06:00 UTC diario)
- **Estado:** ✅ **FUNCIONANDO** - Basado en datos reales de indicadores

#### 4. **Narrativa Semanal**
- **Fuente:** 
  - Datos macro reales de FRED
  - Noticias reales de la base de datos
  - Eventos del calendario reales
  - Postura monetaria calculada de datos reales
- **Actualización:** Semanal (domingos 17:00 UTC)
- **Endpoint:** `/api/jobs/weekly`
- **Estado:** ✅ **FUNCIONANDO** - Usa datos reales cuando están disponibles

### ⚠️ Datos que requieren ingesta externa:

#### 1. **Noticias (News Items)**
- **Estado:** ❌ **REQUIERE PIPELINE EXTERNO**
- **Endpoint:** `/api/news/insert`
- **Autenticación:** Requiere `X-INGEST-KEY` header
- **Qué necesitas:**
  - Un servicio externo que recolecte noticias de:
    - BLS (Bureau of Labor Statistics) - CPI, NFP, PPI
    - TradingEconomics - Eventos económicos
    - Bloomberg, Reuters - Noticias macro
    - Otras fuentes de noticias económicas
  - El servicio debe hacer `POST /api/news/insert` con los datos
- **Formato requerido:**
```json
{
  "id_fuente": "bls_2025-11_cpi",
  "fuente": "BLS",
  "pais": "US",
  "tema": "Inflación",
  "titulo": "CPI m/m (oct)",
  "impacto": "high",
  "published_at": "2025-11-10T13:30:00Z",
  "valor_publicado": 0.5,
  "valor_esperado": 0.3,
  "resumen": "Lectura por encima del consenso."
}
```

#### 2. **Eventos del Calendario (Calendar Events)**
- **Estado:** ❌ **REQUIERE PIPELINE EXTERNO**
- **Endpoint:** `/api/calendar/insert`
- **Autenticación:** Requiere `X-INGEST-KEY` header
- **Qué necesitas:**
  - Un servicio externo que recolecte eventos del calendario económico de:
    - TradingEconomics
    - Investing.com
    - Bloomberg Economic Calendar
    - Otras fuentes de calendario económico
  - El servicio debe hacer `POST /api/calendar/insert` con los datos
- **Formato requerido:**
```json
{
  "fecha": "2025-11-20",
  "hora_local": "14:30",
  "pais": "US",
  "tema": "Inflación",
  "evento": "CPI m/m",
  "importancia": "high",
  "consenso": "0.3%"
}
```

## 🔧 Cómo Configurar Pipelines Externos

### Opción 1: GitHub Actions (Recomendado)

Ya existe un template en `.github/workflows/news-calendar-ingest.yml`:

1. **Edita el workflow** para agregar tu lógica de recolección
2. **Configura secrets en GitHub:**
   - `INGEST_KEY`: Tu clave de ingesta
   - `APP_URL`: URL de tu aplicación (ej: `https://macro-dashboard-seven.vercel.app`)
3. **Ejecuta el workflow** manualmente o en schedule

### Opción 2: Script Python/Node.js

Crea un script que:
1. Recolecte noticias/eventos de APIs externas
2. Haga `POST` a `/api/news/insert` o `/api/calendar/insert`
3. Se ejecute en un cron job o servicio cloud (Vercel Cron, AWS Lambda, etc.)

### Opción 3: Webhook desde Servicio Externo

Si tienes un servicio que ya recolecta noticias:
1. Configura un webhook que llame a `/api/news/insert`
2. Usa el header `X-INGEST-KEY` para autenticación

## 📝 Verificación de Datos Reales

### Para verificar que los datos son reales:

1. **Indicadores Macro:**
   - Ve a `/dashboard`
   - Los valores deben coincidir con los publicados en FRED
   - Verifica en: https://fred.stlouisfed.org/

2. **Noticias:**
   - Ve a `/noticias`
   - Solo se mostrarán noticias que hayan sido insertadas vía API
   - Si no hay noticias, significa que no se ha configurado el pipeline externo

3. **Narrativas:**
   - Ve a `/narrativas`
   - La narrativa semanal usa:
     - Datos macro reales (siempre disponibles)
     - Noticias reales (solo si hay noticias en la BD)
     - Eventos del calendario (solo si hay eventos en la BD)

## ⚠️ Importante

**NO se genera contenido inventado.** El sistema:
- ✅ Usa datos reales de FRED para indicadores macro
- ✅ Usa noticias reales de la base de datos (si están disponibles)
- ✅ Usa eventos reales del calendario (si están disponibles)
- ✅ Calcula narrativas basándose en datos reales
- ❌ NO inventa noticias
- ❌ NO inventa eventos
- ❌ NO genera contenido ficticio

Si no hay noticias o eventos en la base de datos, las secciones correspondientes mostrarán mensajes indicando que no hay datos disponibles.

## 🚀 Próximos Pasos

Para tener datos completamente actualizados:

1. **Configurar pipeline de noticias:**
   - Elegir fuente (BLS, TradingEconomics, etc.)
   - Crear script/service que haga `POST /api/news/insert`
   - Configurar ejecución automática (cron, GitHub Actions, etc.)

2. **Configurar pipeline de calendario:**
   - Similar a noticias
   - Crear script/service que haga `POST /api/calendar/insert`

3. **Verificar que los datos se están insertando:**
   - Revisar `/noticias` para ver noticias nuevas
   - Revisar logs del sistema para ver inserciones exitosas





