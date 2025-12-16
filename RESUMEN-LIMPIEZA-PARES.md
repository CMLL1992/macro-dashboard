# ✅ Resumen: Limpieza de Pares y Filtrado Definitivo

**Fecha:** 16 de Diciembre de 2025  
**Estado:** ✅ COMPLETADO

---

## 🎯 Objetivo

Asegurar que el dashboard **NUNCA** muestre más de los 19 símbolos definidos en `config/tactical-pairs.json`, incluso si la base de datos contiene pares antiguos.

---

## ✅ Cambios Implementados

### 1. Utilidad Central de Allowlist

**Archivo:** `config/tactical-pairs.ts`

Añadidas funciones helper:
- `getAllowedSymbolsForSQL()`: Devuelve array de símbolos para SQL IN clause
- `getSQLFilterForAllowedSymbols()`: Devuelve WHERE clause y valores para queries SQL

### 2. Filtrado en SQL (Backend)

**Archivos modificados:**
- `lib/db/read.ts`:
  - `getMacroTacticalBias()`: Ahora filtra directamente en SQL con `WHERE symbol IN (...)`
  - `getAllCorrelationsFromDB()`: Filtra correlaciones por símbolos permitidos en SQL
  - Filtro en memoria como doble verificación

### 3. Limpieza de Referencias ETHUSDT

**Archivos modificados:**
- `domain/corr-dashboard.ts`: Eliminado `ETHUSDT` de mapas hardcodeados
- `lib/correlations/fetch.ts`: Eliminado `ETHUSDT` de mapas hardcodeados
- **Nota:** El mapeo a Binance API se mantiene (usa `ETHUSDT` internamente, pero símbolo interno es `ETHUSD`)

### 4. Endpoint de Limpieza Mejorado

**Archivo:** `app/api/jobs/cleanup/macro-bias/route.ts`

Mejoras:
- **Normaliza `ETHUSDT` → `ETHUSD`** antes de eliminar
- Elimina pares no permitidos de `macro_bias`
- Devuelve estadísticas de normalización y eliminación

### 5. Filtro Defensivo en Frontend

**Archivo:** `components/TacticalTablesClient.tsx`

Añadido:
- Lista hardcodeada de 19 símbolos permitidos
- Filtro en memoria antes de renderizar
- Última línea de defensa si el backend falla

---

## 🧹 Limpieza Ejecutada

**Fecha de ejecución:** 16 de Diciembre de 2025, 20:54 UTC

**Resultado:**
```json
{
  "success": true,
  "job": "cleanup_macro_bias",
  "startedAt": "2025-12-16T20:54:24.681Z",
  "finishedAt": "2025-12-16T20:54:25.210Z",
  "duration_ms": 529,
  "normalized": 0,
  "deleted": 63,
  "allowedPairs": [
    "AUDUSD", "BTCUSD", "COPPER", "ETHUSD", "EURUSD", "GBPUSD",
    "NDX", "NIKKEI", "NZDUSD", "SPX", "SX5E", "USDBRL",
    "USDCAD", "USDCHF", "USDCNH", "USDJPY", "USDMXN", "WTI", "XAUUSD"
  ]
}
```

**Resumen:**
- ✅ **63 registros eliminados** de `macro_bias` (pares no permitidos)
- ✅ **0 registros normalizados** (no había ETHUSDT que normalizar)
- ✅ **19 pares permitidos** confirmados

---

## 🔒 Capas de Filtrado Implementadas

### Capa 1: SQL (Backend - Base de Datos)
- `getMacroTacticalBias()`: Filtra en SQL con `WHERE symbol IN (...)`
- `getAllCorrelationsFromDB()`: Filtra correlaciones en SQL
- **Ventaja:** Más eficiente, no trae datos innecesarios de la BD

### Capa 2: Memoria (Backend - Aplicación)
- Filtro adicional en memoria después de leer de BD
- **Ventaja:** Doble verificación, defensa contra errores SQL

### Capa 3: Frontend (Cliente)
- `TacticalTablesClient.tsx`: Filtra antes de renderizar
- **Ventaja:** Última línea de defensa, garantiza que nunca se muestren pares no permitidos

---

## 📋 Verificación

### Verificar Dashboard
1. Visitar: https://macro-dashboard-seven.vercel.app/dashboard
2. Verificar sección "Vista rápida de pares tácticos"
3. **Esperado:** Solo 19 pares visibles

### Verificar API
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

## 🚀 Próximos Pasos Recomendados

1. **Monitorear Dashboard:**
   - Verificar que solo aparecen 19 pares
   - Si aparecen más, revisar logs de Vercel

2. **Ejecutar Limpieza Periódica:**
   - Ejecutar `/api/jobs/cleanup/macro-bias` periódicamente (ej: mensual)
   - O añadir a cron job automático

3. **Verificar Job de Bias:**
   - Asegurar que `/api/jobs/compute/bias` solo inserta los 19 pares permitidos
   - Revisar logs del job para confirmar

---

## 📝 Archivos Modificados

1. ✅ `config/tactical-pairs.ts` - Funciones helper para SQL
2. ✅ `lib/db/read.ts` - Filtrado en SQL
3. ✅ `domain/corr-dashboard.ts` - Eliminado ETHUSDT
4. ✅ `lib/correlations/fetch.ts` - Eliminado ETHUSDT
5. ✅ `app/api/jobs/cleanup/macro-bias/route.ts` - Normalización ETHUSDT → ETHUSD
6. ✅ `components/TacticalTablesClient.tsx` - Filtro defensivo frontend

---

## ✅ Criterio de Aceptación

**COMPLETADO:** Aunque la base de datos tenga 200 símbolos, el dashboard muestra solo los 19 permitidos.

**Verificado:**
- ✅ Filtrado en SQL (Capa 1)
- ✅ Filtrado en memoria backend (Capa 2)
- ✅ Filtrado en frontend (Capa 3)
- ✅ Limpieza de BD ejecutada (63 registros eliminados)
- ✅ Referencias ETHUSDT eliminadas del código

---

**Última actualización:** 2025-12-16
