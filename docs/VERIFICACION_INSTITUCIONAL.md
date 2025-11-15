# Sistema de Verificación Institucional

Este documento describe el sistema de verificación institucional implementado para asegurar que los datos mostrados en el dashboard reflejan exactamente los datos reales almacenados y provienen de las series oficiales configuradas.

## Componentes del Sistema

### 1. Panel de Verificación de Datos (`/admin/data-health`)

Panel interno accesible en `/admin/data-health` que muestra:

#### Indicadores Macro
- **Nombre del indicador**: Label descriptivo
- **Fuente**: Nombre de la fuente oficial (FRED, BLS, BEA, FED, etc.)
- **ID Oficial**: ID de serie oficial (ej: CPIAUCSL)
- **Frecuencia**: Frecuencia de publicación (D, W, M, Q, A)
- **Valor**: Último valor guardado en la base de datos
- **Fecha del Dato**: Fecha económica del release
- **Última Actualización**: Timestamp de cuándo se hizo el fetch
- **Estado**: 
  - `OK`: Datos actualizados y válidos
  - `STALE`: Datos más antiguos de lo esperable para su frecuencia
  - `MISSING`: No hay dato disponible
  - `OUT_OF_RANGE`: Valor fuera del rango razonable
  - `INVALID`: Valor no numérico o inválido

#### Correlaciones
- **Símbolo**: Símbolo del activo (ej: EURUSD, BTCUSDT)
- **Símbolo Normalizado**: Versión normalizada usada en la BD
- **Corr. 12m / 3m**: Valores de correlación
- **N Obs**: Número de observaciones usadas en el cálculo
- **As of**: Fecha de cálculo
- **Estado**:
  - `OK`: Correlaciones válidas con suficientes observaciones
  - `MISSING`: No hay correlaciones calculadas
  - `INSUFFICIENT_DATA`: Pocas observaciones (menos del mínimo recomendado)
  - `INVALID`: Valores fuera del rango [-1, 1]

### 2. Metadata de Fuentes Oficiales (`lib/sources.ts`)

Archivo centralizado que contiene:

- **ID de serie oficial**: Coincide exactamente con el ID usado en FRED/FED/etc.
- **Nombre de la fuente**: FRED (BLS), FRED (BEA), FRED (FED), CBOE, etc.
- **URL a la serie oficial**: Enlace directo a la serie en FRED
- **Frecuencia**: D (diaria), W (semanal), M (mensual), Q (trimestral), A (anual)
- **Unidad de medida**: % YoY, %, miles, etc.
- **Descripción**: Descripción completa del indicador

**Uso como fuente única de verdad**: Todos los jobs de ingestión (`/api/jobs/ingest/fred`) usan `INDICATOR_SOURCES` para obtener los IDs de series, frecuencias y nombres, asegurando consistencia.

### 3. Sanity Checks Automáticos

#### Para Indicadores

**Rangos de Validez** (configurados en `app/admin/data-health/page.tsx`):
- CPI YoY: -5% a 20%
- Core CPI YoY: -2% a 15%
- PCE YoY: -5% a 20%
- Core PCE YoY: -2% a 15%
- PPI YoY: -10% a 30%
- GDP QoQ/YoY: -10% a 15%
- Industrial Production YoY: -20% a 20%
- Retail Sales YoY: -30% a 50%
- NFP Delta: -1000k a 1000k
- Unemployment Rate: 0% a 20%
- Initial Claims: 0 a 1M
- 10Y-2Y Spread: -5% a 5%
- Fed Funds Rate: 0% a 20%
- VIX: 0 a 100

**Checks realizados**:
1. Valor es `null` o `undefined` → `MISSING`
2. Valor no es numérico finito → `INVALID`
3. Valor fuera de rango → `OUT_OF_RANGE` + warning
4. Fecha del dato más antigua que el SLA para su frecuencia → `STALE` + warning

#### Para Correlaciones

**Mínimos de Observaciones**:
- Correlación 12m: Mínimo 150 observaciones
- Correlación 3m: Mínimo 40 observaciones

**Checks realizados**:
1. Correlaciones `null` para ambos períodos → `MISSING`
2. Correlación fuera del rango [-1, 1] → `INVALID` + warning
3. Número de observaciones menor al mínimo → `INSUFFICIENT_DATA` + warning

### 4. Verificación de Freshness (Actualización)

El sistema usa `lib/utils/freshness.ts` para determinar si un dato está desactualizado:

**SLA por Frecuencia**:
- **Diaria (D)**: 5 días naturales
- **Semanal (W)**: 10 días naturales
- **Mensual (M)**: 45 días naturales (considerando que los datos mensuales se publican con ~2 semanas de retraso)
- **Trimestral (Q)**: 120 días naturales
- **Anual (A)**: 400 días naturales

**Lógica**:
- Calcula la diferencia entre la fecha actual y la fecha del último dato
- Compara con el SLA correspondiente a la frecuencia del indicador
- Marca como `STALE` si excede el SLA

