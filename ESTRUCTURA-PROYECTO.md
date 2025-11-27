# 📁 Estructura Completa del Proyecto CM11 Trading

**Ubicación:** `/Users/carlosmontagutllarch/Desktop/macro-dashboard-with-data 2`

**Última actualización:** 13 de Noviembre de 2025

---

## 📂 Estructura de Directorios

### 🎨 **Frontend (app/)**

```
app/
├── page.tsx                    # Página principal (redirige a /dashboard)
├── layout.tsx                  # Layout principal de la aplicación
├── globals.css                 # Estilos globales
│
├── dashboard/                  # Dashboard principal
│   ├── page.tsx               # Vista principal del dashboard
│   ├── loading.tsx            # Estado de carga
│   └── error.tsx              # Manejo de errores
│
├── correlations/               # Página de correlaciones
│   └── page.tsx
│
├── narrativas/                 # Narrativas macroeconómicas
│   ├── page.tsx               # Lista de narrativas
│   ├── [symbol]/page.tsx      # Narrativa detallada por activo
│   └── loading.tsx
│
├── noticias/                   # Calendario económico y noticias
│   └── page.tsx
│
├── notificaciones/             # Configuración de notificaciones
│   └── page.tsx               # ⭐ Incluye botón de prueba de Telegram
│
├── admin/                      # Panel de administración
│   ├── page.tsx               # Dashboard admin
│   ├── login/page.tsx         # Login admin
│   ├── news/page.tsx          # Gestión de noticias
│   ├── calendar/page.tsx     # Gestión de calendario
│   └── notifications/page.tsx # Gestión de notificaciones
│
├── ayuda/                      # Página de ayuda
├── qa/                        # Quality Assurance
├── sesgos/                    # Página de sesgos
└── settings/                  # Configuración
```

### 🔌 **API Routes (app/api/)**

```
app/api/
├── notifications/              # Sistema de notificaciones
│   ├── test/route.ts         # ⭐ Endpoint para probar Telegram
│   ├── verify/route.ts      # Verificar configuración
│   ├── history/route.ts     # Historial de notificaciones
│   └── settings/route.ts     # Configuración de notificaciones
│
├── news/                      # Noticias
│   └── insert/route.ts       # Insertar noticias
│
├── calendar/                   # Calendario económico
│   └── insert/route.ts       # Insertar eventos
│
├── jobs/                       # Jobs automatizados
│   ├── ingest/
│   │   ├── fred/route.ts    # Ingesta de datos FRED
│   │   └── macro/route.ts   # Ingesta de datos macro
│   ├── correlations/route.ts # Cálculo de correlaciones
│   ├── compute/bias/route.ts # Cálculo de sesgos
│   └── weekly/route.ts      # Weekly ahead
│
├── bias/                       # Sesgos y bias
│   ├── route.ts              # Estado de bias
│   └── asset/route.ts        # Bias por activo
│
├── correlations/               # Correlaciones
│   └── route.ts
│
├── health/                     # Health checks
│   └── route.ts
│
└── admin/                      # Endpoints de admin
    ├── news/recent/route.ts
    └── calendar/recent/route.ts
```

### 🧩 **Componentes (components/)**

```
components/
├── NavBar.tsx                 # Barra de navegación
├── TacticalTablesClient.tsx   # Tablas tácticas (cliente)
├── DateDisplay.tsx           # Mostrar fechas
├── CorrelationTooltip.tsx    # Tooltip de correlaciones
├── ConfidenceTooltip.tsx     # Tooltip de confianza
├── InfoTooltip.tsx           # Tooltip de información
└── ui/                        # Componentes UI base
    ├── badge.tsx
    ├── card.tsx
    ├── table.tsx
    └── utils.ts
```

### 🧠 **Lógica de Negocio (domain/)**

```
domain/
├── macro-engine/              # Motor macroeconómico
│   ├── bias.ts               # Cálculo de sesgos
│   ├── correlations.ts       # Cálculo de correlaciones
│   ├── trading-bias.ts       # Sesgos de trading
│   └── trading-playbook.ts   # Playbook de trading
│
├── bias.ts                    # Lógica de bias
├── correlations.ts            # Lógica de correlaciones
├── narratives.ts              # Generación de narrativas
├── scenarios.ts               # Detección de escenarios
├── posture.ts                 # Posturas macro
└── diagnostic.ts              # Diagnóstico del sistema
```

