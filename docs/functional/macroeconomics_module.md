# Especificación funcional — Módulo de datos macroeconómicos (EE. UU.)

**Producto:** Dashboard profesional con licencias (SaaS)

**Stack:** Next.js 14.2.5 (App Router) · React 18 · TypeScript 5.4 · Tailwind 3.4 · NextAuth 5 (beta) · Node 18+ · Prisma 5.18 · SQLite (dev) / PostgreSQL (prod) · Monorepo pnpm

**Ámbito:** EE. UU. (28 indicadores), preparado para multi-país/multi-moneda. Incluye calendario de publicaciones, alertas y gráficos históricos.

## 1. Objetivo y alcance

Integrar 28 indicadores macro clave de EE. UU. desde APIs oficiales (FRED, BLS, BEA, ISM, Conference Board, TradingEconomics).

Aplicar LAV (Latest Available Value) por frecuencia (D/W/M/Q) con fallbacks de fuente y backfill histórico.

Calcular posturas Dovish/Neutral/Hawkish, score ponderado y diagnóstico (Risk ON/OFF/Neutral).

Generar sesgos de activos ligados al diagnóstico macro.

Renderizar dashboard con tarjetas, tablas, gráficos históricos, calendario de releases y alertas.

Comercializar con licencias mensuales (Stripe), roles y gating por suscripción.

Preparado para multi-país y multi-moneda.

## 2. Arquitectura técnica

### 2.1 Monorepo (pnpm workspaces)

```
apps/
  web/                    # Next.js (App Router) - UI + API routes
packages/
  core/                   # Lógica de negocio: LAV, transforms, posture, scoring, strategy
  ingestors/              # Conectores/APIs y scheduler
  types/                  # Tipos compartidos TS
  ui/                     # (opcional) componentes UI compartidos
prisma/
  schema.prisma           # Esquema BD (SQLite dev / Postgres prod)
docs/functional/
  macroeconomics_module.md
```

### 2.2 Frontend

Next.js 14 App Router, Server Components + Server Actions.

Tailwind + shadcn/ui (cards, table, badge, tooltip, tabs, charts wrapper).

Recharts (líneas, área, barras; sin dependencias de estilos externas).

### 2.3 Backend

Next.js Route Handlers (`app/api/...`) + Server Actions para operaciones seguras.

Prisma ORM con migraciones.

Ingestors (`packages/ingestors`): clientes FRED/BLS/BEA/TradingEconomics/ISM/CB con retry/backoff, rate-limit y fallbacks.

Scheduler: cron externo (Vercel cron / GitHub Actions) invocando endpoints internos seguros.

### 2.4 Autenticación y licencias

NextAuth (email/password u OAuth opcional).

Stripe (Checkout, Webhooks, Customer Portal).

Middleware de acceso por Subscription.status.

## 3. Modelo de datos (Prisma)

Ver `prisma/schema.prisma` para el esquema completo actualizado.

### Modelos principales:

- **Region**: Países/regiones (US, EU, CN, etc.)
- **Indicator**: 28 indicadores macro con categoría, frecuencia, peso
- **IndicatorSourceMap**: Mapeo de fuentes con prioridad (fallbacks)
- **Observation**: Valores históricos con fecha, provider, revision
- **PostureRule**: Reglas de postura con bandas y transformaciones
- **PostureSnapshot**: Posturas calculadas por indicador y fecha
- **MacroScore**: Score ponderado y diagnóstico por región
- **AssetBias**: Sesgos de activos vinculados a MacroScore
- **ReleaseCalendar**: Calendario de próximos releases
- **FreshnessPolicy**: Políticas de frescura por indicador/frecuencia

### Enums:

- `IndicatorCategory`: LEADING | COINCIDENT | LAGGING
- `Frequency`: D | W | M | Q
- `Importance`: VERY_HIGH | HIGH | MEDIUM
- `DataSource`: FRED | BLS | BEA | TE | ISM | CB | CBOE | OTHER
- `Transform`: NONE | YOY_PERCENT | YOY_FROM_PRICE_INDEX | MO_M_DELTA | SPREAD
- `Posture`: DOVISH | NEUTRAL | HAWKISH
- `RiskSignal`: RISK_ON | NEUTRAL | RISK_OFF
- `TradeBias`: BUY | SELL | NEUTRAL

## 4. Datos semilla

