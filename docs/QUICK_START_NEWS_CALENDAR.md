# 🚀 Inicio Rápido - Pipeline de Noticias y Calendario

## ✅ Lo que se ha creado

He configurado un sistema completo para obtener noticias y eventos del calendario económico desde fuentes reales.

## 📋 Checklist de Activación

### 1. Configurar Secrets en GitHub (5 minutos)

1. Ve a tu repositorio en GitHub
2. Settings → Secrets and variables → Actions
3. Añade estos secrets:

   - **`APP_URL`**: `https://macro-dashboard-seven.vercel.app`
   - **`INGEST_KEY`**: (la misma clave que tienes en Vercel)
   - **`FRED_API_KEY`**: (opcional, pero recomendado - obtén una gratis en https://fred.stlouisfed.org/docs/api/api_key.html)

### 2. Activar el Workflow (1 minuto)

1. Ve a tu repositorio → pestaña "Actions"
2. Busca "News & Calendar Ingest"
3. Click en "Run workflow" → "Run workflow" (para probar manualmente)

### 3. Verificar que Funciona (2 minutos)

1. Espera 1-2 minutos a que termine el workflow
2. Ve a tu aplicación → `/noticias`
3. Deberías ver noticias nuevas (si hay noticias macro relevantes)

## 🔄 Funcionamiento Automático

Una vez configurado, el sistema:

- ✅ **Se ejecuta automáticamente cada 6 horas**
- ✅ **Obtiene noticias reales** de Bloomberg, Reuters, Financial Times
- ✅ **Obtiene eventos del calendario** desde FRED
- ✅ **Actualiza automáticamente** las páginas de noticias y narrativas
- ✅ **Envía notificaciones Telegram** cuando hay noticias nuevas

## 📊 Fuentes de Datos

### Noticias (RSS Feeds - Gratuitas)
- Bloomberg Economics RSS
- Reuters Business News RSS  
- Financial Times RSS

### Calendario (FRED API - Gratuita)
- Fechas de publicación de indicadores económicos
- Basado en los 15 indicadores principales del sistema

## ⚠️ Importante

- **Solo noticias reales**: El sistema NO genera contenido inventado
- **Filtrado inteligente**: Solo inserta noticias relacionadas con indicadores macro
- **Deduplicación automática**: No inserta noticias duplicadas
- **Si no hay noticias**: Es normal si no hay noticias macro relevantes en las últimas horas

## 🔧 Troubleshooting

**"No veo noticias nuevas"**
- Verifica que el workflow se ejecutó correctamente (ve a Actions → logs)
- Es normal si no hay noticias macro relevantes
- El sistema solo inserta noticias sobre CPI, NFP, GDP, Fed, etc.

**"Error: INGEST_KEY not set"**
- Verifica que el secret `INGEST_KEY` está configurado en GitHub
- Debe ser el mismo valor que en Vercel

**"Error al parsear RSS"**
- Algunos feeds pueden estar temporalmente no disponibles
- El sistema continuará con otros feeds
- Esto es normal y no afecta el funcionamiento general

## 📝 Próximos Pasos (Opcional)

Para mejorar aún más:

1. **Añadir más fuentes RSS** editando `scripts/ingest-news-rss.ts`
2. **Integrar APIs comerciales** (TradingEconomics, Bloomberg API) si tienes acceso
3. **Ajustar frecuencia** editando el cron en `.github/workflows/news-calendar-ingest.yml`

## ✅ Estado

- ✅ Scripts creados y funcionando
- ✅ GitHub Actions configurado
- ✅ Sistema de deduplicación activo
- ⚠️ **Pendiente**: Configurar secrets en GitHub para activar

**Una vez configurados los secrets, el sistema funcionará automáticamente.**





