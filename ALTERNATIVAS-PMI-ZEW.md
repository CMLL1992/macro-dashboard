# Alternativas para PMI y ZEW de Eurozona

## 📊 Resumen de Búsqueda

### ❌ Trading Economics (Actual)
- **Estado**: HTTP 403 - API key sin acceso premium a Eurozone
- **Indicadores afectados**: 
  - EU_PMI_MANUFACTURING
  - EU_PMI_SERVICES
  - EU_PMI_COMPOSITE
  - EU_ZEW_SENTIMENT

---

## 🔍 Alternativas Encontradas

### 1. **Eurostat Business Confidence Indicators** (via DBnomics) ✅

**Ventaja**: Acceso gratuito, datos oficiales de Eurostat

#### Manufacturing Confidence Indicator
- **Dataset**: `ei_bsci_m` (Business Surveys - Manufacturing)
- **Provider**: Eurostat
- **Fuente**: DBnomics
- **Nota**: No es PMI exactamente, pero es un indicador de confianza empresarial del sector manufacturero

#### Services Confidence Indicator
- **Dataset**: `ei_bsci_s` (Business Surveys - Services)
- **Provider**: Eurostat
- **Fuente**: DBnomics
- **Nota**: No es PMI exactamente, pero es un indicador de confianza empresarial del sector servicios

#### Economic Sentiment Indicator (ESI)
- **Dataset**: `ei_bsco_m` (Business and Consumer Surveys)
- **Provider**: Eurostat
- **Fuente**: DBnomics
- **Nota**: Indicador compuesto que incluye confianza empresarial y del consumidor

**Códigos a buscar en DBnomics**:
- Manufacturing Confidence: `Eurostat/ei_bsci_m/[dimensiones]`
- Services Confidence: `Eurostat/ei_bsci_s/[dimensiones]`
- ESI: `Eurostat/ei_bsco_m/[dimensiones]`

---

### 2. **FRED - Business Confidence Indicators** ⚠️

**Ventaja**: Ya tienes integración con FRED

#### Series disponibles:
- **BSCICP03EZM665S**: Composite Leading Indicators: Composite Business Confidence (Euro Area 19)
- **BSCICP02EZM460S**: Business Tendency Surveys (Manufacturing): Confidence Indicators (Euro Area 19)

**Limitación**: No son PMI, son indicadores de confianza. No hay PMI directo de Eurozona en FRED.

---

### 3. **ZEW Economic Sentiment** 🔍

**Opciones encontradas**:

#### Opción A: MacroMicro (Descarga CSV)
- **URL**: https://en.macromicro.me/series/3667/eurozone-zew-economic-sentiment
- **Formato**: CSV descargable
- **Limitación**: No hay API pública, requiere scraping o descarga manual

#### Opción B: ZEW Official Publications
- **URL**: https://www.zew.de/en/publications/
- **Formato**: PDFs y reportes
- **Limitación**: No hay API, requiere parsing de documentos

#### Opción C: Buscar en DBnomics
- **Búsqueda**: ZEW puede estar disponible en DBnomics bajo otro provider
- **Acción**: Verificar si hay series de ZEW en DBnomics

---

### 4. **S&P Global / HCOB PMI** ❌

**Estado**: Requiere suscripción premium
- No hay acceso gratuito vía API
- Trading Economics es el intermediario más común
- Alternativa: Scraping de páginas públicas (no recomendado)

---

## 💡 Recomendaciones

### Para PMI (Manufacturing, Services, Composite):

**Opción Recomendada**: Usar **Eurostat Business Confidence Indicators** via DBnomics
- Son indicadores oficiales de la UE
- Acceso gratuito
- Similar propósito a PMI (confianza empresarial)
- Datos mensuales actualizados

**Códigos a implementar**:
1. Manufacturing Confidence: `Eurostat/ei_bsci_m/[dimensiones para EA19 o EA20]`
2. Services Confidence: `Eurostat/ei_bsci_s/[dimensiones para EA19 o EA20]`
3. Composite: Usar ESI de `ei_bsco_m` o calcular promedio de Manufacturing + Services

### Para ZEW:

**Opción Recomendada**: 
1. **Primero**: Buscar en DBnomics si hay series de ZEW
2. **Alternativa**: Implementar scraping de MacroMicro (si es legal y permitido)
3. **Última opción**: Mantener Trading Economics pero con mejor manejo de errores

---

## 📝 Próximos Pasos

1. ✅ Verificar códigos exactos de DBnomics para:
   - Manufacturing Confidence (ei_bsci_m)
   - Services Confidence (ei_bsci_s)
   - ESI o Composite (ei_bsco_m)

2. 🔍 Buscar ZEW en DBnomics

3. 🔄 Actualizar `config/european-indicators.json` con las nuevas fuentes

4. 🧪 Probar ingesta de las nuevas series

---

## 🔗 Referencias

- DBnomics: https://db.nomics.world/
- Eurostat API: https://ec.europa.eu/eurostat/web/user-guides/data-browser/api-data-access
- ZEW Publications: https://www.zew.de/en/publications/
- MacroMicro ZEW: https://en.macromicro.me/series/3667/eurozone-zew-economic-sentiment

