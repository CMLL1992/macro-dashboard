# 🔄 Configuración del Pipeline de Noticias y Calendario

## ✅ Sistema Implementado

He creado un sistema completo para ingerir noticias y eventos del calendario económico desde fuentes reales.

## 📦 Componentes Creados

### 1. Script de Ingesta de Noticias (`scripts/ingest-news-rss.ts`)

**Fuentes de datos:**
- RSS feeds de Bloomberg Economics
- RSS feeds de Reuters Business News
- RSS feeds de Financial Times

**Funcionalidades:**
- ✅ Parsea feeds RSS automáticamente
- ✅ Identifica noticias macroeconómicas relevantes
- ✅ Extrae valores publicados y esperados cuando están disponibles
- ✅ Determina impacto (high/med/low) basándose en keywords
- ✅ Envía noticias a la API `/api/news/insert`

### 2. Script de Ingesta de Calendario (`scripts/ingest-calendar-fred.ts`)

**Fuentes de datos:**
- FRED API para obtener fechas de releases de indicadores
- Estimación de fechas basada en frecuencia de publicación

**Funcionalidades:**
- ✅ Obtiene eventos de los 15 indicadores principales
- ✅ Calcula fechas estimadas de publicación
- ✅ Envía eventos a la API `/api/calendar/insert`

### 3. GitHub Actions Workflow (`.github/workflows/news-calendar-ingest.yml`)

**Configuración:**
- ✅ Se ejecuta automáticamente cada 6 horas
- ✅ Puede ejecutarse manualmente con `workflow_dispatch`
- ✅ Instala dependencias y ejecuta los scripts

## 🚀 Cómo Activar el Sistema

### Paso 1: Configurar Secrets en GitHub

Ve a tu repositorio en GitHub → Settings → Secrets and variables → Actions

Añade estos secrets:

1. **`APP_URL`**: `https://macro-dashboard-seven.vercel.app` (o tu URL de producción)
2. **`INGEST_KEY`**: La misma clave que usas en Vercel (debe coincidir con `INGEST_KEY` en Vercel)
3. **`FRED_API_KEY`**: Tu API key de FRED (opcional, pero recomendado para calendario)

**Cómo obtener FRED API Key:**
1. Ve a https://fred.stlouisfed.org/docs/api/api_key.html
2. Regístrate (es gratuito)
3. Copia tu API key

### Paso 2: Verificar que el Workflow está Activo

1. Ve a tu repositorio en GitHub
2. Click en "Actions"
3. Verifica que el workflow "News & Calendar Ingest" aparece
4. Puedes ejecutarlo manualmente haciendo click en "Run workflow"

### Paso 3: Probar Localmente (Opcional)

```bash
# Configurar variables de entorno
export APP_URL="https://macro-dashboard-seven.vercel.app"
export INGEST_KEY="tu_ingest_key_aqui"
export FRED_API_KEY="tu_fred_api_key_aqui"  # Opcional

# Ejecutar ingesta de noticias
pnpm tsx scripts/ingest-news-rss.ts

# Ejecutar ingesta de calendario
pnpm tsx scripts/ingest-calendar-fred.ts
```

## 📊 Qué Hace el Sistema

### Noticias (RSS Feeds)

1. **Cada 6 horas**, el workflow:
   - Obtiene feeds RSS de Bloomberg, Reuters y Financial Times
   - Filtra solo noticias macroeconómicas relevantes
   - Identifica indicadores importantes (CPI, NFP, GDP, etc.)
   - Extrae valores cuando están disponibles
   - Envía a `/api/news/insert`

2. **El sistema automáticamente:**
   - Deduplica noticias (no inserta duplicados)
   - Envía notificaciones Telegram si es nueva
   - Actualiza la página `/noticias`

### Calendario (FRED)

1. **Cada 6 horas**, el workflow:
   - Consulta FRED API para obtener información de releases
   - Calcula fechas estimadas de publicación de indicadores
   - Envía eventos a `/api/calendar/insert`

2. **El sistema automáticamente:**
   - Deduplica eventos
   - Los eventos aparecen en la narrativa semanal
   - Se muestran en `/noticias` en la sección de eventos próximos

## 🔍 Verificación

### Verificar que Funciona

1. **Ejecutar manualmente el workflow:**
   - Ve a GitHub Actions
   - Click en "News & Calendar Ingest"
   - Click en "Run workflow"
   - Selecciona la rama y ejecuta

2. **Verificar logs:**
   - Revisa los logs del workflow para ver si hay errores
   - Deberías ver mensajes como "✅ Inserted: ..."

3. **Verificar en la aplicación:**
   - Ve a `/noticias` - deberías ver noticias nuevas
   - Ve a `/narrativas` - la narrativa semanal debería incluir eventos próximos

### Troubleshooting

**Problema: "INGEST_KEY not set"**
- Verifica que el secret `INGEST_KEY` está configurado en GitHub
- Debe ser el mismo valor que en Vercel

**Problema: "Failed to fetch RSS feed"**
- Algunos feeds RSS pueden estar bloqueados o no disponibles
- El script continuará con otros feeds
- Puedes añadir más feeds editando `RSS_FEEDS` en `scripts/ingest-news-rss.ts`

**Problema: "No hay noticias nuevas"**
- Es normal si no hay noticias macro relevantes en las últimas horas
- El sistema solo inserta noticias relacionadas con indicadores macro
- Verifica los logs para ver cuántas noticias se procesaron

## 🔧 Personalización

### Añadir Más Fuentes RSS

Edita `scripts/ingest-news-rss.ts` y añade más feeds:

```typescript
const RSS_FEEDS = [
  // ... feeds existentes
  {
    url: 'https://tu-fuente.com/rss',
    fuente: 'Tu Fuente',
    pais: 'US',
  },
]
```

### Ajustar Frecuencia

Edita `.github/workflows/news-calendar-ingest.yml`:

```yaml
schedule:
  # Cada 3 horas
  - cron: "0 */3 * * *"
  # O cada hora
  - cron: "0 * * * *"
```

### Mejorar Extracción de Valores

El script actual intenta extraer valores de los textos RSS. Puedes mejorarlo:
- Añadiendo más patrones de regex
- Integrando con APIs específicas (BLS, TradingEconomics)
- Usando NLP para extraer información estructurada

## 📝 Notas Importantes

1. **Datos Reales:** El sistema solo inserta noticias y eventos reales de fuentes confiables
2. **Deduplicación:** El sistema evita duplicados automáticamente
3. **Rate Limiting:** Los scripts respetan los límites de las APIs
4. **Errores:** Si un feed falla, el sistema continúa con otros feeds

## 🎯 Próximos Pasos (Opcional)

Para mejorar aún más el sistema, puedes:

1. **Integrar APIs comerciales:**
   - TradingEconomics API (requiere suscripción)
   - Bloomberg API (requiere suscripción)
   - BLS API (gratuita, pero requiere registro)

2. **Mejorar extracción de datos:**
   - Usar librerías de NLP para extraer valores
   - Integrar con servicios de scraping estructurado

3. **Añadir más fuentes:**
   - Fed announcements
   - ECB releases
   - Otros bancos centrales

## ✅ Estado Actual

- ✅ Scripts de ingesta creados
- ✅ GitHub Actions workflow configurado
- ✅ Sistema de deduplicación funcionando
- ✅ Integración con APIs de noticias y calendario
- ⚠️ **Pendiente:** Configurar secrets en GitHub para activar

Una vez configurados los secrets, el sistema comenzará a funcionar automáticamente cada 6 horas.



