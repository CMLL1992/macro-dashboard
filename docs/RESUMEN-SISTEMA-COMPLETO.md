Perfecto, vamos a dejar EURGBP listo con macro relativo de verdad.
Voy a darte:
Qué indicadores usar para EUR y GBP (solo los clave para FX).
Pesos sugeridos para GBP para que el score tenga sentido.
Qué tocar en cada archivo para que EURGBP use score_EUR − score_GBP.
Un par de ejemplos de cómo debería comportarse el modelo.
1️⃣ EUR – set mínimo para macro relativo (ya lo tienes casi todo)
Para EUR ya tienes medio trabajo hecho. Para el score relativo te propongo usar SOLO los “tier 1”:
Crecimiento (EUR, group: growth)
EU_GDP_QOQ – PIB trimestral (QoQ anualizado o similar)
EU_GDP_YOY – PIB interanual
EU_PMI_COMPOSITE – PMI compuesto eurozona
EU_PMI_MANUFACTURING – PMI manufacturero
EU_PMI_SERVICES – PMI servicios
EU_INDUSTRIAL_PRODUCTION_YOY – Producción industrial YoY
EU_RETAIL_SALES_YOY – Ventas minoristas YoY
Inflación (EUR, group: inflation)
EU_CPI_CORE_YOY – Inflación subyacente YoY
EU_CPI_YOY – Inflación general YoY
Empleo (EUR, group: labor)
EU_UNEMPLOYMENT – Tasa de desempleo eurozona
👉 En config/currency-indicators.json asegúrate de que todos estos tengan:
"EU_GDP_QOQ":              { "currency": "EUR", "group": "growth" },
"EU_GDP_YOY":              { "currency": "EUR", "group": "growth" },
"EU_PMI_COMPOSITE":        { "currency": "EUR", "group": "growth" },
"EU_PMI_MANUFACTURING":    { "currency": "EUR", "group": "growth" },
"EU_PMI_SERVICES":         { "currency": "EUR", "group": "growth" },
"EU_INDUSTRIAL_PRODUCTION_YOY": { "currency": "EUR", "group": "growth" },
"EU_RETAIL_SALES_YOY":     { "currency": "EUR", "group": "growth" },

"EU_CPI_CORE_YOY":         { "currency": "EUR", "group": "inflation" },
"EU_CPI_YOY":              { "currency": "EUR", "group": "inflation" },

"EU_UNEMPLOYMENT":         { "currency": "EUR", "group": "labor" }
Los pesos para EUR ya los tienes en weights.json y están bien; no necesitas cambiarlos para EURGBP.
2️⃣ GBP – set macro y pesos recomendados
2.1. Claves internas que usaría
Crecimiento (GBP, group: growth)
UK_GDP_QOQ – PIB trimestral (QoQ)
UK_GDP_YOY – PIB interanual
UK_SERVICES_PMI – PMI servicios
UK_MANUFACTURING_PMI – PMI manufacturero
UK_RETAIL_SALES_YOY – Ventas minoristas YoY
Inflación (GBP, group: inflation)
UK_CPI_YOY – Inflación general YoY
UK_CORE_CPI_YOY – Inflación subyacente YoY
UK_PPI_OUTPUT_YOY – PPI output YoY (opcional, peso pequeño)
Empleo (GBP, group: labor)
UK_UNEMPLOYMENT_RATE – Tasa de desempleo
UK_AVG_EARNINGS_YOY – Salarios medios (Total Pay YoY)
Política monetaria (GBP, group: inflation o policy)
UK_BOE_RATE – Bank Rate del BoE
2.2. Añadir al mapeo de divisa
En config/currency-indicators.json:
"UK_GDP_QOQ":              { "currency": "GBP", "group": "growth" },
"UK_GDP_YOY":              { "currency": "GBP", "group": "growth" },
"UK_SERVICES_PMI":         { "currency": "GBP", "group": "growth" },
"UK_MANUFACTURING_PMI":    { "currency": "GBP", "group": "growth" },
"UK_RETAIL_SALES_YOY":     { "currency": "GBP", "group": "growth" },

"UK_CPI_YOY":              { "currency": "GBP", "group": "inflation" },
"UK_CORE_CPI_YOY":         { "currency": "GBP", "group": "inflation" },
"UK_PPI_OUTPUT_YOY":       { "currency": "GBP", "group": "inflation" },

