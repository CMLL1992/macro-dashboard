# Fuente de verdad del dashboard macro multi-región

## Resultado de la búsqueda (rg + análisis)

### 1. Fuente de verdad por bloques y regiones: **`config/currency-indicators.json`**

Este archivo **ya define** la estructura por región y grupo que describías:

| Región | Currency | Ejemplos de keys | Grupos |
|--------|----------|------------------|--------|
| 🇺🇸 US | USD | CPIAUCSL, GDPC1, PAYEMS, FEDFUNDS | inflation, growth, labor, monetary, sentiment |
| 🇪🇺 Eurozona | EUR | EU_CPI_YOY, EU_GDP_QOQ, EU_PMI_*, EU_ECB_RATE | inflation, growth, labor, monetary, sentiment |
| 🇬🇧 UK | GBP | UK_GDP_QOQ, UK_CPI_YOY, UK_BOE_RATE | inflation, growth, labor, monetary |
| 🇯🇵 Japón | JPY | JP_GDP_QOQ, JP_CPI_YOY, JP_BOJ_RATE | inflation, growth, labor, monetary |
| 🇦🇺 Australia | AUD | AU_CPI_YOY, AU_GDP_QOQ, AU_RBA_RATE | inflation, growth, labor, monetary |

Estructura por entrada:

```json
"EU_CPI_YOY": { "currency": "EUR", "group": "inflation" },
"UK_BOE_RATE": { "currency": "GBP", "group": "monetary" },
"JP_CPI_YOY": { "currency": "JPY", "group": "inflation" }
```

- **group**: `inflation` | `growth` | `labor` | `monetary` | `sentiment`
- **currency**: USD, EUR, GBP, JPY, AUD (mapeables a banderas 🇺🇸 🇪🇺 🇬🇧 🇯🇵 🇦🇺)

China (CN) no está en este JSON; si lo necesitas, se puede añadir siguiendo el mismo patrón.

---

### 2. Capa de datos que ya construye secciones: **`lib/dashboard-data.ts`**

- **`getDashboardData()`** ya devuelve **`macroSections`**:
  - Primera sección: **EUROZONA** (todos los indicadores `eu_*`).
  - Resto: **GLOBAL / USA** (indicadores no eurozona).
- Asigna `section: 'EUROZONA'` a cualquier indicador cuyo key empiece por `eu_`.
- Usa `europeanIndicators` (helpers de lectura EU) y los mezcla en `finalIndicatorRows` y en `macroSections`.

Por tanto, la capa de datos **ya tiene** bloques por región (al menos Eurozona vs Global/USA). Es la misma capa que usa `/api/dashboard` y `/api/snapshot`, pero **no** `/api/overview`.

---

### 3. Por qué ahora solo ves EEUU en el overview

- **`/api/overview`** (el endpoint que usa la UI del Macro Market Overview) **no** usa ni `currency-indicators.json` ni `macroSections`.
- Solo usa **`config/core-indicators.json`**, que es una lista **plana y solo US** (FRED + un par de World Bank).
- La UI (`MacroOverviewDashboard` → `CoreIndicatorsTable`) recibe **`coreIndicators`** (array plano) y pinta una sola tabla sin bloques ni regiones.

Resumen:

| Qué | Fuente actual del overview | Fuente del “dashboard bueno” |
|-----|----------------------------|-------------------------------|
| Lista de indicadores | `core-indicators.json` (solo US) | `currency-indicators.json` (USD, EUR, GBP, JPY, AUD) |
| Agrupación por bloques | No (todo plano) | `group` (inflation, growth, labor, monetary, sentiment) |
| Agrupación por región | No | `currency` → banderas por región |
| Secciones (EUROZONA / Global) | No | `macroSections` en `getDashboardData()` |

---

### 4. Archivos y componentes relevantes (encontrados con rg)

- **Config por región/grupo**
  - `config/currency-indicators.json` – **fuente de verdad** multi-región y por grupo.
  - `config/core-indicators.json` – solo US, lista plana (lo que usa hoy el overview).
  - `config/european-indicators.json` – categorías “Crecimiento / Actividad”, “Precios / Inflación”, etc.
  - `config/macro-indicators.ts` – labels (USA + Eurozona).
