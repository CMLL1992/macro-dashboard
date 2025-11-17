# Resumen Completo del Proyecto: Macro Dashboard - Modo Solo Análisis

## 📋 Índice

1. [Visión General](#visión-general)
2. [Arquitectura del Sistema](#arquitectura-del-sistema)
3. [Indicadores Macroeconómicos Activos](#indicadores-macroeconómicos-activos)
4. [Sistema de Categorías y Pesos](#sistema-de-categorías-y-pesos)
5. [Base de Datos y Persistencia](#base-de-datos-y-persistencia)
6. [Automatización y Jobs](#automatización-y-jobs)
7. [Bootstrap y Operación Continua](#bootstrap-y-operación-continua)
8. [Sistema de Calidad e Invariantes](#sistema-de-calidad-e-invariantes)
9. [Correlaciones con DXY](#correlaciones-con-dxy)
10. [Interfaz de Usuario](#interfaz-de-usuario)
11. [API Endpoints](#api-endpoints)
12. [Seguridad y Configuración](#seguridad-y-configuración)
13. [Testing](#testing)

---

## 🎯 Visión General

**Macro Dashboard** es un sistema de análisis macroeconómico en modo **"solo análisis"** que:

- ✅ **Muestra datos macro clave** en dashboard informativo
- ✅ **Calcula sesgos macro cuantitativos** basados en indicadores económicos
- ✅ **Funciona con automatización básica** para ingesta y cálculo de sesgos
- ✅ **Incluye sistema de calidad** con invariantes y validaciones
- ✅ **Solo análisis** - sin señales, sin notificaciones, sin triggers, sin narrativas
- ✅ **Dashboard informativo** - tablas y datos macro únicamente
- ✅ **Operación continua** - bootstrap automático, polling, sin pantallas vacías

**Stack Tecnológico:**
- Framework: Next.js 14 (App Router)
- Lenguaje: TypeScript
- Base de datos: SQLite (better-sqlite3)
- Testing: Vitest
- UI: React, Tailwind CSS
- Package Manager: pnpm

---

## 🏗️ Arquitectura del Sistema

### Estructura de Capas

```
┌─────────────────────────────────────────┐
│         UI Layer (React/Next.js)        │
│  /dashboard (con polling y guardrails)  │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│      API Layer (Next.js Route Handlers) │
│  /api/bias, /api/health, /api/jobs/*   │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│      Business Logic Layer               │
│  - domain/diagnostic.ts (Macro Diagnosis)│
│  - domain/posture.ts (Postura y Pesos)  │
│  - domain/bias.ts (Bias Calculation)    │
│  - domain/categories.ts (Categorías)    │
│  - domain/trend.ts (Tendencias)         │
│  - lib/quality/ (Invariants & QA)       │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│      Data Layer                         │
│  - lib/db/ (SQLite persistence)         │
│  - lib/db/read-macro.ts (Source of truth)│
│  - lib/fred.ts (FRED API fallback)      │
│  - lib/correlations/ (DXY correlations) │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│      External APIs (Gratuitas)         │
│  FRED (Federal Reserve Economic Data)  │
└─────────────────────────────────────────┘
```

### Flujo de Datos Principal

1. **Bootstrap** → `job:ingest:fred` → `job:correlations` → `job:bias` → DB Ready
2. **Ingesta** → Datos macro desde FRED → Persistencia en SQLite (`macro_observations`)
3. **Cálculo de Bias** → Motor de scoring macro → Almacenamiento en `macro_bias`
4. **Correlaciones** → Cálculo diario de correlaciones con DXY → `correlations`
5. **Dashboard** → Lectura desde SQLite (source of truth) → Visualización

---

## 📊 Indicadores Macroeconómicos Activos

### 15 Indicadores Curados

El sistema procesa **15 indicadores macroeconómicos de alto impacto**:

#### Financieros / Curva (2 indicadores)
1. **Tasa Efectiva de Fondos Federales (FEDFUNDS)**
   - Fuente: FRED
   - Frecuencia: Mensual
   - Peso: 0.04

2. **Curva 10Y–2Y (spread %) (T10Y2Y)**
   - Fuente: FRED
   - Frecuencia: Diaria
   - Peso: 0.06

#### Crecimiento / Actividad (4 indicadores)
3. **PIB Interanual (GDP YoY) (GDPC1)**
   - Fuente: FRED
   - Transformación: YoY
   - Peso: 0.10 (compartido con QoQ)

4. **PIB Trimestral (GDP QoQ Anualizado) (GDPC1)**
   - Fuente: FRED
   - Transformación: QoQ Anualizado
   - Peso: 0.12 (compartido con YoY)

5. **Producción Industrial (YoY) (INDPRO)**
   - Fuente: FRED
   - Transformación: YoY
   - Peso: 0.04

6. **Ventas Minoristas (YoY) (RSXFS)**
   - Fuente: FRED
   - Transformación: YoY
   - Peso: 0.04

#### Mercado laboral (3 indicadores)
7. **Nóminas No Agrícolas (NFP Δ miles) (PAYEMS)**
   - Fuente: FRED
   - Transformación: MoM Delta
   - Peso: 0.10

8. **Tasa de Desempleo (U3) (UNRATE)**
   - Fuente: FRED
   - Peso: 0.07

9. **Solicitudes Iniciales de Subsidio por Desempleo (Media 4 semanas) (ICSA)**
   - Fuente: FRED
   - Transformación: 4-week SMA
   - Peso: 0.03

#### Precios / Inflación (5 indicadores)
10. **Inflación CPI (YoY) (CPIAUCSL)**
    - Fuente: FRED
    - Transformación: YoY
    - Peso: 0.10

11. **Inflación Core CPI (YoY) (CPILFESL)**
    - Fuente: FRED
    - Transformación: YoY
    - Peso: 0.10

12. **Inflación PCE (YoY) (PCEPI)**
    - Fuente: FRED
    - Transformación: YoY
    - Peso: 0.05

13. **Inflación Core PCE (YoY) (PCEPILFE)**
    - Fuente: FRED
    - Transformación: YoY
    - Peso: 0.07

14. **Índice de Precios al Productor (PPI YoY) (PPIACO)**
    - Fuente: FRED
    - Transformación: YoY
    - Peso: 0.03

#### Otros (1 indicador)
15. **Índice de Volatilidad VIX (VIXCLS)**
    - Fuente: FRED
    - Peso: 0.05

### Transformaciones Aplicadas

- **YoY (Year-over-Year)**: Cambio porcentual respecto al mismo mes del año anterior
- **QoQ Anualizado**: Cambio trimestral anualizado
- **MoM Delta**: Cambio mensual en unidades absolutas
- **4-week SMA**: Media móvil de 4 semanas

### Etiquetas en Español

Todos los indicadores se muestran con etiquetas profesionales en español con siglas oficiales:
- "PIB Trimestral (GDP QoQ Anualizado)"
- "PIB Interanual (GDP YoY)"
- "Nóminas No Agrícolas (NFP Δ miles)"
- "Tasa de Desempleo (U3)"
- "Inflación CPI (YoY)"
- "Curva 10Y–2Y (spread %)"
- etc.

---

## 🎯 Sistema de Categorías y Pesos

### Categorías Activas

1. **Financieros / Curva**: 2 indicadores (T10Y2Y, FEDFUNDS)
2. **Crecimiento / Actividad**: 4 indicadores (GDP YoY, GDP QoQ, INDPRO, RSXFS)
3. **Mercado laboral**: 3 indicadores (PAYEMS, UNRATE, ICSA)
4. **Precios / Inflación**: 5 indicadores (CPI, Core CPI, PCE, Core PCE, PPI)
5. **Otros**: 1 indicador (VIX)

### Distribución de Pesos

**Archivo:** `config/weights.json`

Distribución global:
- **Crecimiento / Actividad**: 30% (0.30)
- **Precios / Inflación**: 35% (0.35)
- **Mercado laboral**: 20% (0.20)
- **Financieros / Curva**: 10% (0.10)
- **Riesgo (VIX)**: 5% (0.05)

**Total:** 1.00

### Pesos por Indicador

```json
{
  "threshold": 0.30,
  "weights": {
    "CPIAUCSL": 0.10,    // CPI YoY
    "CPILFESL": 0.10,    // Core CPI YoY
    "PCEPI": 0.05,       // PCE YoY
    "PCEPILFE": 0.07,    // Core PCE YoY
    "PPIACO": 0.03,      // PPI YoY
    "GDPC1": 0.22,       // GDP (QoQ + YoY combinado)
    "INDPRO": 0.04,      // Producción Industrial
    "RSXFS": 0.04,       // Ventas Minoristas
    "PAYEMS": 0.10,      // NFP
    "UNRATE": 0.07,      // Desempleo
    "ICSA": 0.03,        // Claims 4w
    "T10Y2Y": 0.06,      // Curva 10Y-2Y
    "FEDFUNDS": 0.04,    // Fed Funds Rate
    "VIX": 0.05          // VIX
  }
}
```

### Cálculo de Postura

Cada indicador tiene reglas automáticas para determinar postura:
- **Hawkish**: Condiciones restrictivas (alta inflación, bajo crecimiento, etc.)
- **Dovish**: Condiciones expansivas (baja inflación, alto crecimiento, etc.)
- **Neutral**: Condiciones intermedias

El score macro se calcula como suma ponderada de posturas (Hawkish=-1, Neutral=0, Dovish=+1).

---

## 💾 Base de Datos y Persistencia

### Esquema SQLite

**Archivo:** `lib/db/schema.ts`

**Tablas principales:**

1. **`macro_series`**
   - Metadatos de series macro
   - Campos: `id` (PK), `source`, `indicator`, `name`, `frequency`, `unit`, `last_updated`

2. **`macro_observations`**
   - Observaciones históricas por serie
   - Campos: `series_id` (FK), `date`, `value`
   - PK: `(series_id, date)`
   - **Source of truth** para datos macro

3. **`macro_bias`**
   - Último bias calculado por símbolo
   - Campos: `symbol` (PK), `score`, `direction`, `confidence`, `computed_at`

4. **`correlations`**
   - Correlaciones diarias con DXY
   - Campos: `symbol` (PK), `base` (default: 'DXY'), `window` ('12m' | '3m'), `value`, `asof`, `n_obs`, `last_asset_date`, `last_base_date`
   - PK: `(symbol, base, window)`

5. **`correlations_history`**
   - Histórico de correlaciones para auditoría
   - Campos: `id` (PK), `symbol`, `base`, `window`, `value`, `n_obs`, `timestamp`

6. **`indicator_history`**
   - Historial de valores actuales y previos por indicador
   - Campos: `indicator_key` (PK), `value_current`, `value_previous`, `date_current`, `date_previous`, `updated_at`
   - Usado para calcular tendencias (Mejora/Empeora/Estable)

### Utilidades de Persistencia

**`lib/db/read-macro.ts`**
- `getAllLatestFromDB()` - Lee todos los indicadores desde SQLite (source of truth)
- `getLatestObservationDate()` - Fecha más reciente de observaciones
- `checkMacroDataHealth()` - Health check de datos macro

**`lib/db/read.ts`**
- `getCorrelation()` - Obtiene correlación específica
- `getCorrelationsForSymbol()` - Todas las correlaciones de un símbolo
- `getIndicatorHistory()` - Historial de un indicador

**`lib/db/upsert.ts`**
- `upsertMacroSeries()` - Idempotente
- `upsertMacroBias()` - Idempotente
- `upsertCorrelation()` - Idempotente
- `upsertIndicatorHistory()` - Gestiona valores actuales/previos

---

## ⚙️ Automatización y Jobs

### Jobs Implementados

**`app/api/jobs/ingest/fred/route.ts`**
- Ingesta 14 series FRED curadas
- Persiste en `macro_series` y `macro_observations`
- Protegido con `CRON_TOKEN`
- Revalida UI tras completar

**`app/api/jobs/correlations/route.ts`**
- Calcula correlaciones 12m y 3m con DXY para todos los símbolos activos
- Usa rendimientos logarítmicos, winsorización, forward-fill
- Persiste en `correlations`
- Revalida UI tras completar

**`app/api/jobs/compute/bias/route.ts`**
- Calcula bias macro para todos los símbolos
- Usa datos desde SQLite
- Persiste en `macro_bias`
- Revalida UI tras completar

**`app/api/jobs/maintenance/route.ts`**
- Ejecuta `VACUUM` en SQLite
- `PRAGMA integrity_check`
- Backup diario (si existe directorio `backups/`)
- Revalida UI tras completar

### Scripts de Package.json

```bash
pnpm job:ingest:fred    # Ingesta FRED
pnpm job:correlations   # Calcula correlaciones
pnpm job:bias          # Calcula bias
pnpm job:bootstrap     # Secuencia completa: ingest → correlations → bias
pnpm job:maintenance   # Mantenimiento (VACUUM, integrity, backup)
```

---

## 🚀 Bootstrap y Operación Continua

### Bootstrap Automático

**Objetivo:** Garantizar que el dashboard esté operativo en cada arranque.

**Secuencia:**
1. `job:ingest:fred` → Ingesta datos FRED
2. `job:correlations` → Calcula correlaciones
3. `job:bias` → Calcula bias
4. Health check → Marca `DB_READY=true`

**Implementación:**
- `/api/bias` detecta si falta data y ejecuta bootstrap automáticamente
- Lock de bootstrap para evitar ejecuciones concurrentes
- Auto-limpieza de locks obsoletos (>10 minutos)

### Polling en Cliente

**Componente:** `components/DashboardInitializing.tsx`

- Polling a `/api/health` cada 5 segundos
- Oculta banner tras 2 lecturas consecutivas con `ready=true`
- Recarga automática cuando sistema está listo

### Guardarraíles de Datos

El dashboard no renderiza si:
- `items_count < 15`
- `correlationCount < 9`
- `observationCount == 0`
- `health.hasData !== true`

Muestra banner "Inicializando datos..." hasta que se cumplan mínimos.

### Health Check

**Endpoint:** `/api/health`

Retorna:
```json
{
  "ready": true,
  "observationCount": 10931,
  "biasCount": 9,
  "correlationCount": 16,
  "db_ready": true,
  "bootstrap_timestamp": "2025-01-XX...",
  "bootstrap_locked": false,
  "fallback_count": 0
}
```

---

## 🔍 Sistema de Calidad e Invariantes

### Invariantes Implementados

**Archivo:** `lib/quality/invariants.ts`

1. **`freshnessSLA`**
   - Cada serie ≤ 3 días hábiles respecto a hoy
   - Si falla → WARN (muestra badge "Desactualizado" pero no oculta dato)

2. **`correlationFreshnessSLA`**
   - Correlaciones ≤ 3 días hábiles
   - Si falla → WARN

3. **`correlationMinObservations`**
   - 12m: n_obs ≥ 150
   - 3m: n_obs ≥ 40
   - Si no → muestra "—" en UI

4. **`correlationSignConsistency`**
   - Validación de signos esperados en correlaciones FX
   - Cambios de régimen sostenidos → WARN

5. **`insightsCategoryConsistency`**
   - Valida contadores de Insights (2/2, 4/4, 3/3, 5/5, 1/1)
   - Si inconsistencia → muestra aviso "Mapa-categorías inconsistente"

### Reglas de QA

**Archivo:** `config/qa.rules.json`

```json
{
  "freshness_sla_days": 3,
  "min_obs": {
    "correlation_12m": 150,
    "correlation_3m": 40
  },
  "warnings": {
    "fx_sign": {
      "usd_quote_positive_threshold": 0.30,
      "usd_base_negative_threshold": -0.30
    },
    "regime_flip_days": 30
  }
}
```

---

## 📈 Correlaciones con DXY

### Sistema de Correlaciones

**Objetivo:** Calcular correlaciones de Pearson entre rendimientos diarios de activos y DXY.

**Ventanas:**
- **12m (ref)**: 252 sesiones (proxy 12 meses)
- **3m**: 63 sesiones (proxy 3 meses)

**Método:**
- Rendimientos logarítmicos: `ln(Pt / Pt-1)`
- Alineación: NY close
- Forward-fill: máximo 3 días hábiles
- Winsorización: 1%/99% para outliers

**Persistencia:**
- Tabla `correlations` con `symbol`, `base` ('DXY'), `window`, `value`, `asof`, `n_obs`
- Histórico en `correlations_history`

**UI:**
- Columnas "Corr. 12m (ref)" y "Corr. 3m" en "Mapa de sesgos"
- Formato: valor con 2 decimales + "(DXY)" o "—" si falta dato
- Colores según intensidad:
  - |ρ| ≥ 0.60 → fuerte (verde/rojo)
  - 0.30 ≤ |ρ| < 0.60 → moderada
  - |ρ| < 0.30 → débil (gris)

**Configuración:** `config/correlations.config.json`

---

## 🖥️ Interfaz de Usuario

### Página Principal: `/dashboard`

**Componentes:**

1. **Régimen actual del mercado**
   - Score macro (-1 a +1)
   - Régimen: RISK ON / RISK OFF / NEUTRAL
   - USD Bias: Fuerte / Débil / Neutral
   - Cuadrante macro
   - Contadores: "Mejoran: X | Empeoran: Y" (basado en tendencias)

2. **Insights**
   - Chips por categoría: "Financieros / Curva: 2/2", "Crecimiento / Actividad: 4/4", etc.
   - Validación automática de contadores
   - Aviso si hay inconsistencia

3. **Tabla de Indicadores Macro**
   - Columnas: Variable, Dato anterior, Dato actual, Evolución, Postura, Peso, Fecha
   - **Evolución**: Badge con color (Verde=Mejora, Rojo=Empeora, Gris=Estable)
   - **Badge "Desactualizado"**: Si fecha > 3 días hábiles
   - Agrupado por categoría

4. **Sesgo por par**
   - Tabla con sesgos macro por activo
   - Columnas: Par/Activo, Sesgo macro, Acción recomendada, Motivo

5. **Mapa de sesgos**
   - Tabla táctica con correlaciones
   - Columnas: Par/Activo, Tendencia, Acción, Confianza, Corr. 12m (ref), Corr. 3m, Motivo

6. **Escenarios detectados**
   - Lista de escenarios macro detectados automáticamente
   - Severidad y sugerencias

**Banner de Inicialización:**
- Se muestra si `ready=false` o datos insuficientes
- Polling automático cada 5s
- Se oculta tras 2 lecturas consecutivas con `ready=true`

### Otras Páginas

- `/qa/overview` - Resumen de calidad
- `/qa/asset/:symbol` - Auditoría por activo
- `/correlations` - Vista de correlaciones
- `/settings` - Configuración

---

## 🔌 API Endpoints

### Endpoints Principales

**`GET /api/bias`**
- Retorna items macro, regime, score, health
- Activa bootstrap automático si falta data
- Logging completo de observabilidad

**`GET /api/health`**
- Health check del sistema
- Retorna `ready`, contadores, timestamps, fallback_count

**`GET /api/diag`**
- Diagnóstico macro completo
- Incluye items, tendencias, categoryCounts

**`GET /api/export`**
- Exporta datos macro a CSV

### Endpoints de Jobs (Protegidos)

- `POST /api/jobs/ingest/fred` - Ingesta FRED
- `POST /api/jobs/correlations` - Calcula correlaciones
- `POST /api/jobs/compute/bias` - Calcula bias
- `POST /api/jobs/maintenance` - Mantenimiento

Todos protegidos con `CRON_TOKEN` en header `Authorization: Bearer ${CRON_TOKEN}`

---

## 🔒 Seguridad y Configuración

### Variables de Entorno

**Críticas:**
```
CRON_TOKEN=<token_secreto_largo>
USE_LIVE_SOURCES=false  # En producción
```

**Configuración:**
```
TZ=Europe/Madrid
APP_URL=http://localhost:3000
DATABASE_PATH=./data/macro.db
```

### Protección de Endpoints

**`lib/security/token.ts`**
- Función: `validateCronToken(request: NextRequest)`
- Valida header: `Authorization: Bearer ${CRON_TOKEN}`
- Endpoints protegidos: todos los `/api/jobs/*`

### Política de Secretos

- ❌ **Nunca** se expone `CRON_TOKEN` al cliente
- ✅ Todos los secretos se leen desde `process.env` en el servidor

---

## 🧪 Testing

### Suite de Tests

**Framework:** Vitest

**Cobertura:**

1. **Tests de Adaptadores** (`tests/adapters/`)
   - `worldbank.test.ts`, `imf.test.ts`, `ecb.test.ts`

2. **Tests de Dashboard** (`tests/dashboard/`)
   - `freshness.test.ts` - Frescura de datos
   - `insights-categories.test.ts` - Contadores de Insights
   - `labels-spanish.test.ts` - Etiquetas en español
   - `trend-comparison.test.ts` - Comparación de tendencias
   - `removed-features.test.ts` - Verificación de eliminación de features

3. **Tests de Calidad** (`tests/quality/`)
   - `consistency.test.ts` - Invariantes

**Ejecutar:**
```bash
pnpm test
```

---

## 📊 Estado Actual del Proyecto

### ✅ Completado

- [x] 15 indicadores macro activos con transformaciones
- [x] Sistema de categorías corregido (sin duplicados)
- [x] Bootstrap automático en arranque
- [x] Polling en cliente para UX fluida
- [x] Sistema de correlaciones con DXY (12m y 3m)
- [x] Sistema de tendencias (Mejora/Empeora/Estable)
- [x] Badges de frescura (Desactualizado)
- [x] Validación de Insights
- [x] Health checks y observabilidad
- [x] Mantenimiento automático (VACUUM, integrity, backup)
- [x] SQLite como source of truth
- [x] UI completa sin pantallas vacías

### 🔄 Características Eliminadas

- ❌ Narrativas automáticas
- ❌ Sistema de alertas
- ❌ Notificaciones (Telegram, Discord)
- ❌ Señales técnicas y confirmadas
- ❌ Reportes automáticos
- ❌ Manual del sistema (`/info`)
- ❌ Próximas fechas/noticias
- ❌ Integraciones externas (bots, webhooks)

---

## 🎓 Política del Proyecto

**Regla Fundamental:**
> ⚠️ **Este proyecto solo muestra datos y análisis. No genera señales de trading ni ejecuta órdenes.**

- Toda decisión de trading es responsabilidad del usuario
- El sistema proporciona información para ayudar en la toma de decisiones
- No realiza operaciones automáticas
- Solo fuentes de datos gratuitas y públicas
- Sin API keys propietarias ni licencias de pago

---

## 📝 Conclusión

El **Macro Dashboard** es un sistema completo, automatizado y gratuito que:

1. ✅ Integra datos macro desde FRED
2. ✅ Calcula sesgos cuantitativos por activo
3. ✅ Muestra correlaciones con DXY
4. ✅ Valida calidad con invariantes automáticos
5. ✅ Funciona 100% automático con bootstrap
6. ✅ Proporciona UI completa sin pantallas vacías
7. ✅ Opera en modo "solo análisis" sin señales ni notificaciones

**Ideal para:**
- Análisis macroeconómico en tiempo real
- Monitoreo de indicadores clave
- Validación de sesgos macro
- Dashboard informativo

**Sin intervención manual requerida** una vez configurado.

---

*Última actualización: Enero 2025*
