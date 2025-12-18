# Implementación: Validación de Cobertura y Régimen "insufficient_data"

**Fecha:** 2025-12-17  
**Objetivo:** Evitar señales falsas cuando no hay datos suficientes para calcular regímenes macro por moneda

---

## ✅ Implementación Completada

### 1. Tipo de Régimen Extendido

**Archivo:** `domain/diagnostic.ts`

```typescript
export type MacroRegime =
  | 'reflation'
  | 'stagflation'
  | 'recession'
  | 'goldilocks'
  | 'mixed'
  | 'insufficient_data' // ← NUEVO
```

### 2. RegimeResult Extendido

```typescript
export interface RegimeResult {
  regime: MacroRegime
  probability: number
  description: string
  coverage?: number      // ← NUEVO: 0..1
  missingKeys?: string[] // ← NUEVO: indicadores faltantes
  presentKeys?: string[]  // ← NUEVO: indicadores presentes
}
```

### 3. Función de Validación de Cobertura

**Función:** `calcCurrencyRegimeWithCoverage()`

**Lógica:**
- Calcula cobertura basada en indicadores requeridos vs presentes
- **Gate de cobertura:**
  - `MIN_COVERAGE = 0.3` (30%)
  - `MIN_PRESENT = 3` (mínimo 3 indicadores)
- Si cobertura < umbral → devuelve `insufficient_data`
- Si cobertura suficiente → calcula régimen normalmente

**Ejemplo:**
```typescript
// GBP con 0% cobertura (0/11 indicadores)
{
  regime: 'insufficient_data',
  probability: 0,
  description: 'Sin datos suficientes (0% cobertura, 0/11 indicadores)',
  coverage: 0,
  missingKeys: ['uk_gdp_qoq', 'uk_gdp_yoy', 'uk_cpi_yoy', ...],
  presentKeys: []
}
```

### 4. Cálculo de Cobertura

**Función:** `buildCurrencyFeaturePack()`

**Proceso:**
1. Obtiene indicadores requeridos para la moneda desde `currency-indicators.json`
2. Mapea `series_id` → `key` interno usando `MAP_KEY_TO_WEIGHT_KEY`
3. Verifica qué indicadores tienen datos válidos (no null/undefined/NaN)
4. Calcula: `coverage = present.length / required.length`

### 5. Actualización de QA Script

**Archivo:** `scripts/validate-dashboard-qa.ts`

**Cambios:**
- `insufficient_data` con cobertura baja **NO es error** (es esperado)
- Valida que monedas con cobertura < 30% tengan `insufficient_data`
- Muestra warnings si hay inconsistencia (cobertura alta pero `insufficient_data`)

---

## 📊 Resultado Actual

### Estado por Moneda (después de implementación)

| Moneda | Régimen | Cobertura | Estado |
|--------|---------|-----------|--------|
| **USD** | goldilocks | ~53% | ✅ Con datos |
| **EUR** | goldilocks | ~54% | ✅ Con datos |
| **GBP** | insufficient_data | 0% | ✅ Correcto (sin datos) |
| **JPY** | insufficient_data | 0% | ✅ Correcto (sin datos) |
| **AUD** | insufficient_data | 0% | ✅ Correcto (sin mapeo) |

### QA Script

**Antes:**
- ❌ Errores: 1 (regímenes clonados)
- ⚠️ Advertencias: 36

**Después:**
- ✅ Errores: 0
- ⚠️ Advertencias: 10 (solo drivers faltantes, no crítico)

---

## 🎯 Beneficios

### 1. Transparencia
- El dashboard muestra claramente qué monedas tienen datos y cuáles no
- No hay "mixed" falsos por falta de datos

### 2. Evita Señales Falsas
- Los tactical drivers no se basan en regímenes inventados
- El sistema es "honesto" sobre qué puede calcular y qué no

### 3. Preparado para Futuro
- Cuando se implemente ingesta UK/JP (Opción A), el sistema automáticamente cambiará de `insufficient_data` a régimen real
- No requiere cambios en la lógica de cálculo

### 4. Guardrail Permanente
- Esta validación sirve siempre, incluso cuando todas las monedas tengan datos
- Detecta automáticamente si alguna moneda pierde cobertura (ej: fallo de ingesta)

