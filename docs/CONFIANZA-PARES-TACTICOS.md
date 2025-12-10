# 🎯 Cómo funciona la Confianza en la Tabla de Pares Tácticos

## 📋 Resumen Ejecutivo

La **confianza** en la tabla de pares tácticos indica qué tan **fiable es el sesgo operativo** (Long/Short/Neutral) para cada par. Se calcula combinando **3 factores**:

1. **Confianza base** (del score macro global)
2. **Fuerza de correlación** con USD (DXY) a 12 meses
3. **Sorpresas macro recientes** (eventos inesperados)

---

## 🔢 Cálculo Paso a Paso

### **Paso 1: Confianza Base** (`confidenceFrom`)

Se calcula a partir del **score macro global** (valor entre -1 y +1) y el **sesgo del USD**:

```typescript
function confidenceFrom(score: number, threshold = 0.3, usd: 'Fuerte' | 'Débil' | 'Neutral'): Confidence {
  const dist = Math.abs(score)  // Distancia absoluta del score
  
  // Alta: score muy claro (|score| >= 0.50)
  if (dist >= 0.50) return 'Alta'
  
  // Media o Alta: score moderado (0.30 <= |score| < 0.50)
  // - Alta si el sesgo USD es muy claro (Fuerte/Débil)
  // - Media si el sesgo USD es débil/neutro
  if (dist >= 0.30) {
    return (usd === 'Fuerte' || usd === 'Débil') ? 'Alta' : 'Media'
  }
  
  // Baja: score débil (|score| < 0.30)
  return 'Baja'
}
```

**Rangos claros sin solapes:**
- **Alta**: |score| >= 0.50
- **Media/Alta**: 0.30 <= |score| < 0.50 (depende del sesgo USD)
- **Baja**: |score| < 0.30

**Ejemplos:**
- Score = `0.55`, USD = `Fuerte` → **Alta** (0.55 >= 0.50)
- Score = `0.40`, USD = `Fuerte` → **Alta** (0.40 está en rango medio y USD es Fuerte)
- Score = `0.40`, USD = `Neutral` → **Media** (0.40 está en rango medio pero USD es Neutral)
- Score = `0.25`, USD = `Fuerte` → **Baja** (0.25 < 0.30)

---

### **Paso 2: Confianza Avanzada** (`confidenceAdvanced`)

Combina la confianza base con factores adicionales usando un **sistema de puntuación**:

```typescript
function confidenceAdvanced(
  base: 'Alta' | 'Media' | 'Baja',
  corr12: number | null,           // Correlación 12 meses con DXY
  recentSurprise?: 'pos' | 'neg' | 'none'  // Sorpresa macro reciente
): 'Alta' | 'Media' | 'Baja' {
  
  // Puntuación inicial según confianza base
  let score = base === 'Alta' ? 2 : base === 'Media' ? 1 : 0
  
  // +1 punto si correlación fuerte con USD (|ρ| >= 0.5)
  const c = corr12 ?? 0
  if (Math.abs(c) >= 0.5) score += 1
  
  // +1 punto si hay sorpresa macro reciente (Hawkish o Dovish)
  if (recentSurprise && recentSurprise !== 'none') score += 1
  
  // Clasificación final
  if (score >= 3) return 'Alta'
  if (score >= 1) return 'Media'
  return 'Baja'
}
```

**Sistema de Puntuación:**

| Factor | Puntos |
|--------|--------|
| Confianza base **Alta** | +2 |
| Confianza base **Media** | +1 |
| Confianza base **Baja** | +0 |
| Correlación fuerte (|ρ| ≥ 0.5) | +1 |
| Sorpresas grandes alineadas (≥1) | +1 |
| Sorpresas grandes alineadas (≥2) | +2 |

**Resultado Final:**
- **Alta**: score ≥ 3 puntos
- **Media**: score 1-2 puntos
- **Baja**: score = 0 puntos (base Baja sin correlación fuerte ni sorpresas)

**Nota sobre sorpresas grandes:**
- Se consideran "grandes" los indicadores: CPI, Core CPI, PCE, Core PCE, NFP, PMI Manufacturing
- Solo se cuentan si están **alineadas** con el sesgo del USD (Hawkish si USD es Fuerte, Dovish si USD es Débil)
- Si hay 2 o más sorpresas grandes alineadas, se otorgan 2 puntos en lugar de 1

---

## 📊 Ejemplos Prácticos

### **Ejemplo 1: Alta Confianza** ✅

**EUR/USD:**
- Score macro: `0.55` → Confianza base: **Alta** (2 puntos)
- Correlación 12m: `-0.68` → Correlación fuerte (1 punto)
- Sorpresas grandes alineadas: `2` (CPI y NFP Hawkish) → 2 puntos
- **Total: 5 puntos** → **Confianza: Alta** 🟢

**Interpretación:** El sesgo macro es muy claro, el par tiene alta correlación con USD, y hay múltiples eventos macro grandes que confirman la dirección. **Mayor probabilidad de éxito.**

