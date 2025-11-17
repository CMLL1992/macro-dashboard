# ✅ Pipelines de Noticias y Calendario - Implementados
**Fecha:** 13 de Noviembre de 2025

---

## 📦 Componentes Implementados

### 1. ✅ Script de Ingesta de Noticias (`scripts/ingest-news-rss.ts`)

**Fuentes de datos:**
- ✅ Bloomberg Economics RSS
- ✅ Reuters Business News RSS
- ✅ Financial Times RSS

**Funcionalidades:**
- ✅ Parsea feeds RSS automáticamente
- ✅ Identifica noticias macroeconómicas relevantes (filtra por keywords)
- ✅ Extrae valores publicados y esperados cuando están disponibles
- ✅ Determina impacto (high/med/low) basándose en keywords
- ✅ Identifica tema (Inflación, Empleo, Crecimiento, Política Monetaria)
- ✅ Identifica país (US, EU, UK, JP)
- ✅ Solo procesa noticias de las últimas 24 horas
- ✅ Solo procesa noticias de impacto alto o medio
- ✅ Envía noticias a la API `/api/news/insert`
- ✅ El sistema envía automáticamente a Telegram cuando hay noticias nuevas

**Keywords de alto impacto:**
- CPI, PPI, NFP, Nonfarm Payrolls, GDP, Fed, Federal Reserve, Interest Rate, Unemployment

**Keywords de impacto medio:**
- Retail Sales, Industrial Production, PMI, ISM, Jobless Claims

---

### 2. ✅ Script de Ingesta de Calendario (`scripts/ingest-calendar-fred.ts`)

**Fuentes de datos:**
- ✅ FRED API para obtener fechas de releases de indicadores
- ✅ Estimación de fechas basada en frecuencia de publicación

**Funcionalidades:**
- ✅ Obtiene eventos de los 9 indicadores principales:
  - CPI m/m, Core CPI m/m, PPI m/m
  - Nonfarm Payrolls (NFP), Unemployment Rate
  - GDP QoQ, Industrial Production, Retail Sales
  - Fed Funds Rate Decision
- ✅ Calcula fechas estimadas de publicación
- ✅ Solo incluye eventos de los próximos 30 días
- ✅ Envía eventos a la API `/api/calendar/insert`
- ✅ Los eventos se incluyen automáticamente en el weekly ahead (domingos)

---

### 3. ✅ GitHub Actions Workflow (`.github/workflows/news-calendar-ingest.yml`)

**Configuración:**
- ✅ Se ejecuta automáticamente cada 6 horas (`0 */6 * * *`)
- ✅ Puede ejecutarse manualmente con `workflow_dispatch`
- ✅ Instala dependencias (pnpm, Node.js 20)
- ✅ Ejecuta ambos scripts (noticias y calendario)
- ✅ Reporta resultados

**Jobs:**
1. **ingest-news**: Ejecuta `scripts/ingest-news-rss.ts`
2. **ingest-calendar**: Ejecuta `scripts/ingest-calendar-fred.ts`

---

## 🚀 Cómo Activar el Sistema

### Paso 1: Configurar Secrets en GitHub

Ve a tu repositorio en GitHub → **Settings → Secrets and variables → Actions**

Añade estos secrets (si no los tienes ya):

1. **`APP_URL`**: `https://macro-dashboard-seven.vercel.app` (o tu URL de producción)
2. **`INGEST_KEY`**: La misma clave que usas en Vercel (debe coincidir con `INGEST_KEY` en Vercel)
3. **`FRED_API_KEY`**: Tu API key de FRED (opcional, pero recomendado para calendario)

**Cómo obtener FRED API Key:**
1. Ve a https://fred.stlouisfed.org/docs/api/api_key.html
2. Regístrate (es gratuito)
3. Copia tu API key

### Paso 2: Verificar que el Workflow está Activo

1. Ve a tu repositorio → pestaña **"Actions"**
2. Busca **"News & Calendar Ingest"**
3. Verifica que el workflow está habilitado
4. (Opcional) Click en **"Run workflow"** → **"Run workflow"** para probar manualmente

### Paso 3: Verificar que Funciona

1. Espera 1-2 minutos después de que se ejecute el workflow
2. Ve a tu aplicación → `/noticias` - deberías ver noticias nuevas (si hay noticias macro relevantes)
3. Ve a `/noticias` - deberías ver eventos del calendario de la próxima semana
4. Verifica en Telegram que recibes notificaciones cuando hay noticias nuevas