- **Datos y secciones**
  - `lib/dashboard-data.ts` – construye `macroSections` (EUROZONA + GLOBAL/USA) y asigna `section`.
  - `lib/utils/coverage-by-country.ts` – usa `currency-indicators.json` para cobertura por moneda.
- **UI**
  - `components/MacroOverviewDashboard.tsx` – pestañas D/W/M, llama a `/api/overview`, recibe `coreIndicators`.
  - `components/CoreIndicatorsTable.tsx` – tabla única con `ind.label` y `getIndicatorRegionFlag(ind.key)`.
- **Categorías en UI/API**
  - `app/api/overview/route.ts` – asigna `category` (Crecimiento | Empleo | Inflación | Tipos) por key, pero sobre la lista US-only.
  - `components/MacroOverviewDashboard.tsx` – mismo tipo de categoría para fallback.
  - `lib/utils/macro-bias-drivers.ts` – categorías 'Crecimiento' | 'Inflación' | 'Tipos' | 'Empleo'.

---

### 5. Qué hacer para reactivar el dashboard “bueno” (sin reconstruir a ojo)

1. **Definir la lista del overview desde `currency-indicators.json`**  
   En lugar de tomar solo los keys de `core-indicators.json`, tomar los keys de `currency-indicators.json` (o una lista curada a partir de ellos) para que el overview incluya US, EU, UK, JP (y opcionalmente AU/CN).

2. **Exponer agrupación en `/api/overview`**  
   Opción A: Devolver **`macroSections`** (o un formato equivalente) además de o en lugar de un array plano, para que la UI pueda pintar:
   - bloques por sección (ej. Eurozona, Global/USA), y/o  
   - bloques por grupo (Inflación, Empleo, Crecimiento, Tipos).  
   Opción B: Seguir devolviendo un array de indicadores pero añadiendo **`section`** y **`group`** (y opcionalmente `currency`) por indicador, derivados de `currency-indicators.json` y de la lógica de `dashboard-data.ts`.

3. **Actualizar la UI**  
   - Que `CoreIndicatorsTable` (o un componente padre) agrupe por `section` y/o por `group` y muestre banderas por región usando ya `getIndicatorRegionFlag(ind.key)` (y si hace falta, `currency` del config).  
   - Nombres y banderas siguen viniendo de `indicator-labels.ts` e `indicator-region.ts` (y del `name` en configs); solo hace falta que el overview devuelva keys que existan en esos mapeos (ya cubierto para US; EU/UK/JP ya tienen entradas en ambos).

Con esto se **reactiva** la estructura por bloques y regiones usando la fuente de verdad que ya tienes (`currency-indicators.json` + `macroSections` en `getDashboardData()`), sin inventar configs nuevos.

---

### 6. Búsquedas ejecutadas (para replicar)

```bash
rg "Inflation|Empleo|Inflación|Growth|Crecimiento|Rates|Tipos"
rg "EU|Eurozone|EUR|UK|Japan|China|JP|CN" --glob "*.{ts,tsx,json}"
rg "group|section|category" app lib config
```

El hallazgo clave es **`config/currency-indicators.json`** (grupos + moneda por indicador) y **`lib/dashboard-data.ts`** (macroSections con EUROZONA y Global/USA).

---

### 7. Diagnóstico de cobertura y modo auditoría

**Log de cobertura (en `/api/overview`):** En cada request se escribe `overview.coverage` con:

- `defined`: número de keys en `currency-indicators.json`
- `shown`: número de indicadores devueltos (solo keys con datos en snapshot, salvo en modo auditoría)
- `missing`: defined − shown
- `missingSample`: hasta 50 keys que faltan
- `missingBecauseNoData`: cuántos de los missing no están en `dashboardData.indicators` (no llegan de getDashboardData)
- `inSnapshotNotInConfig`: keys que sí vienen en el snapshot pero no están en config (muestra hasta 20)

En **Vercel logs** (o consola del servidor) busca `overview.coverage` para ver qué keys faltan y por qué.

**Modo auditoría:** Para ver el catálogo completo (incluidos indicadores sin datos):

- API: `GET /api/overview?tf=d&audit=1`
- Página: abrir `/dashboard?audit=1`

Con `audit=1` la respuesta incluye **todos** los keys de `currency-indicators.json`; los que no tienen datos en snapshot salen con `value`/`date` null y en la tabla se muestra el badge **"Sin datos"**. Así se ve qué está definido y qué falta por resolver (datasource/getDashboardData).
