# 📊 Cómo funciona la Confianza de Correlaciones

## Resumen

La **confianza** en el dashboard macro indica qué tan fiable es el sesgo operativo (Long/Short/Neutral) para un par determinado. Se calcula combinando tres factores:

1. **Confianza base** (del score macro)
2. **Fuerza de correlación** con USD (DXY)
3. **Sorpresas macro recientes**

## Cálculo de la Confianza

### 1. Confianza Base (`confidenceFrom`)

Se calcula a partir del **score macro** (valor entre -1 y +1):

```typescript
function confidenceFrom(score: number, threshold = 0.3, usd: 'Fuerte' | 'Débil' | 'Neutral'): Confidence {
  const dist = Math.abs(score)
  if (dist >= threshold * 1.2) return 'Alta'        // |score| >= 0.36
  if (dist >= threshold * 0.7) return usd === 'Neutral' ? 'Media' : 'Alta'  // |score| >= 0.21
  return 'Media'                                      // |score| < 0.21
}
```

**Interpretación:**
- **Alta**: El score macro es muy claro (|score| ≥ 0.36) o moderado (|score| ≥ 0.21) con USD fuerte/débil
- **Media**: Score moderado con USD neutral, o score bajo

### 2. Confianza Avanzada (`confidenceAdvanced`)

Combina la confianza base con factores adicionales:

```typescript
function confidenceAdvanced(base: 'Alta' | 'Media' | 'Baja', corr12: number | null, recentSurprise?: 'pos' | 'neg' | 'none'): 'Alta' | 'Media' | 'Baja' {
  let score = base === 'Alta' ? 2 : base === 'Media' ? 1 : 0
  
  // +1 si correlación fuerte con USD (|ρ| ≥ 0.5)
  const c = corr12 ?? 0
  if (Math.abs(c) >= 0.5) score += 1
  
  // +1 si hay sorpresa macro reciente
  if (recentSurprise && recentSurprise !== 'none') score += 1
  
  // Clasificación final
  if (score >= 3) return 'Alta'
  if (score >= 1) return 'Media'
  return 'Baja'
}
```

**Puntuación:**
- **Base Alta** = 2 puntos
- **Base Media** = 1 punto
- **Correlación fuerte** (|ρ| ≥ 0.5) = +1 punto
- **Sorpresa macro** = +1 punto

**Resultado:**
- **Alta**: score ≥ 3
- **Media**: score ≥ 1
- **Baja**: score < 1

## Factores que Aumentan la Confianza

### ✅ Correlación Fuerte con USD

Si un par tiene una correlación fuerte (|ρ| ≥ 0.5) con DXY:
- **Correlación positiva fuerte** (ρ ≥ 0.5): El par se mueve en la misma dirección que el USD
- **Correlación negativa fuerte** (ρ ≤ -0.5): El par se mueve en dirección opuesta al USD

**Ejemplo:**
- EUR/USD con ρ = -0.65 → +1 punto de confianza
- GBP/USD con ρ = -0.72 → +1 punto de confianza

### ✅ Sorpresas Macro Recientes

Si hay indicadores macro clave que han mostrado sorpresas recientes (Hawkish o Dovish inesperados):
- **Sorpresa positiva** (Hawkish): Indica fortaleza macro → +1 punto
- **Sorpresa negativa** (Dovish): Indica debilidad macro → +1 punto

**Indicadores monitoreados:**
- NFP, CPI, PCE, GDP, PMI, etc. (según configuración de `pair_event_priority.json`)

## Ejemplos Prácticos

### Ejemplo 1: Alta Confianza
- **Score macro**: 0.45 (Alta base = 2 puntos)
- **Correlación 12m**: -0.68 (Fuerte = +1 punto)
- **Sorpresa macro**: Positiva (Hawkish = +1 punto)
- **Total**: 4 puntos → **Confianza: Alta** ✅

### Ejemplo 2: Media Confianza
- **Score macro**: 0.25 (Media base = 1 punto)
- **Correlación 12m**: 0.35 (Débil = 0 puntos)
- **Sorpresa macro**: Ninguna (0 puntos)
- **Total**: 1 punto → **Confianza: Media** ⚠️

### Ejemplo 3: Baja Confianza
- **Score macro**: 0.15 (Media base = 1 punto)
- **Correlación 12m**: 0.20 (Débil = 0 puntos)
- **Sorpresa macro**: Ninguna (0 puntos)
- **Total**: 1 punto → **Confianza: Media** (pero cerca de Baja)

## Uso en el Dashboard

### Página de Sesgos (`/sesgos`)

La columna **"Convicción"** muestra la confianza calculada:
- **Alta** (verde): Mayor probabilidad de éxito del sesgo
- **Media** (amarillo): Sesgo presente pero con menos fuerza
- **Baja** (gris): Sesgo débil, usar con precaución

### Tabla de Pares Tácticos (Dashboard)

Los pares con **confianza alta** están remarcados con:
- Fondo verde claro (`bg-emerald-50`)
- Texto en negrita
- Borde verde

Esto te permite identificar rápidamente los pares con mayor probabilidad de éxito.

## Recomendaciones de Uso

1. **Prioriza pares con confianza alta**: Mayor probabilidad de que el sesgo macro se materialice
2. **Combina con análisis técnico**: La confianza alta no garantiza éxito, siempre confirma con price action
3. **Revisa correlaciones**: Si la correlación cambia significativamente, la confianza puede variar
4. **Monitorea sorpresas macro**: Eventos macro inesperados pueden aumentar o disminuir la confianza

## Notas Técnicas

- La confianza se calcula en tiempo real basándose en:
  - Datos macro actuales (del dashboard)
  - Correlaciones históricas (12 meses)
  - Eventos macro recientes (últimas semanas)
- Se actualiza automáticamente cuando se ejecutan los jobs de bias y correlaciones
- Los umbrales (0.5 para correlación, 0.3 para score) son configurables pero están optimizados para trading macro

