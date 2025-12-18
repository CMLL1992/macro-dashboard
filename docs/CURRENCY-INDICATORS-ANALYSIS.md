# Análisis de Mapeo de Indicadores por Moneda

**Fecha:** 2025-12-17  
**Objetivo:** Revisar balance de indicadores en `config/currency-indicators.json` para evitar regímenes clonados

---

## 📊 Resumen por Moneda

### USD (Estados Unidos)
- **Total:** 18 indicadores
- **Por grupo:**
  - Inflation: 4 (CPIAUCSL, CPILFESL, PCEPILFE, PPIACO)
  - Growth: 6 (GDPC1, INDPRO, RSXFS, USPMI, USPMI_SERVICES, HOUST, PERMIT)
  - Labor: 4 (PAYEMS, UNRATE, ICSA, JTSJOL)
  - Monetary: 2 (FEDFUNDS, T10Y2Y)
  - Sentiment: 2 (UMCSENT, NFIB)
- **Estado:** ✅ Bien balanceado, cobertura completa

### EUR (Eurozona)
- **Total:** 12 indicadores
- **Por grupo:**
  - Inflation: 2 (EU_CPI_YOY, EU_CPI_CORE_YOY)
  - Growth: 6 (EU_GDP_QOQ, EU_GDP_YOY, EU_INDUSTRIAL_PRODUCTION_YOY, EU_RETAIL_SALES_YOY, EU_PMI_COMPOSITE, EU_PMI_MANUFACTURING, EU_PMI_SERVICES)
  - Labor: 1 (EU_UNEMPLOYMENT)
  - Monetary: 1 (EU_ECB_RATE)
  - Sentiment: 2 (EU_CONSUMER_CONFIDENCE, EU_ZEW_SENTIMENT)
- **Estado:** ⚠️ Desbalanceado - falta más cobertura en Labor y Monetary

### GBP (Reino Unido)
- **Total:** 10 indicadores
- **Por grupo:**
  - Inflation: 3 (UK_CPI_YOY, UK_CORE_CPI_YOY, UK_PPI_OUTPUT_YOY)
  - Growth: 4 (UK_GDP_QOQ, UK_GDP_YOY, UK_SERVICES_PMI, UK_MANUFACTURING_PMI, UK_RETAIL_SALES_YOY)
  - Labor: 2 (UK_UNEMPLOYMENT_RATE, UK_AVG_EARNINGS_YOY)
  - Monetary: 1 (UK_BOE_RATE) - **Nota:** marcado como "inflation" pero debería ser "monetary"
  - Sentiment: 0 ❌
- **Estado:** ⚠️ Falta Sentiment, UK_BOE_RATE mal categorizado

### JPY (Japón)
- **Total:** 11 indicadores
- **Por grupo:**
  - Inflation: 3 (JP_CPI_YOY, JP_CORE_CPI_YOY, JP_PPI_YOY)
  - Growth: 5 (JP_GDP_QOQ, JP_GDP_YOY, JP_INDUSTRIAL_PRODUCTION_YOY, JP_RETAIL_SALES_YOY, JP_TANKAN_MANUFACTURING, JP_SERVICES_PMI)
  - Labor: 2 (JP_UNEMPLOYMENT_RATE, JP_JOB_TO_APPLICANT_RATIO)
  - Monetary: 1 (JP_BOJ_RATE) - **Nota:** marcado como "inflation" pero debería ser "monetary"
  - Sentiment: 0 ❌
- **Estado:** ⚠️ Falta Sentiment, JP_BOJ_RATE mal categorizado

### AUD (Australia)
- **Total:** 0 indicadores ❌
- **Estado:** ❌ Sin indicadores mapeados - esto explica por qué AUD sale "mixed" siempre

---

## 🔴 Problemas Identificados

### 1. AUD sin indicadores
- **Impacto:** AUD siempre sale "mixed" porque no tiene scores calculados
- **Solución:** Añadir indicadores australianos o remover AUD del cálculo de regímenes

### 2. GBP y JPY: BOE/BOJ mal categorizados
- `UK_BOE_RATE` está en "inflation" pero debería estar en "monetary"
- `JP_BOJ_RATE` está en "inflation" pero debería estar en "monetary"
- **Impacto:** Los scores de monetary están subestimados para GBP/JPY

### 3. Falta de Sentiment para GBP y JPY
- **Impacto:** Menos diferenciación en scores totales
- **Solución:** Añadir indicadores de sentimiento (PMI Services puede servir como proxy, pero idealmente Consumer Confidence o Business Confidence)

### 4. EUR: Labor desbalanceado
- Solo 1 indicador de labor (EU_UNEMPLOYMENT) vs 4 en USD
- **Impacto:** Menos precisión en laborScore para EUR

---

## ✅ Recomendaciones

### Prioridad Alta

1. **Corregir categorización de rates:**
   ```json
   "UK_BOE_RATE": { "currency": "GBP", "group": "monetary" },
   "JP_BOJ_RATE": { "currency": "JPY", "group": "monetary" }
   ```

2. **Decidir sobre AUD:**
   - Opción A: Añadir indicadores australianos (RBA Rate, CPI, GDP, Unemployment, etc.)
   - Opción B: Remover AUD del cálculo de regímenes si no hay datos disponibles

### Prioridad Media

3. **Añadir Sentiment para GBP:**
   - UK Consumer Confidence (si está disponible)
   - UK Services PMI puede servir como proxy temporal

4. **Añadir Sentiment para JPY:**
   - Japan Consumer Confidence
   - Tankan puede servir como proxy temporal

5. **Mejorar Labor para EUR:**
   - Añadir más indicadores de empleo si están disponibles (Job Vacancies, Labor Force Participation, etc.)

---

## 📝 Notas Técnicas

- Los indicadores deben existir en la BD (`macro_observations`) para que se calculen los scores
- El mapeo en `currency-indicators.json` usa `series_id` (ej: "EU_CPI_YOY"), no `key` interno (ej: "eu_cpi_yoy")
- El sistema de cálculo de scores en `domain/diagnostic.ts` usa `MAP_KEY_TO_WEIGHT_KEY` para convertir keys internos a series_id

---

## 🔍 Verificación de Datos

Para verificar qué indicadores tienen datos reales en la BD:

```sql
SELECT 
  series_id,
  COUNT(*) as count,
  MIN(date) as first_date,
  MAX(date) as last_date
FROM macro_observations
WHERE series_id LIKE 'EU_%' OR series_id LIKE 'UK_%' OR series_id LIKE 'JP_%'
GROUP BY series_id
ORDER BY series_id;
```

Esto mostrará qué indicadores están realmente poblados y cuáles están vacíos.
