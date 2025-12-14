# CM11 Trading - Documento del Proyecto

**Versión:** 1.0  
**Fecha:** Diciembre 2025  
**Estado:** Producción - Funcionando 100%

---

## 📋 Resumen Ejecutivo

**CM11 Trading** es un dashboard macroeconómico completo diseñado para traders profesionales que necesitan análisis macro en tiempo real, correlaciones entre activos y el dólar (DXY), sesgos de trading por par de divisas, y narrativas tácticas automatizadas.

El sistema está **100% operativo**, procesando datos reales de fuentes oficiales (FRED, ECB, Trading Economics) y desplegado en producción en Vercel con automatizaciones diarias funcionando.

---

## 🎯 Objetivo del Proyecto

Proporcionar a traders profesionales:

1. **Visión macro consolidada** de indicadores económicos clave (inflación, crecimiento, empleo, política monetaria)
2. **Correlaciones dinámicas** entre activos y benchmarks (DXY) en múltiples ventanas temporales
3. **Sesgos de trading** calculados automáticamente por par de divisas basados en regímenes macro
4. **Narrativas tácticas** que explican el razonamiento detrás de cada sesgo
5. **Calendario económico** con eventos programados y releases recientes
6. **Notificaciones automatizadas** vía Telegram para eventos importantes

---

## 🏗️ Arquitectura Técnica

### Stack Tecnológico

- **Framework:** Next.js 14.2.5 (App Router)
- **Lenguaje:** TypeScript
- **Estilos:** Tailwind CSS
- **Base de Datos:** SQLite (better-sqlite3) + Turso (producción)
- **Deployment:** Vercel
- **Node.js:** 20.x
- **Package Manager:** pnpm 10.20.0

### Arquitectura de Capas

```
┌─────────────────────────────────────────┐
│      Frontend (Next.js App Router)      │
│  Dashboard, Correlaciones, Sesgos, etc. │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│      API Layer (Route Handlers)         │
│  /api/dashboard, /api/correlations, etc.│
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│      Business Logic Layer               │
│  - domain/macro-engine/ (Motor central) │
│  - domain/diagnostic.ts (Diagnóstico)   │
│  - domain/bias.ts (Cálculo de sesgos)   │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│      Data Layer                         │
│  - lib/db/ (SQLite/Turso)               │
│  - lib/db/read-macro.ts (Source of truth)│
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│      External APIs                      │
│  FRED, ECB, Trading Economics, etc.      │
└─────────────────────────────────────────┘
```

---

## 📊 Fuentes de Datos (100% Reales)

### 1. FRED (Federal Reserve Economic Data)
- **Series:** 14+ indicadores macro clave (T10Y2Y, UNRATE, GDPC1, CPI, etc.)
- **Frecuencia:** Actualización diaria automática
- **Endpoint:** `/api/jobs/ingest/fred`

### 2. European Central Bank (ECB)
- **Series:** Indicadores europeos (PMI, CPI, GDP, desempleo, etc.)
- **Frecuencia:** Actualización diaria automática
- **Endpoint:** `/api/jobs/ingest/european`

### 3. Trading Economics / Econdify
- **Calendario económico:** Eventos programados y releases publicados
- **Frecuencia:** Actualización diaria automática
- **Endpoint:** `/api/jobs/ingest/calendar`

### 4. Precios de Activos
- **Fuentes:** Yahoo Finance, Binance API, Stooq
- **Uso:** Cálculo de correlaciones con DXY
- **Frecuencia:** Actualización diaria automática
- **Endpoint:** `/api/jobs/correlations`

---

## 🔄 Automatización Completa

### Jobs Diarios (Vercel Cron + GitHub Actions)