---

## 🔄 Próximos Pasos (Opción A)

### Para Implementar Ingesta UK/JP con Fuentes Oficiales

1. **UK (GBP):**
   - ONS (Office for National Statistics) - API oficial
   - BoE (Bank of England) - API oficial
   - Similar a implementación EUR (Eurostat/ECB)

2. **JP (JPY):**
   - Cabinet Office / Ministry of Finance
   - BoJ (Bank of Japan) - API oficial
   - Similar a implementación EUR

3. **AUD:**
   - RBA (Reserve Bank of Australia)
   - ABS (Australian Bureau of Statistics)

**Cuando se implemente:**
- Los jobs insertarán datos en BD
- La cobertura subirá automáticamente
- El sistema cambiará de `insufficient_data` a régimen real
- **No requiere cambios en la lógica de validación** (ya está implementada)

---

## 📝 Notas Técnicas

### Umbrales Configurables

```typescript
const MIN_COVERAGE = 0.3  // 30% mínimo
const MIN_PRESENT = 3      // Mínimo 3 indicadores
```

**Razón:**
- `MIN_COVERAGE`: Evita que 1 indicador de 10 pase el filtro
- `MIN_PRESENT`: Evita señales sueltas (ej: solo CPI sin GDP/Employment)

### Mapeo de Indicadores

La función `buildCurrencyFeaturePack` usa:
- `CURRENCY_INDICATORS` (de `currency-indicators.json`) para obtener `series_id` requeridos
- `MAP_KEY_TO_WEIGHT_KEY` para convertir `series_id` → `key` interno
- `items` (del diagnóstico) para verificar qué keys tienen datos

---

## ✅ Checklist de Validación

- [x] Tipo `MacroRegime` incluye `insufficient_data`
- [x] `RegimeResult` incluye `coverage`, `missingKeys`, `presentKeys`
- [x] Función `calcCurrencyRegimeWithCoverage` implementada
- [x] Función `buildCurrencyFeaturePack` implementada
- [x] Gate de cobertura activo (MIN_COVERAGE, MIN_PRESENT)
- [x] `getRegimeLabel` actualizado para `insufficient_data`
- [x] QA script actualizado (no marca como error si es esperado)
- [x] Build compila correctamente
- [x] QA pasa (0 errores)

---

## 🎨 UI (Pendiente)

**Recomendación para frontend:**

```tsx
{regime.regime === 'insufficient_data' ? (
  <Badge variant="secondary">
    Sin datos suficientes
    <Tooltip>
      Cobertura: {(regime.coverage * 100).toFixed(0)}%
      {regime.missingKeys && regime.missingKeys.length > 0 && (
        <div>
          Faltan: {regime.missingKeys.slice(0, 5).join(', ')}
          {regime.missingKeys.length > 5 && ` (+${regime.missingKeys.length - 5} más)`}
        </div>
      )}
    </Tooltip>
  </Badge>
) : (
  <Badge>{getRegimeLabel(regime.regime)}</Badge>
)}
```

---

## 📊 Ejemplo de Output

**GBP (sin datos):**
```json
{
  "regime": "insufficient_data",
  "probability": 0,
  "description": "Sin datos suficientes (0% cobertura, 0/11 indicadores)",
  "coverage": 0,
  "missingKeys": ["uk_gdp_qoq", "uk_gdp_yoy", "uk_cpi_yoy", "uk_core_cpi_yoy", "uk_ppi_output_yoy", "uk_unemployment_rate", "uk_avg_earnings_yoy", "uk_services_pmi"],
  "presentKeys": []
}
```

**USD (con datos):**
```json
{
  "regime": "goldilocks",
  "probability": 0.65,
  "description": "Goldilocks (crecimiento sólido con desinflación)",
  "coverage": 0.526,
  "missingKeys": ["nfib", "rsxfs", "uspmi_services"],
  "presentKeys": ["cpi_yoy", "corecpi_yoy", "payems", "unrate", "fedfunds", "t10y2y", "uspmi", "houst"]
}
```

---

## 🔍 Debug

Para ver cobertura en detalle:

```bash
DEBUG_CURRENCY_REGIMES=true pnpm validate:qa
```

Esto mostrará logs de cobertura por moneda en consola.
