# Decisión de Arquitectura: Allowlist de Símbolos

**Fecha:** 16 de Diciembre de 2025  
**Estado:** ✅ Implementado

---

## 🎯 Problema

El dashboard mostraba todos los pares que existían en la base de datos, no solo los 19 símbolos definidos en `config/tactical-pairs.json`. Esto causaba:
- Visualización de pares no deseados
- Inconsistencia entre configuración y datos mostrados
- Posible confusión para usuarios

---

## ✅ Solución Implementada

### Source of Truth: `tactical-pairs.json`

**`config/tactical-pairs.json` es la única fuente de verdad** para los símbolos permitidos en el sistema.

```json
[
  { "symbol": "BTCUSD", "type": "crypto", "yahoo_symbol": "BTC-USD" },
  { "symbol": "ETHUSD", "type": "crypto", "yahoo_symbol": "ETH-USD" },
  // ... 17 más
]
```

**Total: 19 símbolos permitidos**

### Arquitectura de Filtrado en Capas

#### Capa 1: SQL (Backend - Base de Datos)
- **Ubicación:** `lib/db/read.ts`
- **Funciones:** `getMacroTacticalBias()`, `getAllCorrelationsFromDB()`
- **Implementación:** Filtrado directo en SQL con `WHERE symbol IN (...)`
- **Ventaja:** Más eficiente, no trae datos innecesarios de la BD

#### Capa 2: Memoria (Backend - Aplicación)
- **Ubicación:** `domain/macro-engine/bias.ts`, `lib/dashboard-data.ts`
- **Implementación:** Filtro adicional en memoria después de leer de BD
- **Ventaja:** Doble verificación, defensa contra errores SQL

#### Capa 3: Guardrails en Jobs
- **Ubicación:** `lib/db/upsert.ts`, `app/api/jobs/compute/bias/route.ts`, `app/api/jobs/correlations/route.ts`
- **Implementación:** Filtrado antes de insertar/upsert en BD
- **Ventaja:** Previene que se ensucie la BD desde el origen

#### Capa 4: Frontend (Cliente)
- **Ubicación:** `components/TacticalTablesClient.tsx`
- **Implementación:** Filtro en memoria antes de renderizar
- **Ventaja:** Última línea de defensa, garantiza que nunca se muestren pares no permitidos

---

## 🔒 Guardrails Implementados

### 1. Funciones de Upsert

**`lib/db/upsert.ts`:**

```typescript
export async function upsertMacroBias(bias: MacroBias, ...): Promise<void> {
  // Guardrail: Filter by allowlist before inserting
  const { isAllowedPair } = await import('@/config/tactical-pairs')
  if (!isAllowedPair(bias.asset)) {
    console.warn(`[upsertMacroBias] Rejected non-allowed symbol: ${bias.asset}`)
    return // Silently skip
  }
  // ... insert logic
}
```

**`upsertCorrelation()`:** Mismo patrón

### 2. Jobs de Procesamiento

**`app/api/jobs/compute/bias/route.ts`:**
- Filtra assets antes de procesar
- Verifica allowlist antes de insertar

**`app/api/jobs/correlations/route.ts`:**
- Filtra símbolos activos por allowlist
- `upsertCorrelation()` tiene guardrail adicional

---

## 📋 Utilidades Centrales

**`config/tactical-pairs.ts`:**

```typescript
// Check if a pair is allowed
export function isAllowedPair(pair: string | null | undefined): boolean

// Get all allowed pairs
export function getAllowedPairs(): string[]

// Get symbols for SQL IN clause
export function getAllowedSymbolsForSQL(): string[]

// Build SQL WHERE clause
export function getSQLFilterForAllowedSymbols(): [string, string[]]
```

---

## 🧪 Tests de Regresión

**`tests/allowlist/regression.test.ts`:**

- ✅ Verifica que `getMacroTacticalBias()` NO devuelve símbolos fuera de allowlist
- ✅ Verifica que `isAllowedPair()` rechaza símbolos no permitidos
- ✅ Verifica que `getAllowedPairs()` devuelve exactamente 19 símbolos
- ✅ Simula componente frontend filtrando símbolos no permitidos

**Ejecutar:**
```bash
pnpm test tests/allowlist/regression.test.ts
```

---

## 🧹 Limpieza de Base de Datos

**Endpoint:** `POST /api/jobs/cleanup/macro-bias`

**Funcionalidad:**
1. Normaliza `ETHUSDT` → `ETHUSD`
2. Elimina pares no permitidos de `macro_bias`
3. Devuelve estadísticas de normalización y eliminación

**Ejecutar:**
```bash
curl -X POST https://macro-dashboard-seven.vercel.app/api/jobs/cleanup/macro-bias \
  -H "Authorization: Bearer ${CRON_TOKEN}"
```

---

## 📊 Verificación

### Verificar Dashboard
```bash
curl https://macro-dashboard-seven.vercel.app/api/dashboard | jq '.data.tacticalRows | length'
# Esperado: 19
```

### Verificar Base de Datos
```sql
SELECT DISTINCT symbol FROM macro_bias ORDER BY symbol;
-- Esperado: Solo los 19 símbolos permitidos
```

---

## 🎯 Principios de Diseño

1. **Source of Truth Único:** `tactical-pairs.json` es la única fuente
2. **Defensa en Profundidad:** Múltiples capas de filtrado
3. **Fail-Safe:** Si una capa falla, las otras protegen
4. **Prevención > Corrección:** Guardrails previenen insertar datos inválidos
5. **Transparencia:** Logs claros cuando se rechazan símbolos

---

## 📝 Mantenimiento

### Añadir Nuevo Símbolo
1. Añadir a `config/tactical-pairs.json`
2. Ejecutar limpieza de BD (opcional, para limpiar datos antiguos)
3. Verificar que aparece en dashboard

### Eliminar Símbolo
1. Eliminar de `config/tactical-pairs.json`
2. Ejecutar limpieza de BD: `POST /api/jobs/cleanup/macro-bias`
3. Verificar que desaparece del dashboard

---

## ✅ Criterios de Aceptación

- [x] Dashboard muestra solo 19 símbolos
- [x] Base de datos contiene solo 19 símbolos después de limpieza
- [x] Endpoints filtran en SQL
- [x] Jobs tienen guardrails antes de insertar
- [x] Frontend tiene filtro defensivo
- [x] Tests de regresión pasan
- [x] Documentación completa

---

**Última actualización:** 2025-12-16
