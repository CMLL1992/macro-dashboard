# Dónde están los nombres “bonitos” y las banderas

## 1) Fuente de verdad ya existe en el repo

| Qué | Archivo | Uso |
|-----|---------|-----|
| **Nombres humanos** | `lib/utils/indicator-labels.ts` | `INDICATOR_LABELS`, `getIndicatorLabel(key)` |
| **Banderas por región** | `lib/utils/indicator-region.ts` | `REGION_FLAGS`, `getIndicatorRegionFlag(key)` |
| **Coverage por país** | `lib/utils/coverage-by-country.ts` | `FLAG_BY_COUNTRY` (🇺🇸 🇪🇺 🇯🇵 🇨🇳) |

La tabla del overview (`CoreIndicatorsTable`) ya usa:
- `ind.label` para el nombre (viene del API).
- `getIndicatorRegionFlag(ind.key)` para la bandera.

## 2) Por qué no se ven bien en producción

- **`/api/overview`** construye `coreIndicators` a partir de **`config/core-indicators.json`**, cuyos **keys son IDs de FRED** (p. ej. `CPIAUCSL`, `GDPC1`, `PAYEMS`), no los keys de `indicator-labels` (`cpi_yoy`, `gdp_qoq`, etc.).
- **`indicator-labels.ts`** y **`indicator-region.ts`** tienen mapeos por key tipo `cpi_yoy`, `eu_gdp_qoq`, `jp_cpi_yoy`. No tienen entradas para `CPIAUCSL`, `GDPC1`, etc.
- Resultado: el API puede devolver `label` genérico o el key, y `getIndicatorRegionFlag('CPIAUCSL')` no encuentra región → no se muestra bandera.

## 3) Configs relevantes

- **`config/core-indicators.json`**: lista de indicadores del overview (keys FRED + `name` por indicador).
- **`config/macro-indicators.ts`**: labels por región (Eurozona, etc.) y más detalle.
- **`config/european-indicators.json`**, **`config/jp-indicators.json`**, **`config/cn-indicators.json`**: nombres por país/región.

Los “nombres bonitos” y la idea de región/país están en esos sitios; el overview actual no los usa para los keys FRED de `core-indicators.json`.

## 4) Qué hacer para que se vean nombres y banderas

1. **En el API `/api/overview`**  
   Al construir cada `coreIndicator`, usar un nombre “bonito” cuando exista:
   - Si `core-indicators.json` tiene `name` para ese key, usarlo como `label`.
   - Si no, usar `getIndicatorLabel(coreKey)` (y extender `indicator-labels.ts` con los keys FRED que uses).

2. **En `lib/utils/indicator-labels.ts`**  
   Añadir entradas para los keys de FRED que devuelve el overview (p. ej. `CPIAUCSL`, `CPILFESL`, `PCEPILFE`, `GDPC1`, `PAYEMS`, `UNRATE`, `FEDFUNDS`, `VIXCLS`, etc.) con el nombre que quieras mostrar.

3. **En `lib/utils/indicator-region.ts`**  
   Añadir en `INDICATOR_TO_REGION` los mismos keys FRED → región (p. ej. todos USA salvo los que correspondan a otra región). Así `getIndicatorRegionFlag(ind.key)` devolverá bandera para los indicadores del overview.

4. **Opcional: `label` desde `core-indicators.json`**  
   En el overview, al construir cada item de `coreIndicators`, leer el `name` del indicador en `config/core-indicators.json` (por key) y usarlo como `label` si está definido. Así no dependes de que `getIndicatorLabel` tenga ya todos los FRED keys.

## 5) Resumen

- **Nombres:** vienen de `indicator-labels.ts` y de los `name` en configs (p. ej. `core-indicators.json`, `macro-indicators.ts`). El overview hoy no une bien keys FRED con esos nombres.
- **Banderas:** vienen de `indicator-region.ts` (`getIndicatorRegionFlag`). Los keys FRED no están mapeados a región, por eso no sale bandera.
- **Siguiente paso concreto:** extender `indicator-labels.ts` e `indicator-region.ts` con los keys de `core-indicators.json` y, en el overview, asignar `label` (y opcionalmente región/flag) usando ese nombre y ese mapeo.