| Job | Horario | Función |
|-----|---------|---------|
| Warmup | 00:00 UTC | Inicializa sistema, actualiza FRED |
| Daily Update | 06:00 UTC | Ingesta FRED, correlaciones, bias |
| Calendar Update | Diario | Actualiza calendario económico |
| Correlations | Diario | Calcula correlaciones 3m/6m/12m/24m |
| Bias Compute | Diario | Calcula sesgos macro por par |

### Pipeline de Datos

```
1. Ingesta de Datos
   FRED/ECB/Econdify APIs
   ↓
   /api/jobs/ingest/*
   ↓
   SQLite/Turso (macro_observations)

2. Cálculo de Correlaciones
   Precios históricos (Yahoo/Binance)
   ↓
   /api/jobs/correlations
   ↓
   SQLite/Turso (correlations)

3. Cálculo de Sesgos
   Indicadores macro + Correlaciones
   ↓
   /api/jobs/compute/bias
   ↓
   SQLite/Turso (macro_bias)

4. Generación de Narrativas
   Sesgos + Regímenes + Correlaciones
   ↓
   Narrativas tácticas por par
```

---

## 📱 Páginas Principales

### 1. Dashboard (`/dashboard`)
**Función:** Vista consolidada del estado macro actual

**Contenido:**
- Régimen global del mercado (Risk ON/OFF, USD Fuerte/Débil, Cuadrante macro)
- Tabla de indicadores macro agrupados por categoría (EUROZONA vs GLOBAL)
- Tabla táctica con sesgos por par de divisas
- Escenarios institucionales (activos en watchlist)
- Eventos macro recientes

**Datos:** 100% reales desde BD, actualizados diariamente

---

### 2. Correlaciones (`/correlations`)
**Función:** Análisis de correlaciones entre activos y DXY

**Contenido:**
- Tabla completa de correlaciones para 75+ pares
- Ventana más fuerte (3m, 6m, 12m, 24m)
- Tendencia (Stable, Strengthening, Weakening, Break)
- Intensidad (Fuerte, Moderada, Débil)
- Relevancia macro (0-100%)
- Correlación actual numérica

**Datos:** 100% reales, calculados desde precios históricos

**Características:**
- Ordenación por relevancia macro descendente
- Explicación integrada "¿Cómo leer esta tabla?"
- Guía rápida con referencia a Ayuda completa

---

### 3. Sesgos (`/sesgos`)
**Función:** Sesgos de trading calculados automáticamente por par

**Contenido:**
- Tabla táctica con acción recomendada (Long/Short/Neutral/Rango)
- Confianza (Alta/Media/Baja)
- Motivo macro detrás de cada sesgo
- Flags de riesgo por par
- Correlaciones 3m y 12m integradas

**Datos:** 100% reales, calculados desde regímenes macro y correlaciones

---

### 4. Narrativas (`/narrativas`)
**Función:** Explicaciones tácticas detalladas por par

**Contenido:**
- Narrativa completa que explica el sesgo
- Razones macro detrás de la recomendación
- Confianza y contexto de mercado
- Vista detallada por par individual

**Datos:** Generadas automáticamente desde sesgos y regímenes

---

### 5. Calendario (`/calendario`)
**Función:** Calendario económico con eventos programados y releases

**Contenido:**
- Próximos eventos económicos (22 eventos visibles)
- Releases recientes ya publicados
- Importancia de eventos (Alta/Media/Baja)
- Consenso vs valor real
- Sorpresas y dirección del mercado

**Datos:** 100% reales desde Trading Economics/Econdify

---

### 6. Análisis Diario (`/analisis`)
**Función:** Guía paso a paso para revisar el mercado antes de operar

**Contenido:**
- Checklist estructurado de revisión
- Explicación de cada componente del dashboard
- Cómo interpretar sesgos, correlaciones y calendario
- Selector de tipo de trading (institucional vs retail)
- Descarga de guía en PDF

---

### 7. Notificaciones (`/notificaciones`)
**Función:** Gestión de alertas y notificaciones vía Telegram