### 🛠️ **Utilidades (lib/)**

```
lib/
├── notifications/              # Sistema de notificaciones
│   ├── telegram.ts           # ⭐ Cliente de Telegram
│   ├── validation.ts         # Validación de configuración
│   ├── news.ts               # Notificaciones de noticias
│   ├── narrative.ts         # Notificaciones de narrativas
│   ├── weekly.ts             # Weekly ahead
│   └── init.ts               # Inicialización
│
├── db/                        # Base de datos
│   ├── schema.ts             # Esquema SQLite
│   ├── read.ts               # Lectura de datos
│   ├── read-macro.ts         # Lectura de datos macro
│   └── upsert.ts             # Inserción/actualización
│
├── correlations/               # Cálculo de correlaciones
│   ├── calc.ts               # Cálculos
│   └── fetch.ts              # Obtención de datos
│
├── bias/                      # Cálculo de bias
│   ├── score.ts              # Puntuación
│   └── types.ts              # Tipos
│
├── markets/                   # Fuentes de datos de mercados
│   ├── yahoo.ts              # Yahoo Finance
│   ├── binance.ts            # Binance
│   └── stooq.ts              # Stooq
│
├── datasources/               # Fuentes de datos macro
│   ├── worldbank.ts          # World Bank
│   ├── imf.ts                # IMF
│   └── ecb.ts                # ECB
│
├── security/                  # Seguridad
│   ├── token.ts              # Validación de tokens
│   ├── ingest.ts             # Validación de ingest key
│   └── admin.ts              # Autenticación admin
│
└── utils/                     # Utilidades generales
    ├── format.ts             # Formateo
    ├── freshness.ts          # Frescura de datos
    └── time.ts               # Utilidades de tiempo
```

### 📜 **Scripts (scripts/)**

```
scripts/
├── ingest-news-rss.ts         # ⭐ Ingesta de noticias RSS
├── ingest-calendar-fred.ts    # ⭐ Ingesta de calendario FRED
├── ingest-all-sources.ts      # Ingesta de todas las fuentes
├── verify-notifications.ts    # Verificar notificaciones
├── verificar-estado-completo.ts # ⭐ Verificar estado completo
├── refresh-dashboard.ts        # Refrescar dashboard
├── update-all-data.ts         # Actualizar todos los datos
└── test-*.sh                  # Scripts de prueba
```

### ⚙️ **Automatización (.github/workflows/)**

```
.github/workflows/
├── news-calendar-ingest.yml   # ⭐ Pipeline de noticias (cada 6 horas)
├── daily-jobs.yml             # Jobs diarios (06:00 UTC)
├── weekly-maintenance.yml     # Mantenimiento semanal
└── test-notifications.yml     # Tests de notificaciones
```

### 📚 **Documentación (docs/)**

```
docs/
├── CONFIGURACION_TELEGRAM.md  # Configuración de Telegram
├── SETUP_NEWS_CALENDAR_PIPELINE.md # Setup de pipeline
├── ESTADO_NOTIFICACIONES.md  # Estado de notificaciones
└── ... (36 archivos más)
```

### 📄 **Archivos de Configuración Raíz**

```
/
├── package.json               # Dependencias y scripts
├── next.config.mjs            # Configuración de Next.js
├── tailwind.config.ts         # Configuración de Tailwind
├── tsconfig.json             # Configuración de TypeScript
├── vercel.json               # Configuración de Vercel
├── vitest.config.ts          # Configuración de tests
├── macro.db                  # Base de datos SQLite
└── .env.local                # Variables de entorno (local, no en git)
```

---

## 🎯 Archivos Clave por Funcionalidad

### 📱 **Telegram y Notificaciones**

- **Frontend:** `app/notificaciones/page.tsx` ⭐ (incluye botón de prueba)
- **API:** `app/api/notifications/test/route.ts` ⭐
- **Cliente Telegram:** `lib/notifications/telegram.ts`
- **Validación:** `lib/notifications/validation.ts`
- **Configuración:** `docs/CONFIGURACION_TELEGRAM.md`