---

### **Ejemplo 2: Media Confianza** ⚠️

**GBP/USD:**
- Score macro: `0.40`, USD = `Fuerte` → Confianza base: **Alta** (2 puntos)
- Correlación 12m: `0.35` → Correlación débil (0 puntos)
- Sorpresas grandes alineadas: `0` → Sin sorpresas grandes (0 puntos)
- **Total: 2 puntos** → **Confianza: Media** 🟡

**Interpretación:** El sesgo macro es claro, pero la correlación con USD es débil y no hay eventos macro grandes recientes que lo confirmen. **Sesgo presente pero con menos fuerza.**

---

### **Ejemplo 3: Baja Confianza** 🔴

**USD/JPY:**
- Score macro: `0.25` → Confianza base: **Baja** (0 puntos, porque 0.25 < 0.30)
- Correlación 12m: `0.20` → Correlación débil (0 puntos)
- Sorpresa macro: `none` → Sin sorpresas (0 puntos)
- **Total: 0 puntos** → **Confianza: Baja** 🔴

**Interpretación:** El sesgo macro es débil, la correlación es baja, y no hay confirmaciones recientes. **Evitar operar o esperar señales más claras.**

---

### **Ejemplo 4: Media Confianza (caso límite)** ⚠️

**AUD/USD:**
- Score macro: `0.35`, USD = `Neutral` → Confianza base: **Media** (1 punto)
- Correlación 12m: `0.45` → Correlación débil (0 puntos, porque |0.45| < 0.5)
- Sorpresas grandes alineadas: `1` (PCE Hawkish) → 1 punto
- **Total: 2 puntos** → **Confianza: Media** 🟡

**Interpretación:** El sesgo macro es moderado con una sorpresa grande, pero sin correlación fuerte. **Esperar más confirmación técnica antes de operar.**

---

### **Ejemplo 5: Alta Confianza con múltiples sorpresas** ✅

**USD/JPY:**
- Score macro: `0.45`, USD = `Fuerte` → Confianza base: **Alta** (2 puntos)
- Correlación 12m: `0.60` → Correlación fuerte (1 punto)
- Sorpresas grandes alineadas: `3` (CPI, Core PCE, NFP todos Hawkish) → 2 puntos (máximo)
- **Total: 5 puntos** → **Confianza: Alta** 🟢

**Interpretación:** Sesgo macro muy claro con múltiples confirmaciones (correlación fuerte + múltiples sorpresas grandes). **Máxima probabilidad de éxito.**

---

## 🔍 Factores Detallados

### **1. Correlación Fuerte con USD (DXY)**

La correlación mide qué tan relacionado está el movimiento del par con el dólar estadounidense:

- **Correlación positiva fuerte** (ρ ≥ 0.5): El par se mueve en la **misma dirección** que el USD
  - Ejemplo: USD/JPY con ρ = 0.65 → Cuando USD sube, USD/JPY también sube
  
- **Correlación negativa fuerte** (ρ ≤ -0.5): El par se mueve en **dirección opuesta** al USD
  - Ejemplo: EUR/USD con ρ = -0.68 → Cuando USD sube, EUR/USD baja

**Por qué aumenta la confianza:**
- Si el sesgo macro es alcista para USD y el par tiene alta correlación negativa con USD, entonces el sesgo bajista del par es más confiable.
- Si el par tiene baja correlación, el sesgo macro puede no traducirse bien al movimiento del par.

---

### **2. Sorpresas Macro Grandes Alineadas**

Se detectan sorpresas contando los **indicadores grandes** que están alineados con el sesgo del USD:

**Indicadores considerados "grandes":**
- **CPI** (CPIAUCSL)
- **Core CPI** (CPILFESL)
- **PCE** (PCEPI)
- **Core PCE** (PCEPILFE)
- **NFP** (PAYEMS)
- **PMI Manufacturing** (USPMI)

**Cómo se cuenta:**
```typescript
function countAlignedBigSurprises(
  items: any[],
  keys: string[],
  usdBias: 'Fuerte' | 'Débil' | 'Neutral'
): number {
  // Si USD es Neutral, no hay sorpresas alineadas
  if (usdBias === 'Neutral') return 0
  
  // Mapear sesgo USD a posture esperado
  const expectedPosture = usdBias === 'Fuerte' ? 'Hawkish' : 'Dovish'
  
  // Contar indicadores grandes con posture alineada
  let count = 0
  for (const key of keys) {
    const item = items.find(i => i.key === key)
    if (isBigIndicator(key) && item?.posture === expectedPosture) {
      count++
    }
  }
  return count
}
```

**Sistema de puntos:**
- **+1 punto**: Si hay ≥1 sorpresa grande alineada
- **+2 puntos**: Si hay ≥2 sorpresas grandes alineadas

**Por qué aumenta la confianza:**
- Si hay múltiples indicadores grandes (CPI, NFP, PCE) mostrando sorpresas en la misma dirección que el sesgo USD, confirma que el sesgo macro es real, reciente y de alta importancia.
- Múltiples sorpresas grandes (2+) indican un momentum macro fuerte, por eso otorgan 2 puntos en lugar de 1.