**Contenido:**
- Configuración de notificaciones
- Historial de alertas enviadas
- Métricas de entrega
- Configuración por usuario

---

### 8. Ayuda (`/ayuda`)
**Función:** Documentación completa del sistema

**Contenido:**
- Explicación detallada de cada página
- Cómo interpretar indicadores macro
- Guía de correlaciones y ventanas temporales
- Explicación de sesgos y narrativas
- FAQs y mejores prácticas

---

## 🔧 Endpoints API Principales

### Datos del Dashboard
- `GET /api/dashboard` - Datos completos del dashboard
- `GET /api/correlations` - Matriz de correlaciones
- `GET /api/bias` - Sesgos macro por par
- `GET /api/trading-playbook` - Playbook completo de trading

### Jobs de Ingesta
- `POST /api/jobs/ingest/fred` - Actualiza datos FRED
- `POST /api/jobs/ingest/european` - Actualiza indicadores europeos
- `POST /api/jobs/ingest/calendar` - Actualiza calendario económico
- `POST /api/jobs/correlations` - Calcula correlaciones
- `POST /api/jobs/compute/bias` - Calcula sesgos macro

### Estado y Diagnóstico
- `GET /api/status/jobs` - Estado de jobs automatizados
- `GET /api/diag` - Diagnóstico del sistema
- `GET /api/health` - Health check de BD

---

## 📈 Métricas y Estado Actual

### Datos en Producción

- **Indicadores macro:** 14+ series FRED + 13+ indicadores europeos
- **Correlaciones:** 75+ pares calculados automáticamente
- **Sesgos:** Calculados para todos los pares principales
- **Calendario:** 22+ eventos próximos visibles
- **Actualización:** Diaria automática sin intervención manual

### Verificación de Datos Reales

✅ **Dashboard:** Muestra indicadores con fechas recientes (2025-12-09)  
✅ **Correlaciones:** Valores calculados desde precios históricos reales  
✅ **Sesgos:** Basados en regímenes macro calculados desde datos oficiales  
✅ **Calendario:** Eventos reales con horarios y consensos  
✅ **Narrativas:** Generadas desde datos reales del sistema  

---

## 🚀 Deployment y Infraestructura

### Vercel (Producción)
- **Plan:** Hobby (suficiente para el proyecto actual)
- **URL:** Desplegado y accesible públicamente
- **Cron Jobs:** Configurados y funcionando
- **Build:** Automático en cada push a main

### Base de Datos
- **Desarrollo:** SQLite local (`macro.db`)
- **Producción:** Turso (SQLite distribuido)
- **Migración:** Automática en deployment

### Variables de Entorno
- `FRED_API_KEY` - API key de FRED
- `TURSO_DATABASE_URL` - URL de base de datos Turso
- `TURSO_AUTH_TOKEN` - Token de autenticación Turso
- `CRON_TOKEN` - Token para proteger endpoints de cron
- `TELEGRAM_BOT_TOKEN` - Token del bot de Telegram
- `TELEGRAM_CHAT_ID` - ID del chat para notificaciones

---

## 📚 Estructura del Código

### Directorios Principales

```
macro-dashboard-with-data/
├── app/                    # Next.js App Router
│   ├── dashboard/         # Página principal
│   ├── correlations/       # Página de correlaciones
│   ├── sesgos/            # Página de sesgos
│   ├── narrativas/        # Narrativas por par
│   ├── calendario/        # Calendario económico
│   ├── analisis/          # Análisis diario
│   ├── ayuda/             # Documentación
│   └── api/               # Endpoints API
│       └── jobs/          # Jobs automatizados
├── domain/                # Lógica de negocio
│   ├── macro-engine/      # Motor macro centralizado
│   │   ├── bias.ts        # Estado de bias
│   │   ├── correlations.ts # Estado de correlaciones
│   │   └── trading-bias.ts # Sesgos de trading
│   └── diagnostic.ts      # Diagnóstico macro
├── lib/                   # Utilidades
│   ├── db/               # Acceso a BD
│   ├── correlations/     # Cálculo de correlaciones
│   └── dashboard-data.ts # Agregación de datos
├── components/           # Componentes React
│   └── ui/               # Componentes UI (shadcn)
└── config/               # Archivos de configuración
    ├── weights.json      # Pesos de indicadores
    ├── core-indicators.json # Series FRED
    └── universe.assets.json # Activos para correlaciones
```

