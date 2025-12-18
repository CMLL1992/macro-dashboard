# Reporte de Cobertura de Indicadores por Moneda

**Fecha:** 2025-12-17  
**Script:** `pnpm analyze:currency-coverage`

---

## 📊 Resumen Ejecutivo

### Estado por Moneda

| Moneda | Mapeados | Con Datos | Recientes (90d) | Cobertura | Estado |
|--------|----------|-----------|-----------------|-----------|--------|
| **USD** | 19 | 16 (84%) | 10 (53%) | ⚠️ Media | Algunos obsoletos |
| **EUR** | 13 | 13 (100%) | 7 (54%) | ⚠️ Media | Datos obsoletos |
| **GBP** | 11 | 0 (0%) | 0 (0%) | 🔴 Crítico | Sin datos |
| **JPY** | 12 | 0 (0%) | 0 (0%) | 🔴 Crítico | Sin datos |
| **AUD** | 0 | 0 | 0 | 🔴 Crítico | Sin mapeo |

---

## 🔴 Problemas Críticos

### 1. GBP y JPY: Sin datos en BD (0% cobertura)

**Impacto:** Explica por qué GBP y JPY siempre salen "mixed" - no hay datos para calcular scores.

**Indicadores faltantes:**
- **GBP (11):** UK_GDP_QOQ, UK_GDP_YOY, UK_CPI_YOY, UK_CORE_CPI_YOY, UK_PPI_OUTPUT_YOY, UK_UNEMPLOYMENT_RATE, UK_AVG_EARNINGS_YOY, UK_SERVICES_PMI, UK_MANUFACTURING_PMI, UK_RETAIL_SALES_YOY, UK_BOE_RATE
- **JPY (12):** JP_GDP_QOQ, JP_GDP_YOY, JP_CPI_YOY, JP_CORE_CPI_YOY, JP_PPI_YOY, JP_UNEMPLOYMENT_RATE, JP_JOB_TO_APPLICANT_RATIO, JP_TANKAN_MANUFACTURING, JP_SERVICES_PMI, JP_INDUSTRIAL_PRODUCTION_YOY, JP_RETAIL_SALES_YOY, JP_BOJ_RATE

**Solución:**
- Activar ingesta de indicadores UK/JP (verificar si existen jobs `/api/jobs/ingest/uk` y `/api/jobs/ingest/jp`)
- O remover GBP/JPY del cálculo de regímenes hasta que haya datos

### 2. AUD: Sin mapeo (0 indicadores)

**Impacto:** AUD siempre sale "mixed" porque no está mapeado en `currency-indicators.json`.

**Solución:**
- Opción A: Añadir indicadores australianos al mapeo (RBA_RATE, AU_CPI_YOY, AU_GDP_YOY, etc.)
- Opción B: Remover AUD del cálculo de regímenes si no hay datos disponibles

---

## ⚠️ Problemas de Datos Obsoletos

### EUR: 6 indicadores obsoletos (>90 días sin actualizar)

1. **EU_ECB_RATE** - Último: 2025-06-11 (6 meses)
2. **EU_GDP_QOQ** - Último: 2025-07-01 (5.5 meses)
3. **EU_GDP_YOY** - Último: 2025-07-01 (5.5 meses)
4. **EU_INDUSTRIAL_PRODUCTION_YOY** - Último: 2025-09-01 (3.5 meses)
5. **EU_RETAIL_SALES_YOY** - Último: 2025-09-01 (3.5 meses)
6. **EU_ZEW_SENTIMENT** - Último: 2024-01-03 (11.5 meses) ⚠️ Muy obsoleto

**Impacto:** Scores de EUR están basados en datos parcialmente obsoletos.

**Solución:** Revisar pipeline de ingesta europea (`/api/jobs/ingest/european`)

### USD: 6 indicadores obsoletos (>90 días sin actualizar)

1. **CPIAUCSL** - Último: 2025-09-01 (3.5 meses)
2. **CPILFESL** - Último: 2025-09-01 (3.5 meses)
3. **PCEPILFE** - Último: 2025-09-01 (3.5 meses)
4. **PPIACO** - Último: 2025-09-01 (3.5 meses)
5. **GDPC1** - Último: 2025-04-01 (8.5 meses) ⚠️ Muy obsoleto
6. **INDPRO** - Último: 2025-09-01 (3.5 meses)

**Impacto:** Scores de USD están basados en datos parcialmente obsoletos.

**Solución:** Revisar pipeline de ingesta FRED (`/api/jobs/ingest/fred`)

---

## ✅ Indicadores con Buena Cobertura

### EUR
- ✅ **EU_CPI_YOY** - Reciente
- ✅ **EU_CPI_CORE_YOY** - Reciente
- ✅ **EU_UNEMPLOYMENT** - Reciente
- ✅ **EU_PMI_COMPOSITE** - Reciente
- ✅ **EU_PMI_MANUFACTURING** - Reciente
- ✅ **EU_PMI_SERVICES** - Reciente
- ✅ **EU_CONSUMER_CONFIDENCE** - Reciente

### USD
- ✅ **PAYEMS** - Reciente
- ✅ **UNRATE** - Reciente
- ✅ **ICSA** - Reciente
- ✅ **JTSJOL** - Reciente
- ✅ **FEDFUNDS** - Reciente
- ✅ **T10Y2Y** - Reciente
- ✅ **USPMI** - Reciente
- ✅ **HOUST** - Reciente
- ✅ **PERMIT** - Reciente
- ✅ **UMCSENT** - Reciente

---

## 🎯 Recomendaciones Prioritarias

### Prioridad 1 (Crítico): Activar ingesta UK/JP

**Acción:** Verificar y activar jobs de ingesta:
- `/api/jobs/ingest/uk` - Para indicadores UK
- `/api/jobs/ingest/jp` - Para indicadores JP

**Impacto:** Resolverá el problema de GBP/JPY siempre "mixed"

### Prioridad 2 (Alto): Actualizar datos obsoletos

**Acción:** Ejecutar jobs de ingesta para actualizar:
- `/api/jobs/ingest/european` - Para EUR
- `/api/jobs/ingest/fred` - Para USD

**Impacto:** Mejorará precisión de scores

### Prioridad 3 (Medio): Decidir sobre AUD

**Acción:** 
- Si hay datos disponibles: Añadir mapeo en `currency-indicators.json`
- Si no hay datos: Remover AUD del cálculo de regímenes

**Impacto:** Eliminará AUD siempre "mixed"

---

## 📝 Notas Técnicas

- **Criterio "reciente":** Datos en últimos 90 días
- **Criterio "obsoleto":** Último dato >90 días
- **Script:** `pnpm analyze:currency-coverage` para re-ejecutar análisis

---

## 🔍 Próximos Pasos

1. ✅ Verificar existencia de jobs `/api/jobs/ingest/uk` y `/api/jobs/ingest/jp`
2. ✅ Ejecutar ingesta completa para UK/JP
3. ✅ Re-ejecutar análisis para verificar mejoras
4. ✅ Decidir sobre AUD (mapear o remover)