---

## 🔄 Funcionamiento Automático

Una vez configurado, el sistema:

- ✅ **Se ejecuta automáticamente cada 6 horas** (GitHub Actions)
- ✅ **Obtiene noticias reales** de Bloomberg, Reuters, Financial Times
- ✅ **Obtiene eventos del calendario** desde FRED
- ✅ **Actualiza automáticamente** las páginas de noticias
- ✅ **Envía notificaciones Telegram** cuando hay noticias nuevas
- ✅ **Incluye eventos en weekly ahead** automáticamente (domingos)
- ✅ **Funciona con PC cerrado** (GitHub ejecuta en la nube)

---

## 📊 Flujo Completo

### Noticias:
```
RSS Feeds (Bloomberg, Reuters, FT)
    ↓
Script de ingesta (cada 6 horas)
    ↓
POST /api/news/insert
    ↓
Sistema verifica deduplicación
    ↓
Si es nueva → Inserta en BD
    ↓
Sistema envía notificación Telegram automáticamente
    ↓
Aparece en /noticias
```

### Calendario:
```
FRED API
    ↓
Script de ingesta (cada 6 horas)
    ↓
POST /api/calendar/insert
    ↓
Sistema verifica deduplicación
    ↓
Si es nuevo → Inserta en BD
    ↓
Aparece en /noticias (próxima semana)
    ↓
Se incluye en weekly ahead (domingos)
```

---

## ⚙️ Configuración de Variables de Entorno

### En Vercel:
```bash
INGEST_KEY=tu_ingest_key_secreta
FRED_API_KEY=tu_fred_api_key (opcional)
```

### En GitHub Secrets:
```bash
APP_URL=https://macro-dashboard-seven.vercel.app
INGEST_KEY=tu_ingest_key_secreta (mismo que en Vercel)
FRED_API_KEY=tu_fred_api_key (opcional)
```

---

## 🧪 Pruebas Manuales

### Probar ingesta de noticias localmente:
```bash
cd /Users/carlosmontagutllarch/Desktop/macro-dashboard-with-data
APP_URL=http://localhost:3000 INGEST_KEY=tu_key pnpm tsx scripts/ingest-news-rss.ts
```

### Probar ingesta de calendario localmente:
```bash
cd /Users/carlosmontagutllarch/Desktop/macro-dashboard-with-data
APP_URL=http://localhost:3000 INGEST_KEY=tu_key FRED_API_KEY=tu_fred_key pnpm tsx scripts/ingest-calendar-fred.ts
```

---

## ⚠️ Notas Importantes

1. **Solo noticias reales**: El sistema NO genera contenido inventado
2. **Filtrado inteligente**: Solo inserta noticias relacionadas con indicadores macro
3. **Deduplicación automática**: No inserta noticias duplicadas (ventana de 2 horas)
4. **Si no hay noticias**: Es normal si no hay noticias macro relevantes en las últimas 24 horas
5. **Rate limiting**: Los RSS feeds pueden tener rate limits, el sistema maneja errores gracefully
6. **FRED API**: Es gratuita pero tiene límites de rate (el script maneja esto)

---

## 📈 Monitoreo

### Ver logs del workflow:
1. Ve a GitHub → Actions → "News & Calendar Ingest"
2. Click en el último run
3. Revisa los logs de cada job

### Ver noticias insertadas:
- Ve a `/noticias` en tu aplicación
- O consulta directamente la BD: `SELECT * FROM news_items ORDER BY created_at DESC LIMIT 10`

### Ver eventos del calendario:
- Ve a `/noticias` (muestra eventos de próxima semana)
- O consulta directamente la BD: `SELECT * FROM macro_calendar WHERE fecha >= date('now') ORDER BY fecha LIMIT 20`

---

## ✅ Checklist de Activación

- [ ] Secrets configurados en GitHub (`APP_URL`, `INGEST_KEY`, `FRED_API_KEY`)
- [ ] `INGEST_KEY` configurado en Vercel (debe coincidir con GitHub)
- [ ] Workflow activado en GitHub Actions
- [ ] Probar ejecución manual del workflow
- [ ] Verificar que aparecen noticias en `/noticias`
- [ ] Verificar que aparecen eventos en `/noticias` (próxima semana)
- [ ] Verificar que llegan notificaciones Telegram cuando hay noticias nuevas

---

**Última actualización:** 2025-11-13  
**Estado:** ✅ **IMPLEMENTADO Y LISTO PARA USAR**