---

## 🔐 Seguridad y Autenticación

### Admin Panel
- **Ruta:** `/admin`
- **Autenticación:** Login con contraseña
- **Funciones:** Gestión de calendario, noticias, PMI, dashboard

### Protección de Endpoints
- **Cron Jobs:** Protegidos con `CRON_TOKEN`
- **Admin APIs:** Requieren autenticación de sesión
- **Public APIs:** Solo lectura, sin modificación de datos

---

## 📊 Características Técnicas Destacadas

### 1. Motor Macro Centralizado
- **Ubicación:** `domain/macro-engine/`
- **Función:** Cálculo unificado de regímenes, sesgos y correlaciones
- **Ventaja:** Single source of truth, fácil de mantener y extender

### 2. Sistema de Pesos Configurable
- **Archivo:** `config/weights.json`
- **Función:** Define importancia de cada indicador macro
- **Ventaja:** Ajuste de sesgos sin cambiar código

### 3. Cálculo de Correlaciones Robusto
- **Ventanas:** 3m, 6m, 12m, 24m
- **Método:** Correlación de Pearson en log returns
- **Validación:** Winsorización, alineación temporal, tamaño mínimo de muestra

### 4. Detección de Cambios de Régimen
- **Shifts:** Break, Reinforcing, Stable, Weak
- **Método:** Comparación de correlaciones entre ventanas
- **Uso:** Alertas tempranas de cambios estructurales

### 5. Narrativas Automatizadas
- **Generación:** Automática desde sesgos y regímenes
- **Contenido:** Explicación táctica, razones macro, nivel de confianza
- **Personalización:** Por tipo de trading (institucional vs retail)

---

## 🎨 Interfaz de Usuario

### Diseño
- **Tema:** Dark mode por defecto, toggle disponible
- **Responsive:** Funciona en desktop, tablet y móvil
- **Componentes:** shadcn/ui para consistencia visual
- **Navegación:** Intuitiva con breadcrumbs y enlaces claros

### Experiencia de Usuario
- **Carga rápida:** Datos pre-calculados en BD
- **Tooltips:** Explicaciones contextuales en hover
- **Acordeones:** Información expandible sin saturar la vista
- **Tablas ordenables:** Por relevancia, intensidad, etc.

---

## 📈 Roadmap y Mejoras Futuras

### Corto Plazo
- [ ] Añadir más indicadores macro (Japón, Reino Unido)
- [ ] Mejoras en visualización de correlaciones (gráficos sparkline)
- [ ] Exportación de datos a CSV/Excel mejorada
- [ ] Filtros avanzados en tablas

### Medio Plazo
- [ ] Backtesting de sesgos históricos
- [ ] Alertas personalizables por par
- [ ] Integración con más brokers para ejecución
- [ ] Dashboard móvil optimizado

### Largo Plazo
- [ ] Machine Learning para predicción de regímenes
- [ ] Análisis de sentimiento de noticias
- [ ] Integración con más fuentes de datos
- [ ] API pública para integraciones externas

---

## 🚀 Mejoras Funcionales Especificadas

### 📌 MEJORA 1 — Radar de Oportunidades

#### ❓ Qué responde
**"¿Cuáles son los 3–5 mejores pares para mirar hoy?"**

#### 🧠 Inputs (todos ya existen)

