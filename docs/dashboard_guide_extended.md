# 📊 Dashboard Macroeconómico — Manual de uso e interpretación (versión educativa)

## 1. Propósito

Este dashboard consolida los principales indicadores macroeconómicos de EE. UU. y activos globales para ofrecer un diagnóstico automático del régimen económico (Hawkish, Dovish o Neutral).

Los datos se obtienen automáticamente desde FRED (Federal Reserve), Binance, Stooq, y otras fuentes públicas gratuitas, actualizándose cada pocas horas.

### 📘 Explicación simple
- Qué mide: una “fotografía” del ciclo económico y su impacto en el dólar y los activos.
- Por qué importa: ayuda a tomar decisiones de trading y gestión de riesgo con contexto macro.
- Efecto en mercado: el régimen (Hawkish/Dovish) guía sesgo en USD, renta variable, oro y cripto.
- Reacción típica: regímenes Hawkish favorecen el USD; Dovish favorecen activos de riesgo.
- Ejemplo: si el empleo se enfría y la inflación baja, suele verse USD más débil y bolsas más fuertes.

## 2. Flujo de actualización

- El sistema consulta FRED y mercados cada 3 h, y almacena los datos más recientes.
- Cada indicador tiene su última fecha y su próxima publicación estimada.
- Las correlaciones con el USD amplio (DXY proxy) se recalculan mensualmente.

### 📘 Explicación simple
- Qué mide: la “frescura” de los datos y cuándo cambian.
- Por qué importa: evita operar con información desactualizada; anticipa eventos macro.
- Efecto en mercado: publicaciones pueden generar volatilidad y gaps.
- Reacción típica: antes de NFP o CPI, el mercado reduce riesgo; después, se reprecian activos.
- Ejemplo: si mañana hay CPI, evita posiciones direccionales sin cobertura.

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

### 📘 Explicación simple
- Qué mide: un mapa por familias de indicadores.
- Por qué importa: cada grupo empuja el régimen en una dirección.
- Efecto en mercado: “Curva/Precios” afectan expectativas de Fed (USD y bonos); “Laboral/Crecimiento” mueven riesgo.
- Reacción típica: inflación al alza o curvas más empinadas apoyan USD; crecimiento débil apoya riesgo sólo si la inflación cede.
- Ejemplo: combo “inflación moderando + empleo enfriando” tiende a Dovish.

## 4. Interpretación de posturas

Cada indicador adopta una postura según su nivel:

| Postura | Significado | Implicación en mercado |
|---|---|---|
| **Hawkish** | Datos fuertes / inflación alta / empleo ajustado | Fed más restrictiva, USD tiende a apreciarse, riesgo presiona a la baja |
| **Neutral** | Sin sesgo claro o en equilibrio | Consolidación o trading táctico |
| **Dovish** | Datos débiles / inflación baja / desempleo sube | Política expansiva, USD tiende a debilitarse, activos de riesgo favorecidos |

### 📘 Explicación simple
- Qué mide: el “color” del dato respecto a umbrales operativos.
- Por qué importa: simplifica múltiples series en una señal +/-/0.
- Efecto en mercado: agrega señales para componer el score.
- Reacción típica: muchas señales Dovish → USD débil; Hawkish → USD fuerte.
- Ejemplo: PCE < 2.5% y UNRATE > 4.5% suman Dovish.

## 5. Correlaciones con USD amplio

- Se calculan mensualmente y a 12 m y 24 m.
- **Positivas**: activo sube cuando el USD sube (ej. USDJPY, USDCAD).
- **Negativas**: activo cae cuando el USD sube (ej. EURUSD, XAUUSD).
- Una correlación fuerte (|r| ≥ 0.5) se resalta como “12m fuerte”.

### 📘 Explicación simple
- Qué mide: relación histórica entre un activo y el USD.
- Por qué importa: ayuda a elegir activos coherentes con el sesgo del dólar.
- Efecto en mercado: reduce sorpresas al alinear trades con la relación dominante.
- Reacción típica: si USD se fortalece, activos con correlación negativa (EURUSD, oro) suelen caer.
- Ejemplo: correlación 12m de XAUUSD = -0.6 → dólar fuerte tiende a presionar el oro.

## 6. Tabla “Sesgo por par”

