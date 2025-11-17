# Series FRED utilizadas (IDs)

- Curvas:
  - T10Y2Y — Treasury 10Y minus 2Y (diaria)
  - T10Y3M — Treasury 10Y minus 3M (diaria)
  - T5YIE — 5-Year Breakeven Inflation Rate (mensual)
  - NFCI — Chicago Fed National Financial Conditions Index (semanal/mensual)
- Dólar amplio:
  - DTWEXBGS — Trade Weighted U.S. Dollar Index: Broad (mensual)
- Crecimiento/actividad:
  - GDPC1 — Real Gross Domestic Product (trimestral)
  - RSXFS — Retail and Food Services Sales ex Autos (mensual)
  - INDPRO — Industrial Production Index (mensual)
  - DGEXFI — New Orders Durable Goods ex-Defense & Aircraft (mensual)
  - TTLCONS — Total Construction Spending (mensual)
  - TCU — Capacity Utilization (mensual)
- Mercado laboral:
  - PAYEMS — Total Nonfarm Payrolls (mensual)
  - UNRATE — Unemployment Rate (mensual)
  - ICSA — Initial Claims (semanal; se usa media 4w)
  - JTSJOL — Job Openings: Total (mensual; usamos YoY%)
- Precios/inflación:
  - PCEPI — PCE Price Index (mensual)
  - PCEPILFE — Core PCE (mensual)
  - CPIAUCSL — CPI (mensual)
  - CPILFESL — Core CPI (mensual)
  - PPIACO — PPI (mensual)
- Encuestas y confianza:
  - UMCSENT — University of Michigan Sentiment (mensual)
  - NFIBBUSI — NFIB Small Business Optimism Index (mensual) [fallback: NFIBSL]
  - CONCCONF — Conference Board Consumer Confidence (mensual) [si no disponible, pendiente]
  - USPMI — S&P Global US Manufacturing PMI (mensual) [si no disponible, pendiente]
- Vivienda:
  - HOUST — Housing Starts (mensual)
  - NAHB — Housing Market Index (mensual)

Notas:
- Si alguna serie no estuviera disponible en FRED, el indicador queda "pendiente" y postura Neutral.
- Frecuencias usadas: GDPC1 (q), ICSA (d para fetch pero se calcula MA4w), curvas (d), resto (m).