| Fuente | Campo | Uso |
|--------|-------|-----|
| `/api/bias` | `action` (Long/Short) | Evitar Neutral |
| `/api/bias` | `confidence` (High/Medium/Low) | Priorizar confianza alta |
| `/api/correlations` | `trend` (Stable/Reinforcing/Weakening/Break) | Exposición macro fiable |
| `/api/correlations` | `macroRelevanceScore` (0–100) | Importancia real |
| `/api/calendar` | Proximidad de eventos de alta importancia | Evitar noticias explosivas |

#### 🔢 Lógica (pseudocódigo)

```javascript
candidate = par where bias.action !== "Neutral"

score = 0

// Confianza del sesgo
if bias.confidence === "High": score += 3
if bias.confidence === "Medium": score += 1

// Estabilidad de correlación
if corr.trend === "Reinforcing": score += 2
if corr.trend === "Stable": score += 1

// Relevancia macro
score += Math.round(macroRelevanceScore / 25) // 0–4 puntos

// Penalización por eventos próximos
if upcomingHighImpactNews < 24h: score -= 2

// Ranking final: top 5 por score descendente
```

#### 🎯 Output en UI

**Ubicación:** `/analisis` (justo después del semáforo)

**Formato:** Pequeño recuadro con tabla compacta:

| Par | Acción | Confianza | Razonamiento corto |
|-----|--------|-----------|-------------------|
| GBPUSD | Long | Alta | USD débil + correlación reforzando |
| AUDUSD | Long | Media | Risk-on fuerte en commodities |
| USDJPY | Short | Alta | Divergencia BoJ-Fed + risk-on moderado |
| EURUSD | Long | Alta | Correlación estable + sesgo macro claro |
| NZDUSD | Long | Media | Correlación reforzando + sesgo moderado |

**Botón:** "Ver detalles en Sesgos" → enlace a `/sesgos`

---

### 📌 MEJORA 2 — Semáforo de Fiabilidad del Sistema

#### ❓ Qué responde
**"¿Me puedo fiar del sistema hoy?"**

#### 🧠 Inputs existentes

- Porcentaje de pares con `trend = Weakening` o `Break`
- Sorpresas macro recientes del calendario (últimas 24-48h)
- Cambios de régimen global en dashboard (risk-on/off switches)
- Volatilidad de correlaciones entre ventanas (divergencias 3m vs 12m)

#### 🔢 Lógica

```javascript
score = 0

// Correlaciones rotas o debilitándose
if percentWeakening > 35%: score += 2
if percentBreak > 10%: score += 2

// Sorpresas macro recientes
if lastMajorNewsSurprise: score += 2

// Cambios de régimen
if regimeSwitchInLast24h: score += 1

// Clasificación final
if score <= 1: estado = "Normal" (🟢)
if score >= 2 && score <= 3: estado = "Precaución" (🟡)
if score >= 4: estado = "Caos" (🔴)
```

#### 🎯 Output en UI

**Ubicación:** `/analisis` (arriba del todo, antes del análisis diario)

**Formato:** Banner destacado con icono y mensaje:

**🟢 Modo normal**
"Señales fiables — El sistema está operando en condiciones normales"

**🟡 Precaución**
"2 cambios de régimen detectados — Reducir tamaño de posiciones recomendado"

**🔴 Caos**
"Correlaciones rotas + sorpresas macro fuertes — Evitar nuevas exposiciones"

**Detalles expandibles:** Al hacer clic, muestra:
- % de pares con correlaciones rotas
- Lista de eventos sorpresa recientes
- Cambios de régimen detectados

---

### 📌 MEJORA 3 — Solapamiento de Exposición (con 2 clics)

#### ❓ Qué responde
**"¿Estoy apostando 3 veces lo mismo sin darme cuenta?"**

#### 🧠 Inputs existentes

- Lista de trades activos o planificados: `{par: "EURUSD", size: +1, side: "Long"}`
- Correlaciones de ese par vs DXY (`correlationNow`)
- `macroRelevanceScore` para ponderar la exposición