Resume la acción recomendada según el régimen general y el sesgo del USD:

| Sesgo macro | Acción recomendada |
|---|---|
| USD fuerte / Hawkish | Buscar ventas en activos de riesgo o pares anti-USD |
| USD débil / Dovish | Buscar compras en activos de riesgo o pares anti-USD |
| USD neutral | Operar rango o estrategias tácticas |

### 📘 Explicación simple
- Qué mide: una guía operativa rápida por activo/par.
- Por qué importa: acelera el paso de “diagnóstico” a “táctica de entrada/salida”.
- Efecto en mercado: prioriza oportunidades consistentes con el entorno.
- Reacción típica: con RISK ON y USD débil → preferir largos en EURUSD, SPX, BTC.
- Ejemplo: RISK OFF, USD fuerte → sesgo vendedor en EURUSD y oro.

## 7. Principales indicadores (resumen interpretativo)

### 🧭 Financieros / Curva
- 10Y–2Y / 10Y–3M: pendiente de la curva de tipos. Negativa = riesgo de recesión.
- NFCI: condiciones financieras. Valores > 0 implican tensión.
- Breakeven 5Y: expectativas de inflación a 5 años.
- Broad USD (DXY): fuerza del dólar frente a principales divisas.

#### 📘 Explicación simple
- Qué mide: expectativas de tipos, tensión financiera e inflación implícita.
- Por qué importa: anticipa política monetaria y direccionalidad del USD.
- Impacto: curvas invertidas y NFCI alto suelen ser Dovish para riesgo (pero USD puede fortalecerse si la inflación sube).
- Reacciones: breakevens al alza → presión alcista en USD si la Fed se vuelve más Hawkish.
- Ejemplo: 10Y–3M < 0 y PCE alto → riesgo de USD fuerte y bolsas bajo presión.

🧠 En resumen:
- Curva más invertida + inflación alta → USD fuerte.
- Curva normalizando + inflación cediendo → USD más débil, apoyo al riesgo.

### ⚙️ Crecimiento / Actividad
- GDP YoY, LEI, Retail Sales, INDPRO, TCU, Durables, Construction.

#### 📘 Explicación simple
- Qué mide: el pulso del ciclo (consumo, producción, inversión, obra).
- Por qué importa: crecimiento sólido sustenta beneficios y apetito por riesgo.
- Impacto: crecimiento fuerte con baja inflación → Dovish para riesgo (USD más débil).
- Reacciones: ventas minoristas fuertes suelen apoyar bolsas; LEI cayendo alerta desaceleración.
- Ejemplo: LEI < 0 y ventas débiles → mayor probabilidad de recortes de tipos.

🧠 En resumen:
- Crecimiento firme + inflación contenida → riesgo sube, USD cede.
- Señales de desaceleración → si inflación cede, apoya recortes (riesgo sube); si no, riesgo cae.

### 👷 Mercado Laboral
- NFP, U3, U6, Claims, JOLTS/Quits.

#### 📘 Explicación simple
- Qué mide: tensión del empleo (creación de puestos, desempleo, despidos, vacantes).
- Por qué importa: el empleo determina el poder de gasto y presiona salarios/inflación.
- Impacto: empleo muy fuerte puede ser Hawkish (presiones inflacionarias).
- Reacciones: NFP muy alto → USD tiende a apreciarse si inflación preocupa; claims al alza sostienen Dovish.
- Ejemplo: U6 subiendo y NFP débil → apoyo a USD débil y riesgo al alza.

🧠 En resumen:
- Enfriamiento del empleo → USD más débil, bolsas mejor.
- Sorpresas fuertes en NFP → USD tiende a subir, oro/cripto se resienten.

### 💸 Precios / Inflación
- CPI, Core CPI, PCE, Core PCE, PPI.

#### 📘 Explicación simple
- Qué mide: ritmo de subida de precios en consumo y producción.
- Por qué importa: la Fed reacciona a desviaciones sostenidas.
- Impacto: inflación alta/persistente → entorno Hawkish, USD fuerte.
- Reacciones: lectura CPI por encima del consenso → rebote del USD y caída de riesgo.
- Ejemplo: PCE por debajo de 2.5% varios meses → apoyo a USD débil.