### 4.1 Indicadores (28)

Utilizar el seed de 28 indicadores ya definido (`data/indicators_seed.json`).

Región por defecto: "US".

### 4.2 Reglas de postura

Usar el seed de `data/posture_rules_seed.json` entregado (bandas por indicador, numeric_map).

### 4.3 Políticas de frescura por frecuencia (valores por defecto)

- D: maxAgeDays = 7
- W: maxAgeDays = 21
- M: maxAgeDays = 75
- Q: maxAgeDays = 140

(Se puede sobrescribir por indicador en FreshnessPolicy.)

## 5. Ingesta de datos (packages/ingestors)

### 5.1 Fuentes y endpoints prioritarios

- **FRED**: series `.../fred/series/observations?series_id=CODE&api_key=...`
- **BLS API**: empleo, CPI/PPI, AHE; usar series oficiales.
- **BEA API**: PIB, PCE/Core PCE.
- **TradingEconomics (TE)**: ISM, Conference Board, vivienda, proxies.
- **ISM / Conference Board**: como fallbacks (si hay endpoints o scraping controlado).

Ver `data/data_sources.json` (Mapa de APIs) para código y URL de cada indicador.

### 5.2 Pipeline de ingesta (por indicador)

1. Seleccionar fuente por `IndicatorSourceMap` (priority asc).
2. Fetch con retry/backoff (exponencial), gestión de 429 y 5xx.
3. Normalizar a `Observation[]`:
   - `date` = fin de periodo (p. ej., 2025-10-31 para mensual).
   - `releasedAt` y `nextReleaseAt` si la API lo expone.
   - `provider`, `sourceUrl`.
4. Persistir con upsert por `(indicatorId, date, provider)`.
5. Transformar (`packages/core`):
   - `YOY_PERCENT`: `(v_t / v_t-12 - 1) * 100`.
   - `YOY_FROM_PRICE_INDEX`: igual pero series índice (CPI/PCE/PPI).
   - `MO_M_DELTA`: `v_t - v_t-1` (NFP, orders…).
   - `SPREAD`: si aplica, garantizar patas alineadas por fecha.
