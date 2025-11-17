# 📊 Dashboard Macroeconómico — Manual de uso e interpretación

## 1. Propósito

Este dashboard consolida los principales indicadores macroeconómicos de EE. UU. y activos globales para ofrecer un diagnóstico automático del régimen económico (Hawkish, Dovish o Neutral).

Los datos se obtienen automáticamente desde FRED (Federal Reserve), Binance, Stooq, y otras fuentes públicas gratuitas, actualizándose cada pocas horas.

## 2. Flujo de actualización

- El sistema consulta FRED y mercados cada 3 h, y almacena los datos más recientes.
- Cada indicador tiene su última fecha y su próxima publicación estimada.
- Las correlaciones con el USD amplio (DXY proxy) se recalculan mensualmente.

## 3. Estructura del dashboard

### Encabezado

- **Régimen general**: muestra si el entorno es Hawkish (restrictivo), Dovish (expansivo) o Neutral.
- **Score**: resultado ponderado de todos los indicadores activos (según sus pesos).
- **Umbral**: valor mínimo para cambiar de régimen.
- **Actualizado / Revalida**: indica fecha de última sincronización y cuándo se actualizará de nuevo.

### Secciones

Los indicadores están agrupados por categorías:

- **Financieros / Curva**: mide expectativas de política monetaria y liquidez.
- **Crecimiento / Actividad**: mide ritmo de expansión o desaceleración económica.
- **Mercado Laboral**: refleja tensión o debilidad del empleo.
- **Precios / Inflación**: mide presiones inflacionarias.
- **Vivienda**: mide el estado del sector inmobiliario.
- **Encuestas / Sentimiento**: evalúa la confianza y perspectivas de consumidores y empresas.
- **Otros / Divisas**: activos financieros globales y su relación con el USD.

## 4. Interpretación de posturas

Cada indicador adopta una postura según su nivel:

| Postura | Significado | Implicación en mercado |
|---|---|---|
| **Hawkish** | Datos fuertes / inflación alta / empleo ajustado | Fed más restrictiva, USD tiende a apreciarse, riesgo presiona a la baja |
| **Neutral** | Sin sesgo claro o en equilibrio | Consolidación o trading táctico |
| **Dovish** | Datos débiles / inflación baja / desempleo sube | Política expansiva, USD tiende a debilitarse, activos de riesgo favorecidos |

## 5. Correlaciones con USD amplio

- Se calculan mensualmente y a 12 m y 24 m.
- **Positivas**: activo sube cuando el USD sube (ej. USDJPY, USDCAD).
- **Negativas**: activo cae cuando el USD sube (ej. EURUSD, XAUUSD).
- Una correlación fuerte (|r| ≥ 0.5) se resalta como “12m fuerte”.

## 6. Tabla “Sesgo por par”

Resume la acción recomendada según el régimen general y el sesgo del USD:

| Sesgo macro | Acción recomendada |
|---|---|
| USD fuerte / Hawkish | Buscar ventas en activos de riesgo o pares anti-USD |
| USD débil / Dovish | Buscar compras en activos de riesgo o pares anti-USD |
| USD neutral | Operar rango o estrategias tácticas |

## 7. Principales indicadores (resumen interpretativo)

### 🧭 Financieros / Curva
- 10Y–2Y / 10Y–3M: pendiente de la curva de tipos. Negativa = riesgo de recesión.
- NFCI: condiciones financieras. Valores > 0 implican tensión.
- Breakeven 5Y: expectativas de inflación a 5 años.
- Broad USD (DXY): fuerza del dólar frente a principales divisas.

### ⚙️ Crecimiento / Actividad
- GDP YoY: crecimiento real de la economía.
- Leading Index (LEI): indicador adelantado del ciclo económico.
- Retail Sales YoY: consumo interno, motor del crecimiento.
- Industrial Production YoY: actividad manufacturera.
- Capacity Utilization: uso de la capacidad productiva.
- Durable Goods Orders YoY: inversión empresarial.
- Construction YoY: ritmo de gasto en construcción.

### 👷 Mercado Laboral
- Nonfarm Payrolls (NFP): creación mensual de empleo.
- Unemployment rate: desempleo oficial (U3).
- Unemployment U6: subempleo (más amplio).
- Initial Claims 4W MA: despidos semanales.
- JOLTS Openings / Quits: tensión en el mercado laboral.

### 💸 Precios / Inflación
- CPI / Core CPI YoY: inflación al consumidor total y subyacente.
- PCE / Core PCE YoY: inflación según la Fed.
- PPI YoY: inflación a nivel de productores.

### 🏠 Vivienda
- Housing Starts YoY: inicio de nuevas viviendas.
- NAHB: confianza de los constructores.

### 💬 Encuestas / Sentimiento
- U. Michigan Sentiment: confianza del consumidor.
- NFIB Small Business Optimism: confianza de las pymes.
- Consumer Confidence (Conference Board): expectativas del consumidor.

### 🌎 Otros / Externo
- SPX, NDX: correlación con USD, sentimiento de riesgo.
- BTCUSDT, XAUUSD: activos alternativos con sensibilidad inversa al dólar.

## 8. Interpretación práctica para trading

- **USD Hawkish / fuerte**: favorece USDJPY, USDCAD; presiona oro, cripto y SPX.
- **USD Dovish / débil**: impulsa EURUSD, GBPUSD, AUDUSD, oro, cripto.
- **Régimen Neutral**: prioriza estrategias de rango o momentum táctico.

## 9. Fuentes de datos

- **FRED** (Federal Reserve Economic Data) — indicadores macro oficiales.
- **Stooq / Binance** — precios mensuales de activos y correlaciones.
- **Cálculo interno**: derivadas YoY, promedios móviles, z-scores.

## 10. Mantenimiento

- Edita `config/weights.json` para cambiar pesos.
- Añade nuevos indicadores en `lib/fred.ts`.
- Revisa logs de `/api/ping-fred` si algún dato no carga.

## 11. Última revisión

- **Fecha**: 2025-11-06
- **Versión**: v1.0

---

Objetivo final: ofrecer una visión automática, transparente y operativa del ciclo macroeconómico y su impacto en el USD y activos globales.