🧠 En resumen:
- Inflación recalienta → USD fuerte, riesgo bajo presión.
- Inflación modera → USD débil, riesgo favorecido.

### 🏠 Vivienda
- Housing Starts, NAHB.

#### 📘 Explicación simple
- Qué mide: salud del sector inmobiliario y confianza de constructores.
- Por qué importa: sensible a tipos; buen termómetro de ciclo doméstico.
- Impacto: vivienda fuerte con tipos altos puede tensionar inflación de servicios.
- Reacciones: NAHB subiendo suele anticipar mejoras en actividad de vivienda.
- Ejemplo: starts al alza pese a tipos altos → economía resiliente (potencial Hawkish).

🧠 En resumen:
- Vivienda sensible a tipos: repunte con tipos altos puede prolongar restricción monetaria.

### 💬 Encuestas / Sentimiento
- U. Michigan, NFIB, Conference Board, PMI.

#### 📘 Explicación simple
- Qué mide: moral de consumidores/empresas y momentum manufacturero.
- Por qué importa: adelanta cambios en gasto e inversión.
- Impacto: encuestas fuertes + inflación contenida = apoyo a riesgo.
- Reacciones: PMI por debajo de 50 sostenido suele pesar sobre activos cíclicos.
- Ejemplo: NFIB al alza con PCE estable → buen tono de riesgo.

🧠 En resumen:
- Sentimiento mejora → si inflación no sube, favorece riesgo.

### 🌎 Otros / Externo
- SPX, NDX, BTC, XAU y su relación con USD.

#### 📘 Explicación simple
- Qué mide: cómo activos globales responden al dólar y al ciclo.
- Por qué importa: sirve para construir carteras coherentes con el régimen.
- Impacto: USD fuerte suele presionar commodities y cripto; USD débil apoya riesgo.
- Reacciones: subidas del USD suelen coincidir con caídas de oro/cripto.
- Ejemplo: USD fuerte + r<0 con XAU → sesgo vendedor en oro.

🧠 En resumen:
- Dólar y riesgo suelen moverse en direcciones opuestas (no siempre).

## 8. Interpretación práctica para trading

- **USD Hawkish / fuerte**: favorece USDJPY, USDCAD; presiona oro, cripto y SPX.
- **USD Dovish / débil**: impulsa EURUSD, GBPUSD, AUDUSD, oro, cripto.
- **Régimen Neutral**: prioriza estrategias de rango o momentum táctico.

### 📘 Explicación simple
- Lectura: empieza por régimen y USD; confirma con 2–3 indicadores clave.
- Plan: busca activos con correlación consistente al sesgo del USD.
- Gestión: define niveles/stop basados en volatilidad y calendario (próximas fechas).
- Ejemplo: cambio a Hawkish + CPI alto → reducir riesgo, buscar ventas en EURUSD/oro.

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

## 📚 Glosario
- **Hawkish**: postura restrictiva; prioriza combatir inflación (USD tiende a subir).
- **Dovish**: postura expansiva; prioriza crecimiento/empleo (USD tiende a bajar).
- **Yield Curve (Curva de tipos)**: diferencia entre rendimientos a distintos plazos; pendiente negativa sugiere desaceleración futura.
- **Core CPI**: inflación subyacente (sin alimentos/energía), más estable.
- **PMI**: encuesta a gestores de compras; >50 expansión, <50 contracción.
- **Payrolls (NFP)**: creación de empleo no agrícola mensual.
- **Breakeven**: expectativa de inflación implícita en el mercado de bonos.
- **LEI**: índice adelantado del Conference Board, resume señales de ciclo.

## 👣 Cómo usar el dashboard paso a paso
1) Lee el **Régimen** y el **USD** (Insights): define sesgo base.
2) Revisa **2–3 indicadores clave** del grupo relevante (p. ej., inflación + empleo).
3) Consulta **próximas fechas** para evitar eventos inmediatos.
4) Observa **correlaciones** con USD para elegir activos coherentes.
5) Usa **Sesgo por par** para plantear operaciones y niveles.

Ejemplo de cambio de régimen:
- Si el régimen pasa a **Hawkish** y el **USD se fortalece** → vender EURUSD y oro; reducir cripto/índices.
- Si pasa a **Dovish** → buscar compras en AUDUSD, BTCUSDT, SPX; oro favorecido.