"UK_UNEMPLOYMENT_RATE":    { "currency": "GBP", "group": "labor" },
"UK_AVG_EARNINGS_YOY":     { "currency": "GBP", "group": "labor" },

"UK_BOE_RATE":             { "currency": "GBP", "group": "inflation" } 
// (la metemos en inflation porque subidas BoE = presión inflacionaria/hawkish)
2.3. Pesos sugeridos en weights.json (bloque GBP)
Te dejo una propuesta que suma ~1 para el bloque GBP:
{
  // CRECIMIENTO (0.26)
  "UK_GDP_QOQ":              0.08,
  "UK_GDP_YOY":              0.04,
  "UK_SERVICES_PMI":         0.06,
  "UK_MANUFACTURING_PMI":    0.04,
  "UK_RETAIL_SALES_YOY":     0.04,

  // INFLACIÓN (0.26)
  "UK_CPI_YOY":              0.10,
  "UK_CORE_CPI_YOY":         0.12,
  "UK_PPI_OUTPUT_YOY":       0.04,

  // EMPLEO (0.16)
  "UK_UNEMPLOYMENT_RATE":    0.08,
  "UK_AVG_EARNINGS_YOY":     0.08,

  // POLÍTICA (0.32)
  "UK_BOE_RATE":             0.32
}
Idea detrás:
Mucho peso a:
Core CPI, CPI, BoE Rate, GDP QoQ, PMI servicios, paro y salarios.
Menos peso a:
GDP YoY, PPI, PMI manufacturas, Retail.
Si más adelante ves que el BoE “domina demasiado” el score, le bajas a ~0.25 y repartes lo que sobra a inflación/crecimiento.
3️⃣ Archivos que tienes que tocar (checklist rápido)
lib/sources.ts
Añadir metadata de cada UK_* (título, país GB, frecuencia, sourceId de FRED/TE/Econdify).
Añadirlos al objeto de series de la API que uses (Trading Economics / FRED equivalente para UK).
Jobs de ingesta
Donde ahora traes datos de UK (si aún no los tienes, ampliar job TE para incluir Reino Unido):
CPI, Core CPI, GDP, PMI, Retail, Unemployment, Earnings, BoE Rate.
Confirmar que macro_observations se empieza a llenar con UK_*.
config/currency-indicators.json
Añadir los bloques EUR (si faltaba alguno) y todos los GBP como arriba.
config/weights.json
Pegar el bloque de pesos GBP.
(Opcional) Regímenes
En donde calculas régimen, puedes añadir:
const gbpRegime = getRegime(currencyScores.GBP.growthScore, currencyScores.GBP.inflationScore);
Y si quieres mostrarlo en el dashboard igual que USD/EUR.
Con esto, computeCurrencyScores empezará a generar un CurrencyScore.GBP totalmente operativo.
4️⃣ ¿Qué debe hacer ahora el modelo con EURGBP?
Tu función de par ya hace:
pairScore = score_EUR - score_GBP;
Con los thresholds que ya usas (ejemplo):
pairScore > 0.30 → EURGBP: Buscar compras (EUR macro > GBP macro)
pairScore < -0.30 → EURGBP: Buscar ventas (GBP macro > EUR macro)
En medio → Rango/táctico
Ejemplos de sanity-check
Euro débil, UK fuerte
EUR: crecimiento flojo, inflación bajando, BCE dovish.
GBP: PMI servicios sólido, inflación alta, BoE todavía hawkish.
→ score_EUR < score_GBP → pairScore negativo →
✅ Modelo: EURGBP = Buscar ventas (tú buscas shorts en EURGBP).
Euro fuerte, UK floja
EUR: PMI mejora, inflación pegajosa, BCE hawkish.
GBP: datos mixtos, BoE más dovish, inflación cayendo rápido.
→ score_EUR > score_GBP → pairScore positivo →
✅ Modelo: EURGBP = Buscar compras.
Si ves algo distinto a esto, es tema de pesos/ingesta, pero la lógica está bien.
Si implementas estos puntos, EURGBP quedará completamente soportado por el macro relativo, igual que ahora tienes EURUSD vs USD, pero comparando EUR vs GBP.