### 📰 **Pipeline de Noticias**

- **Script RSS:** `scripts/ingest-news-rss.ts` ⭐
- **Script Calendario:** `scripts/ingest-calendar-fred.ts` ⭐
- **Workflow:** `.github/workflows/news-calendar-ingest.yml` ⭐
- **API Insert:** `app/api/news/insert/route.ts`
- **API Calendar:** `app/api/calendar/insert/route.ts`

### 📊 **Dashboard y Datos**

- **Dashboard:** `app/dashboard/page.tsx`
- **Bias Engine:** `domain/macro-engine/bias.ts`
- **Correlaciones:** `domain/macro-engine/correlations.ts`
- **Base de Datos:** `lib/db/schema.ts`

### 🔐 **Seguridad**

- **Tokens:** `lib/security/token.ts`
- **Ingest Key:** `lib/security/ingest.ts`
- **Admin:** `lib/security/admin.ts`

---

## 🗄️ Base de Datos (SQLite)

**Archivo:** `macro.db`

**Tablas principales:**
- `macro_observations` - Observaciones de indicadores
- `macro_bias` - Estados de bias calculados
- `correlations` - Correlaciones calculadas
- `news_items` - Noticias
- `macro_calendar` - Eventos del calendario
- `narrative_state` - Estados de narrativa
- `notification_history` - Historial de notificaciones

---

## 🚀 URLs de Producción

- **Dashboard:** https://macro-dashboard-seven.vercel.app/dashboard
- **Notificaciones:** https://macro-dashboard-seven.vercel.app/notificaciones ⭐
- **Noticias:** https://macro-dashboard-seven.vercel.app/noticias
- **Correlaciones:** https://macro-dashboard-seven.vercel.app/correlations
- **Narrativas:** https://macro-dashboard-seven.vercel.app/narrativas
- **Admin:** https://macro-dashboard-seven.vercel.app/admin

---

## 📝 Documentación Reciente Creada

- `ANALISIS-ESTADO-ACTUAL.md` - Análisis completo del proyecto
- `GUIA-ACTIVACION-COMPLETA.md` - Guía para activar Telegram y pipeline
- `RESUMEN-ACTIVACION-RAPIDA.md` - Resumen rápido
- `VERIFICACION-ESTADO-ACTUAL.md` - Verificación del estado
- `PASOS-FINALES-ACTIVACION.md` - Pasos finales
- `ESTRUCTURA-PROYECTO.md` - Este documento

---

## 🔍 Cómo Encontrar Archivos

### Buscar por funcionalidad:

1. **Telegram:** Buscar en `lib/notifications/telegram.ts`
2. **Noticias:** Buscar en `scripts/ingest-news-rss.ts` y `app/api/news/`
3. **Calendario:** Buscar en `scripts/ingest-calendar-fred.ts` y `app/api/calendar/`
4. **Dashboard:** Buscar en `app/dashboard/page.tsx`
5. **Bias:** Buscar en `domain/macro-engine/bias.ts`
6. **Correlaciones:** Buscar en `domain/macro-engine/correlations.ts`

### Buscar por tipo:

- **Páginas:** `app/*/page.tsx`
- **APIs:** `app/api/*/route.ts`
- **Componentes:** `components/*.tsx`
- **Lógica:** `domain/*.ts` y `lib/*.ts`
- **Scripts:** `scripts/*.ts`

---

## ✅ Estado Actual

- ✅ **Frontend completo** - Todas las páginas implementadas
- ✅ **API completa** - Todos los endpoints funcionando
- ✅ **Base de datos** - SQLite con todas las tablas
- ✅ **Automatizaciones** - GitHub Actions configuradas
- ✅ **Notificaciones** - Sistema Telegram implementado
- ✅ **Pipeline de noticias** - Scripts y workflow listos
- ⚠️ **Pendiente:** Activar pipeline (configurar secrets)
- ⚠️ **Pendiente:** Verificar Telegram (redeploy si es necesario)

---

**Última actualización:** 2025-11-13