6. Calcular postura contra `PostureRule` → crear `PostureSnapshot`.
7. Actualizar `ReleaseCalendar.nextReleaseAt` si proveedor lo da.
8. Log en `AuditLog` (GET ok/fail, latencia, proveedor, #obs).

### 5.3 Backfill histórico

Al iniciar, descargar ≥ 5 años para M/Q y ≥ 10 años para D (curvas, VIX, HY, BE).

Job nocturno: reintentar huecos de los últimos 24 meses y capturar revisiones (recalcular).

### 5.4 Scheduler

- **Diario (09:00 ET)**: FRED (D), VIX, HY spread, breakeven, Fed Funds.
- **Semanal (vie 09:00 ET)**: NFCI, Claims.
- **Mensual**:
  - Día 1–5: ISM Manu/Serv, Confianza (CB/Michigan prelim).
  - Día 10–13: CPI.
  - Último viernes: PCE/Core PCE.
  - Primer viernes: NFP, AHE, Unrate.
  - 15–20: Retail, INDPRO, TCU, Vivienda, Pedidos.
- **Trimestral**: BEA GDP (advance/second/third) en fines de ene/abr/jul/oct a 8:30 ET.

## 6. LAV (Latest Available Value) y fallbacks

### 6.1 Política LAV

Determinar LAV por indicador consultando `Observation` orden DESC por `date`, `releasedAt`.

Si el mes actual no está, usar mes anterior (octubre → septiembre → …).

**Badges de frescura en UI:**
- < 30d 🟢 Actualizado
- 30–60d 🟠 Desactualizado
- > 60d 🔴 Antiguo

Si no hay observaciones en 24 meses → marcar "Sin datos" y excluir del score (renormalizar pesos).

### 6.2 Transformaciones dependientes de LAV

YoY% requiere t y t-12. Si falta t-12, retroceder un mes hasta hallar par válido (con límite 3 retrocesos).

Δ mensual requiere t y t-1 (mismo patrón).

Spreads requieren alineación de fechas de ambas patas.

## 7. Scoring y diagnóstico macro

### 7.1 Postura numérica

Map: DOVISH = +1, NEUTRAL = 0, HAWKISH = -1.

### 7.2 Score ponderado

```typescript
weightedScore = Σ (weight_i * numericValue_i)  // usando LAV de cada indicador
```

Renormalizar pesos de indicadores válidos cuando falte alguno (`sum(weights_valid) = 1`).

Guardar `MacroScore` con `breakdownJson` (contribuciones).

### 7.3 Diagnóstico

`threshold_abs = 0.30` (configurable).

- `score ≥ +0.30` → RISK_ON
- `score ≤ −0.30` → RISK_OFF
- otro → NEUTRAL

## 8. Estrategia de activos

### 8.1 Mapeo por diagnóstico (estático)

- **RISK_ON** → AUDUSD BUY, USDJPY BUY, EURUSD BUY, GBPUSD BUY, USDCAD SELL, XAUUSD SELL/NEUTRAL, BTC/ETH BUY.
- **RISK_OFF** → XAUUSD BUY, USDCAD BUY, resto SELL; crypto SELL/NEUTRAL.
- **NEUTRAL** → todos NEUTRAL.

Persistir en `AssetBias` vinculado a `MacroScore` más reciente (`linkedDate`, `linkedScoreId`).

### 8.2 UI

Badge por activo: 🟢 BUY / 🔴 SELL / ⚪️ NEUTRAL.

Texto: "Sesgo {alcista/bajista} derivado de entorno {RISK_ON/RISK_OFF}".

## 9. APIs internas (apps/web)

- `GET /api/indicators`: Resumen LAV por indicador
- `GET /api/indicators/[id]/history?from=&to=`: Observaciones normalizadas + transform aplicable
- `GET /api/score/latest?region=US`: Último MacroScore
- `GET /api/assets/bias?region=US`: Lista de AssetBias vigente
- `GET /api/releases/upcoming?region=US`: Calendario de próximos releases

Seguridad: JWT/NextAuth + middleware de plan/rol. Rate-limit por usuario/plan.

## 10. UI/UX

### 10.1 Vistas

**Resumen**
- Tarjeta principal: RiskSignal, weightedScore, fecha de cálculo.
- Semáforo conteo D/N/H.
- Módulo Próximos datos (calendario).
- Aviso de calidad: "Score calculado con 26/28 indicadores".

**Indicadores**
- Tabla: Nombre, Valor, As of (period), Publicado, Frescura (badge), Postura, Fuente (link).
- Detalle indicador: gráfico histórico (línea) con bandas de umbral (D/N/H), sparkline, metadatos.

**Estrategia**
- Cards por símbolo con badge BUY/SELL/NEUTRAL, texto de racional, timestamp del MacroScore.

**Releases**
- Calendario con próximos eventos por indicador; CTA "Ver serie" que abre detalle.

### 10.2 Gráficos

Recharts:
- Series de línea para valores transformados (YoY/Δ).
- Líneas/bandas horizontales para umbrales de postura.
- Tooltip con As of y Published.

## 11. Calendario de publicaciones y alertas

### 11.1 Reglas textuales (ReleaseCalendar)

- ISM Manu: primer día hábil, 10:00 ET.
- ISM Servicios: tercer día hábil, 10:00 ET.
- Confianza CB: último martes, 10:00 ET.
- Michigan: prelim mediados de mes, final a fin de mes.
- NFP/AHE/Unrate (BLS): primer viernes, 8:30 ET.
- CPI (BLS): ~ 10–13 de mes, 8:30 ET.
- PCE/Core PCE (BEA): último viernes, 8:30 ET.
- GDP (BEA): ene/abr/jul/oct, 8:30 ET (advance/second/third).
- FRED diarios (curva, VIX, HY, T10YIE): cada día hábil ~18:00 ET.
- Claims/NFCI: semanal.

### 11.2 Alertas

Backend cron verifica `now()` vs `ReleaseCalendar.nextReleaseAt ± ventana`.

Al publicarse: dispara ingesta prioritaria y recalcula MacroScore.

UI: banner "Nuevo dato: CPI Oct 2025 publicado".

## 12. Sistema de licencias (Stripe) y acceso

### 12.1 Stripe

Products/Prices: Macro Pro mensual/anual.

Checkout → Webhook `checkout.session.completed` → crear/activar Subscription.

Webhook `invoice.payment_failed` → marcar `past_due`.

### 12.2 Acceso

Middleware: bloquear vistas/API si `subscription.status ∉ {active, trialing, past_due(grace)}`.

Roles: user, subscriber, admin.

Planes:
- Starter: US, refresco diario, sin export.
- Pro: + países, export CSV, API read.
- Enterprise: SLA/SSO.

## 13. Logging, auditoría y calidad de datos

### 13.1 AuditLog

- `timestamp`, `indicatorId`, `provider`, `status`, `latency_ms`, `items`, `error` (si aplica).
- `missing_data_log`: indicadores sin datos <24 meses (debe tender a 0).
- `revision_log`: cambios retroactivos y recomputos.

### 13.2 Validaciones

- Rango por indicador (PMI 0–100; Unrate 0–25; spreads −5..+5).
- Sin fechas futuras.
- NaN/null → no persiste; registrar error.
- En revisiones, marcar `revision=true` y recomputar postura/score.

## 14. QA checklist (resumen operativo)

- [ ] APIs vivas (FRED/TE/BEA/BLS responden con datos).
- [ ] Cobertura temporal (28/28 con ≥1 valor en 24 meses; histórico ≥ 5 años).
- [ ] Transforms correctos (YoY, Δ, spreads).
- [ ] Posturas correctas vs bandas.
- [ ] Score renormaliza y queda en [-1, +1]; diagnóstico correcto.
- [ ] UI muestra As of, Published, Frescura, Fuente.
- [ ] Estrategia reacciona a RiskSignal.
- [ ] Logs completos; sin errores silenciosos.

## 15. Escalabilidad multi-país / multi-moneda

Añadir `Region{ id:'US', code:'US', currency:'USD' }` y duplicar para EU, CN, etc.

`Indicator.regionId` parametriza misma lógica con códigos/series propios.

`IndicatorSourceMap` por región (códigos FRED/TE/BEA/BLS equivalentes).

UI: selector de región y normalización de moneda cuando aplique.

Score/estrategia por región independientes (tab "US / EU / CN").

## 16. Seguridad y cumplimiento

- `.env` solo en servidor; nunca exponer API keys al cliente.
- CORS mínimo; rate-limit por IP y por usuario/plan.
- Licencias: respetar ToS de cada API (no redistribuir masivamente).

## 17. Entregables y criterios de aceptación

- [x] Seeds cargados: 28 indicadores + posture rules + freshness policies + source map + calendario.
- [x] Ingesta funcionando: backfill histórico + jobs periódicos por frecuencia.
- [x] LAV operativo con fallbacks y badges en UI.
- [x] Score y diagnóstico visibles y coherentes.
- [x] Estrategia conectada y reactiva.
- [ ] Calendario y alertas integrados.
- [ ] Stripe con gating y portal.
- [ ] QA checklist pasado al 100 %.

## 18. Apéndices

### 18.1 Lista de indicadores (28) — referencia

Ver `data/indicators_seed.json` para la lista completa.

### 18.2 Transformaciones por indicador (resumen)

- `YOY_FROM_PRICE_INDEX`: CPI, Core CPI, PCE, Core PCE, PPI.
- `YOY_PERCENT`: Retail, INDPRO, AHE, vivienda, capex…
- `MO_M_DELTA`: NFP, durable/capex si se usa Δ.
- `SPREAD`: Curva 10y-2y (si no se usa la serie T10Y2Y directa).

### 18.3 Reglas de postura (resumen)

Ver `data/posture_rules_seed.json` para detalle completo.

- ISM <50 Dovish, 50–55 Neutral, >55 Hawkish.
- Inflación (CPI/PCE/Core/PPI) <2.5 Dovish, 2.5–3.0 Neutral, >3.0 Hawkish.
- Unrate >4.5 Dovish, 4.0–4.5 Neutral, <4.0 Hawkish.
- Curva <0 Dovish, 0–1 Neutral, >1 Hawkish.
- PIB YoY <1 Dovish, 1–2.5 Neutral, >2.5 Hawkish.

## Notas finales de implementación

- Implementar orden de fallbacks por indicador con `IndicatorSourceMap.priority`.
- Centralizar reintentos y rate-limit con cabeceras y Retry-After.
- Toda la lógica de LAV, transforms, postura y score vive en `packages/core`.
- UI debe mostrar As of, Published, Frescura, Fuente en cada card.
- Nunca devolver NaN/null al cliente: degradar con mensaje y renormalizar el score.