---

## 🎨 Visualización en el Dashboard

### **Tabla de Pares Tácticos**

Los pares con **confianza alta** están destacados visualmente:

- ✅ **Fondo verde claro** (`bg-emerald-50`)
- ✅ **Texto en negrita**
- ✅ **Borde verde**

Esto permite identificar rápidamente los pares con mayor probabilidad de éxito.

### **Columna "Confianza"**

Muestra el valor calculado:
- **Alta** 🟢: Mayor probabilidad de éxito del sesgo
- **Media** 🟡: Sesgo presente pero con menos fuerza
- **Baja** 🔴: Sesgo débil, usar con precaución

---

## 💡 Recomendaciones de Uso

### **1. Prioriza pares con confianza alta**
- Mayor probabilidad de que el sesgo macro se materialice
- Mejor relación riesgo/recompensa

### **2. Combina con análisis técnico**
- La confianza alta **no garantiza** éxito
- Siempre confirma con **price action** y niveles técnicos
- La confianza indica **probabilidad**, no certeza

### **3. Revisa correlaciones regularmente**
- Las correlaciones pueden cambiar con el tiempo
- Si la correlación cambia significativamente, la confianza puede variar
- Revisa la columna "Corr. 12m (DXY)" para ver la correlación actual

### **4. Monitorea sorpresas macro**
- Eventos macro inesperados pueden aumentar o disminuir la confianza
- Revisa la página de **Noticias** para ver eventos próximos
- Los eventos pasados afectan la confianza actual

### **5. Usa confianza media/baja con precaución**
- No significa que el sesgo sea incorrecto
- Significa que hay menos confirmación
- Considera esperar más confirmación técnica antes de operar

---

## 🔧 Detalles Técnicos

### **Dónde se calcula**

1. **`domain/bias.ts`**:
   - `confidenceFrom()`: Calcula confianza base
   - `confidenceAdvanced()`: Calcula confianza final
   - `detectRecentSurprise()`: Detecta sorpresas macro

2. **`domain/bias.ts` → `getBiasTableTactical()`**:
   - Combina todos los factores para cada par
   - Retorna la confianza en el campo `confianza`

3. **`components/TacticalTablesClient.tsx`**:
   - Muestra la confianza en la tabla
   - Destaca visualmente los pares con confianza alta

### **Actualización**

- La confianza se calcula en **tiempo real** cuando se carga el dashboard
- Se actualiza automáticamente cuando se ejecutan los jobs de:
  - Bias (`/api/jobs/compute/bias`)
  - Correlaciones (`/api/jobs/correlations`)

### **Umbrales Configurables**

Los umbrales actuales están optimizados para trading macro:
- **Threshold score**: `0.3` (configurable en `config/weights.json`)
- **Correlación fuerte**: `|ρ| >= 0.5`
- **Sorpresa**: `>= 2` indicadores en la misma dirección

---

## 📈 Interpretación por Nivel de Confianza

### **Alta (≥ 3 puntos)**
- ✅ Sesgo macro muy claro (|score| >= 0.50) o moderado con confirmaciones
- ✅ Alta correlación con USD (|ρ| ≥ 0.5) o sorpresas macro recientes
- ✅ **Recomendación**: Operar con el sesgo, confirmar con técnica

### **Media (1-2 puntos)**
- ⚠️ Sesgo macro presente pero con menos confirmación
- ⚠️ Puede tener correlación fuerte o sorpresas, pero no ambos
- ⚠️ **Recomendación**: Esperar más confirmación técnica antes de operar

### **Baja (0 puntos)**
- 🔴 Sesgo macro débil (|score| < 0.30)
- 🔴 Sin correlación fuerte (|ρ| < 0.5) y sin sorpresas macro
- 🔴 **Recomendación**: Evitar operar o esperar señales más claras

---

## ❓ Preguntas Frecuentes

**P: ¿Por qué un par tiene confianza alta pero el precio no se mueve como esperaba?**
R: La confianza indica probabilidad, no certeza. Siempre confirma con análisis técnico y price action.

**P: ¿Puede cambiar la confianza durante el día?**
R: Solo si se actualizan los datos macro o correlaciones. Normalmente se actualiza cuando se ejecutan los jobs.

**P: ¿Qué pasa si no hay correlación disponible?**
R: Se usa `null` y no se suma el punto de correlación. La confianza dependerá solo del score macro y sorpresas.

**P: ¿Cómo sé qué indicadores se usan para detectar sorpresas?**
R: Están definidos en `config/pair_event_priority.json` (si existe) o en el código de `detectRecentSurprise()`.

---

## 📚 Referencias

- Documento relacionado: `docs/CONFIANZA-CORRELACIONES.md`
- Código fuente: `domain/bias.ts` (líneas 227-262)
- Componente UI: `components/TacticalTablesClient.tsx`