### 5. Transparencia en el Dashboard Público

#### Tabla de Indicadores

Cada indicador muestra:
- **Icono de información**: Al hacer hover, muestra:
  - Fuente oficial
  - ID de serie oficial
  - Fecha económica del dato (ej: "Dato a cierre de sep 2025")
  - Descripción completa
  - Enlace directo a la serie oficial en FRED

#### Información de Actualización

En la parte superior del dashboard:
- **"Última actualización de datos macro"**: Timestamp en UTC de cuándo se calculó el último bias
- **"Datos macro hasta"**: Fecha máxima de los datos macro disponibles

## Cómo Asegurar que los Datos Provienen de Fuentes Oficiales

### Verificación Manual

1. **Abrir el panel `/admin/data-health`**
2. **Para cada indicador**:
   - Verificar que el "ID Oficial" coincide con el ID de la serie en FRED
   - Hacer clic en el enlace de "Fuente" para abrir la serie oficial
   - Comparar el último valor mostrado en FRED con el valor en el panel
   - Verificar que la fecha del dato coincide

3. **Para las correlaciones**:
   - Verificar que todos los símbolos activos tienen correlaciones calculadas
   - Verificar que el número de observaciones es suficiente
   - Verificar que los valores están en el rango [-1, 1]

### Verificación Automática

El panel muestra automáticamente:
- **Estados de error**: `MISSING`, `STALE`, `OUT_OF_RANGE`, `INVALID`
- **Warnings**: Mensajes descriptivos sobre problemas detectados
- **Estadísticas resumidas**: Contadores de indicadores/correlaciones por estado

### Flujo de Datos

```
FRED API (fuente oficial)
    ↓
/api/jobs/ingest/fred (usa INDICATOR_SOURCES para IDs)
    ↓
macro_observations (SQLite)
    ↓
getAllLatestFromDB() (lee de SQLite)
    ↓
getMacroDiagnosis() (calcula transformaciones)
    ↓
/api/bias (expone datos al dashboard)
    ↓
Dashboard público (muestra datos con metadata de fuente)
```

**Punto de verificación**: El job `/api/jobs/ingest/fred` usa `INDICATOR_SOURCES` como fuente única de verdad, asegurando que todos los IDs coincidan con `lib/sources.ts`.

## Cómo Revisar Rápidamente si Todo Está en Verde

1. **Abrir `/admin/data-health`**
2. **Revisar las estadísticas resumidas**:
   - Indicadores: `OK` debe ser igual a `Total` (o muy cercano)
   - Correlaciones: `OK` debe ser igual a `Total` (o muy cercano)
3. **Si hay `STALE`, `MISSING`, `OUT_OF_RANGE`, o `INVALID`**:
   - Revisar la tabla correspondiente
   - Leer los warnings para entender el problema
   - Verificar manualmente la fuente oficial si es necesario
4. **Antes de usar el dashboard para decisiones de trading**:
   - Todos los indicadores críticos deben estar en `OK`
   - Las correlaciones de los activos que se van a operar deben estar en `OK`
   - No debe haber warnings de `OUT_OF_RANGE` en indicadores críticos

## Mantenimiento

### Añadir un Nuevo Indicador

1. Añadir entrada en `lib/sources.ts` con:
   - `seriesId`: ID oficial de la serie
   - `source`: Nombre de la fuente
   - `sourceUrl`: URL a la serie oficial
   - `frequency`: Frecuencia de publicación
   - `unit`: Unidad de medida
   - `description`: Descripción

2. Añadir entrada en `lib/db/read-macro.ts`:
   - `KEY_TO_SERIES_ID`: Mapeo de clave interna a `seriesId`

3. Añadir rango de validez en `app/admin/data-health/page.tsx`:
   - `SANITY_RANGES`: Rango mínimo y máximo esperado

4. El sistema automáticamente:
   - Incluirá el indicador en el job de ingestión
   - Lo mostrará en el panel de verificación
   - Aplicará los sanity checks

### Actualizar Rangos de Validez

Editar `SANITY_RANGES` en `app/admin/data-health/page.tsx` con los nuevos límites.

### Actualizar SLA de Freshness

Editar `SLA_BY_FREQUENCY` en `lib/utils/freshness.ts` con los nuevos tiempos máximos.

## Logs y Auditoría

Los warnings y errores detectados por los sanity checks:
- Se muestran en el panel `/admin/data-health`
- Deben revisarse periódicamente para detectar problemas temprano
- Si hay valores `OUT_OF_RANGE` persistentes, puede indicar un problema en la fuente o en el procesamiento

## Conclusión

Este sistema de verificación institucional asegura que:
1. Todos los datos provienen de fuentes oficiales verificables
2. Los datos están actualizados según su frecuencia
3. Los valores están dentro de rangos razonables
4. Las correlaciones tienen suficientes observaciones
5. Cualquier problema se detecta y reporta automáticamente

El panel `/admin/data-health` es la herramienta principal para verificar la integridad de los datos antes de usar el dashboard para decisiones de trading.

