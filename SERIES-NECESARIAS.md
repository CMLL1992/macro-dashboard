# Series Necesarias para Indicadores Europeos

## 📊 Resultados del Job de Ingesta

**Ingeridos correctamente:** 3 indicadores
**Errores:** 8 indicadores

---

## 🔴 Series que Necesito (por fuente)

### 🔵 ECB (European Central Bank)

**URL Base:** https://data.ecb.europa.eu/

**Necesito los códigos exactos para:**

1. **EU_GDP_QOQ** (PIB Eurozona QoQ)
   - Flow: `MNA` (o el correcto)
   - Key: Código exacto para GDP trimestral de Eurozona
   - **Buscar en:** https://data.ecb.europa.eu/
   - **Buscar:** "GDP" o "Gross Domestic Product" para Eurozone (EA19)
   - **Formato esperado:** `Q.Y.I8.W2.S1.S1.B.B1GQ._Z._Z._Z.EUR.LR.N` (actual, puede estar mal)

2. **EU_GDP_YOY** (PIB Eurozona YoY)
   - Flow: `MNA` (o el correcto)
   - Key: Código exacto para GDP anual de Eurozona
   - **Nota:** Puede ser el mismo que QoQ si se calcula YoY desde trimestral
   - **Formato esperado:** `Q.Y.I8.W2.S1.S1.B.B1GQ._Z._Z._Z.EUR.LR.N` (actual, puede estar mal)

3. **EU_UNEMPLOYMENT** (Tasa de Desempleo Eurozona)
   - Flow: `LFSI` (ya corregido según tus indicaciones)
   - Key: `M.I8.S.UNEHRT.TOTAL0.15_74.T` (ya corregido)
   - **Estado:** Código ya corregido, pero falla con "fetch failed"
   - **Necesito:** Verificar si el código es correcto o si hay otro problema

4. **EU_ECB_RATE** (Tasa de Interés BCE)
   - Flow: `FM` (ya corregido)
   - Key: `M.U2.EUR.4F.KR.MRR_FR.LEV` (ya corregido)
   - **Estado:** Código ya corregido, pero falla con "fetch failed"
   - **Necesito:** Verificar si el código es correcto o si hay otro problema

**Cómo buscar en ECB:**
1. Ir a: https://data.ecb.europa.eu/
2. Buscar la serie específica (GDP, Unemployment, Interest Rate)
3. Copiar el código exacto del "key" y el "flow"
4. Formato: `Flow: XXX, Key: YYY.YYY.YYY...`

---

### 🟡 DBnomics (Eurostat)

**URL Base:** https://db.nomics.world/

**Necesito los códigos exactos para:**

1. **EU_RETAIL_SALES_YOY** (Ventas Minoristas Eurozona YoY)
   - Provider: `Eurostat`
   - Dataset: `sts_trtu_m` (o el correcto)
   - Series: Código exacto para retail trade YoY de Eurozone
   - **Error actual:** 404 con `M.CAL_ADJ.SA.TRTU.TOT.NS.0000.EA19`
   - **Buscar en:** https://db.nomics.world/
   - **Buscar:** "Eurostat" → "Retail Trade" → Eurozone (EA19 o EA20)
   - **Formato esperado:** `Eurostat/sts_trtu_m/CODIGO_EXACTO`

2. **EU_INDUSTRIAL_PRODUCTION_YOY** (Producción Industrial Eurozona YoY)
   - Provider: `Eurostat`
   - Dataset: `sts_inpr_m` (o el correcto)
   - Series: Código exacto para industrial production YoY de Eurozone
   - **Error actual:** 404 con `M.CAL_ADJ.SA.INPR.TOT.NS.0000.EA19`
   - **Buscar en:** https://db.nomics.world/
   - **Buscar:** "Eurostat" → "Industrial Production" → Eurozone (EA19 o EA20)
   - **Formato esperado:** `Eurostat/sts_inpr_m/CODIGO_EXACTO`

3. **EU_CONSUMER_CONFIDENCE** (Confianza del Consumidor Eurozona)
   - Provider: `Eurostat`
   - Dataset: `ei_bsco_m` (o el correcto)
   - Series: Código exacto para consumer confidence de Eurozone
   - **Error actual:** 404 con `M.BAL.M.NSA.EC.ECI.EA19`
   - **Buscar en:** https://db.nomics.world/
   - **Buscar:** "Eurostat" → "Consumer Confidence" → Eurozone (EA19 o EA20)
   - **Formato esperado:** `Eurostat/ei_bsco_m/CODIGO_EXACTO`

**Cómo buscar en DBnomics:**
1. Ir a: https://db.nomics.world/
2. Buscar "Eurostat"
3. Buscar el dataset específico (sts_trtu_m, sts_inpr_m, ei_bsco_m)
4. Encontrar la serie exacta para Eurozone (EA19 o EA20)
5. Copiar el código completo: `provider/dataset/series`

---

### 🟠 Trading Economics

**URL Base:** https://tradingeconomics.com/

**Necesito:**
1. **API Key** (si no la tienes, los indicadores PMI y ZEW no funcionarán)
2. **Verificar IDs de series** (aunque estos parecen correctos)

**Indicadores afectados:**
- EU_PMI_MANUFACTURING: `eurozone-pmi-manufacturing`
- EU_PMI_SERVICES: `eurozone-pmi-services`
- EU_PMI_COMPOSITE: `eurozone-pmi-composite`
- EU_ZEW_SENTIMENT: `eurozone-zew-economic-sentiment`

**Si no tienes API key:**
- Puedes obtenerla en: https://tradingeconomics.com/api
- O podemos buscar alternativas (DBnomics, ECB, etc.)

---

## 📝 Formato para Enviar los Códigos

Por favor, envía los códigos en este formato:

### Para ECB:
```
EU_GDP_QOQ:
  Flow: MNA
  Key: Q.Y.I8.W2.S1.S1.B.B1GQ._Z._Z._Z.EUR.LR.N

EU_UNEMPLOYMENT:
  Flow: LFSI
  Key: M.I8.S.UNEHRT.TOTAL0.15_74.T
```

### Para DBnomics:
```
EU_RETAIL_SALES_YOY:
  Provider: Eurostat
  Dataset: sts_trtu_m
  Series: M.CAL_ADJ.SA.TRTU.TOT.NS.0000.EA19

EU_INDUSTRIAL_PRODUCTION_YOY:
  Provider: Eurostat
  Dataset: sts_inpr_m
  Series: M.CAL_ADJ.SA.INPR.TOT.NS.0000.EA19
```

---

## 🎯 Prioridad

1. **Alta:** ECB (GDP, Unemployment, ECB Rate) - son los más importantes
2. **Media:** DBnomics (Retail, Industrial, Consumer Confidence)
3. **Baja:** Trading Economics (PMI, ZEW) - requiere API key

---

**Una vez que me envíes los códigos, los actualizaré en `config/european-indicators.json` y volveré a ejecutar el job.**