#### 🔢 Lógica

```javascript
// Convertir cada par en exposición USD
// Long EURUSD = corto USD (exposición negativa)
// Long USDJPY = largo USD (exposición positiva)

for each trade:
  exposure = positionSize * correlationNow * (macroRelevanceScore / 100)
  
  if par is USD-quoted (USDJPY, USDCHF):
    usdExposure += exposure  // Largo USD
  else:
    usdExposure -= exposure   // Corto USD

// Agrupar por dirección macro
usdStrong = sum(exposures where usdExposure > 0)
usdWeak = sum(exposures where usdExposure < 0)
neutral = sum(exposures where |usdExposure| < threshold)

// Normalizar a porcentajes
total = Math.abs(usdStrong) + Math.abs(usdWeak) + neutral
usdStrongPct = (Math.abs(usdStrong) / total) * 100
usdWeakPct = (Math.abs(usdWeak) / total) * 100
neutralPct = (neutral / total) * 100
```

#### 🎯 Output visual

**Ubicación:** `/sesgos` (nuevo bloque) o modal emergente

**Formato:** Gráfico horizontal simple con barras:

```
USD fuerte      |███████████████  65%
USD débil       |███              18%
Neutral         |██               17%
```

**Alerta si concentración > 60%:**
```
⚠️ Tienes 4 trades apuntando a USD débil — riesgo de concentración macro
```

**Input de trades:** Campo de texto o formulario donde el usuario puede ingresar:
- Par (ej: "EURUSD")
- Tamaño (ej: +1, -0.5)
- El sistema calcula automáticamente la exposición agregada

---

### 📌 MEJORA 4 — Confianza Dinámica del Sesgo

#### ❓ Qué responde
**"¿Este sesgo forma parte de cosas que suelen funcionar o es ruido?"**

#### 🧠 Inputs existentes

- Cambios históricos de sesgo (BD guarda por fecha en `macro_bias`)
- Precio (retorno tras el sesgo si existiera)
- Tendencia de correlación (¿rompiendo o estable?)

#### 🔢 Lógica mínima viable

```javascript
// Para cada cambio de sesgo anterior en ese par/condición similar
for each historicalBias in samePar:
  if bias.action === historicalBias.action:
    if similarRegime(historicalBias.regime, currentRegime):
      totalSignals++
      
      // Verificar si el precio se movió a favor en 5-10 días
      priceMove = getPriceMoveAfterBias(historicalBias.date, 5-10 days)
      if priceMove aligns with bias.action:
        successCount++

confidence_adj = (successCount / totalSignals) * 100

// Clasificación
if confidence_adj >= 65%: color = "green" (🟢)
if confidence_adj >= 50% && < 65%: color = "yellow" (🟡)
if confidence_adj < 50%: color = "red" (🔴)
```

#### 🎯 Output

**Ubicación:** `/sesgos` (columna extra o tooltip en columna "Confianza")

**Formato:** Badge o indicador junto a la confianza actual:

```
Confianza: Alta
Confianza histórica: 62% (sobre 13 casos) 🟡
```

**Colores:**
- 🟢 Verde (≥65%): "Señal históricamente fiable"
- 🟡 Amarillo (50-65%): "Señal moderadamente fiable"
- 🔴 Rojo (<50%): "No tomar como señal dominante"

**Tooltip expandible:** Muestra desglose:
- Total de señales similares: 13
- Señales exitosas: 8
- Señales fallidas: 5
- Última señal similar: hace 15 días

---

## 📍 Ubicación de Mejoras en la UI

| Página | Bloque | Mejora |
|--------|--------|--------|
| `/analisis` | Arriba del todo | 🔸 Semáforo de fiabilidad |
| `/analisis` | Después del semáforo | 🔸 Radar de oportunidades |
| `/sesgos` | Columna "Confianza" | 🔸 Confianza histórica (badge/tooltip) |
| `/sesgos` | Nuevo bloque o modal | 🔸 Solapamiento de exposición |

