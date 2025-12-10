## RESUMEN DEL PROYECTO

### 1) Visión general
- Nombre: Macro Dashboard CM11 Trading.
- Stack: Next.js 14 (App Router), TypeScript, Tailwind. Base de datos SQLite (better-sqlite3). Deployment en Vercel. Gestor: pnpm 10.20.0. Node objetivo: 20.x.
- Objetivo: mostrar estado macro (indicadores, sesgos, correlaciones, narrativas) y generar señales tácticas por par con soporte de noticias/calendario y notificaciones (Telegram).

### 2) Estructura principal
- `app/`: páginas (dashboard, correlaciones, narrativas, noticias, notificaciones, admin, qa, sesgos, settings) y API routes (`/api/bias`, `/api/jobs/*`, `/api/correlations`, `/api/health`, `/api/diag`, etc.).
- `domain/`: lógica de negocio (motor macro: bias, correlaciones, trading-bias, diagnostic).
- `lib/`: utilidades (DB schema/lectura/escritura, cálculos de bias/correlaciones, notificaciones, seguridad, formatos).
- `config/`: pesos de indicadores, mapeos de activos y eventos, reglas QA.
- `scripts/`: ingestas (FRED, noticias, calendario), refrescos y verificaciones.
- `tests/`: vitest para lógica crítica.

### 3) Datos e ingestas
- Fuentes: FRED y otras (calendario/noticias via RSS/scripts). Endpoints protegidos con `CRON_TOKEN`/`INGEST_KEY`.
- Jobs clave (`/api/jobs/*` y scripts):
  - `ingest/fred`, `ingest/macro`: series macro a `macro_observations`.
  - `correlations`: calcula corr3/6/12/24 y guarda en `correlations`.
  - `compute/bias`: recalcula sesgos y `macro_bias`.
  - `weekly`: vista semanal.
  - `news/insert`, `calendar/insert`: alta de noticias/eventos.
- Tablas principales:
  - `macro_observations` (series crudas), `indicator_history` (current/previous + fechas),
    `macro_bias` (sesgos por activo), `correlations` (corr3/6/12/24),
    `news`, `calendar`, `notifications`.

### 4) Cálculo de indicadores y bias macro
- Diagnóstico: `getMacroDiagnosis()` lee BD (con fallback opcional a FRED) y arma `items` con valor, valor previo, fecha, peso, categoría, postura (`Hawkish/Neutral/Dovish`), tendencia y z-score.
- Pesos: `config/weights.json` (umbral 0.3). Pesos altos mueven más el score y la postura.
- Bias macro (motor): `getBiasState()` → `getBiasRaw()`
  - Bloques: USD strength, Quad (crecimiento vs inflación), Liquidez (WALCL, RRP, TGA, M2), Crédito (curva y spreads), Riesgo.
  - Métricas: usdScore, quadScore, liquidityScore, creditScore, riskScore.
  - Régimen global: overall, usd_direction, quad, liquidity, credit, risk.
  - Tabla de indicadores (BiasRow): value/value_previous, delta, fechas, peso, tendencia, postura.
  - Tabla táctica (TacticalBiasRow) por par: acción (long/short/neutral), confianza, motivo, corr3m/corr12m, benchmark.

### 5) Regímenes macro por moneda (USD, EUR, GBP, JPY, AUD)
- Mapeo de indicadores a moneda/grupo: `config/currency-indicators.json`.
- Cálculo: `computeCurrencyScores()` suma contribuciones ponderadas por moneda (growth, inflation, labor, monetary, sentiment). Postura numérica en [-1,1] × peso.
- Clasificación: `getRegime(growthScore, inflationScore)` → Reflación, Estanflación, Recesión, Goldilocks o Mixto. Umbrales ±0.2. Probabilidad = min(1, max(|g|,|inf|)/0.5).
- Uso: tarjetas en dashboard con régimen, probabilidad y descripción; alimenta señales por par (score relativo base-quote).

### 6) Correlaciones
- Motor: `domain/macro-engine/correlations.ts`.
- Prioridad de datos: 1) tabla `correlations` en BD, 2) `corrMap` precalculado, 3) recálculo (`getCorrelations`) como último recurso.
- Ventanas soportadas: 3m/6m/12m/24m. Shifts: delta corr12m vs corr3m → Break/Reinforcing/Stable/Weak. Summary: mejor ventana, tendencia (Strengthening/Weakening/Stable), macroRelevanceScore.
- Se muestran en `/correlations` y se adjuntan a la tabla táctica para confianza/motivo.

### 7) Sesgos tácticos por par
- Usa sesgos por divisa (currencyScores) + régimen macro + correlaciones.
- `pairScore = base.totalScore - quote.totalScore`; ajusta dirección (long/short) y confianza con corr3m/corr12m vs benchmark (DXY u otro).
- Motivos en español (táctico/acción/confianza) para la UI y narrativas.

### 8) Narrativas y QA
- Narrativas (`/narrativas`): generan texto por activo combinando señales de crecimiento, inflación, liquidez/crédito y correlaciones.
- QA (`/qa`): frescura de datos, nulls, y checks de estado de ingestas.

### 9) Noticias, calendario y notificaciones
- Noticias/calendario: ingestados vía scripts y endpoints; mostrados en `/noticias` y usados en notificaciones.
- Notificaciones: Telegram (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `ENABLE_TELEGRAM_NOTIFICATIONS`). Endpoints `/api/notifications/test` y `/api/notifications/verify`.

### 10) Salud y diagnóstico
- `/api/health`: toca BD y devuelve conteos/estado (macro_observations, macro_bias, correlations).
- `/api/diag`: llama FRED (T10Y2Y, UNRATE, GDPC1) sin BD para aislar problemas de red/API vs base de datos.
- Hay script para simplificar `/api/health` en debug (`scripts/simplify-health-endpoint.sh`).

### 11) Problemas históricos y fixes relevantes
- Tabla del dashboard con valores “—” cuando `value/date` venían null: se añadieron fallbacks a `indicator_history` y búsqueda por `originalKey`.
- Health en Vercel: a veces 500 si BD no accesible; guía de debug en `INFORMACION-PARA-CHATGPT.md`.
- Node local 24 vs requerido 20: warning; en producción se usa 20.x.

### 12) Cómo arrancar local
- Instalar deps: `pnpm install` (Node 20.x recomendado).
- Dev server: `pnpm exec next dev -p 3000` (usar `WATCHPACK_POLLING=true` si hay EMFILE).
- Jobs manuales (protección con token en headers):
  - `pnpm job:ingest:fred`
  - `pnpm job:correlations`
  - `pnpm job:bias`
  - `pnpm job:bootstrap` (fred + correlations + bias)

### 13) Páginas principales (qué muestra cada una)
- `/dashboard`: indicadores macro (tabla ponderada) + sesgos por par (acción/confianza/motivo) + regímenes por moneda.
- `/correlations`: correlaciones multi-ventana, shifts y summary.
- `/sesgos`: foco en señales tácticas por par.
- `/narrativas`: storytelling macro por activo.
- `/noticias`: feed de noticias/eventos ingestados.
- `/notificaciones`: panel de configuración y test de Telegram.
- `/qa`: estado de frescura y calidad de datos.
- `/admin/*`: CRUD de news/calendar/notifications.
- `/health` y `/diag`: checks de salud (BD vs red/FRED).

### 14) Archivos clave a consultar
- `domain/diagnostic.ts`: diagnosis, currencyScores/regimes, z-scores.
- `domain/macro-engine/bias.ts`: bias state, tabla macro y táctica.
- `domain/macro-engine/correlations.ts`: estado de correlaciones, shifts y summary.
- `config/weights.json`: pesos de indicadores.
- `config/currency-indicators.json`: mapeo indicador → moneda/grupo.
- `lib/db/read-macro.ts` / `lib/db/upsert.ts`: lectura/escritura de series.
- `scripts/ingest-*.ts`: ingestiones de datos y noticias.