---

## 🚀 Orden Lógico de Implementación

| Orden | Mejora | Tiempo aprox | Complejidad |
|-------|--------|--------------|-------------|
| 1️⃣ | Semáforo global | 1-2 horas | Baja (solo lectura) |
| 2️⃣ | Radar de oportunidades | 2-3 horas | Media (scoring) |
| 3️⃣ | Solapamiento de exposición | 3-4 horas | Media-Alta (UI + cálculos) |
| 4️⃣ | Confianza histórica | 1 día | Alta (cálculos históricos) |

### ⚡ Resultado Final

**Antes:** "Tengo datos macro muy buenos"

**Después:** "Sé cuándo operar, en qué pares y con qué riesgo real — y el sistema me avisa cuando NO debo operar"

---

## 💡 Notas de Implementación

### Consideraciones Técnicas

1. **Semáforo:** Requiere agregar endpoint `/api/system/reliability` que consolide métricas
2. **Radar:** Puede reutilizar datos de `/api/bias` y `/api/correlations`, solo necesita lógica de scoring
3. **Solapamiento:** Requiere input del usuario (trades activos) — puede ser opcional o integrado con portfolio tracking futuro
4. **Confianza histórica:** Requiere historial de sesgos en BD — verificar que `macro_bias` guarda timestamps

### Dependencias entre Mejoras

- **Semáforo** es independiente → puede implementarse primero
- **Radar** depende de datos de sesgos y correlaciones → ya disponibles
- **Solapamiento** requiere input del usuario → puede ser opcional inicialmente
- **Confianza histórica** requiere historial → verificar disponibilidad de datos históricos

### Priorización Recomendada

**Fase 1 (Valor inmediato):**
1. Semáforo de fiabilidad
2. Radar de oportunidades

**Fase 2 (Valor agregado):**
3. Solapamiento de exposición (si hay demanda)
4. Confianza histórica (requiere más datos históricos)

---

## 📞 Contacto y Soporte

### Repositorio
- **GitHub:** [URL del repositorio]
- **Documentación:** `/docs` en el repositorio
- **Issues:** Gestión de bugs y features en GitHub

### Estado del Proyecto
- **Versión:** 1.0 (Producción)
- **Última actualización:** Diciembre 2025
- **Mantenimiento:** Activo
- **Soporte:** Disponible

---

## ✅ Checklist de Verificación

### Funcionalidades Core
- [x] Dashboard con indicadores macro reales
- [x] Correlaciones calculadas automáticamente
- [x] Sesgos de trading por par
- [x] Narrativas tácticas automatizadas
- [x] Calendario económico actualizado
- [x] Notificaciones vía Telegram
- [x] Documentación completa en Ayuda

### Automatización
- [x] Jobs diarios funcionando
- [x] Ingesta automática de datos
- [x] Cálculo automático de correlaciones
- [x] Cálculo automático de sesgos
- [x] Notificaciones automáticas

### Calidad de Datos
- [x] 100% datos reales de fuentes oficiales
- [x] Validación de datos implementada
- [x] Manejo de errores robusto
- [x] Logs y monitoreo activo

### UI/UX
- [x] Diseño profesional y consistente
- [x] Responsive en todos los dispositivos
- [x] Navegación intuitiva
- [x] Explicaciones integradas
- [x] Tooltips y ayuda contextual

---

## 📝 Notas Finales

Este proyecto representa un sistema completo y funcional para análisis macroeconómico aplicado al trading. Todos los componentes están operativos y procesando datos reales de fuentes oficiales.

El código está bien estructurado, documentado y preparado para escalar. La arquitectura modular permite añadir nuevas funcionalidades sin afectar las existentes.

**Estado:** ✅ Producción - 100% Funcional

---

*Documento generado automáticamente - Diciembre 2025*




