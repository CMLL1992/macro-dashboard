# ✅ Checklist: Implementación de Fuente Única para Pares Tácticos

## 📋 Resumen de Cambios Implementados

Se ha implementado una solución completa para asegurar que **solo los 19 pares** de `tactical-pairs.json` se usen en todo el sistema.

### Cambios Realizados:

1. ✅ **Fuente única creada**: `config/tactical-pairs.ts`
2. ✅ **Filtrado en `getBiasRaw()`**: Usa `isAllowedPair()` para filtrar
3. ✅ **Filtrado en `getMacroTacticalBias()`**: Filtra a nivel de DB
4. ✅ **Endpoint de limpieza**: `/api/jobs/cleanup/macro-bias`
5. ✅ **Job `compute/bias`**: Solo procesa pares permitidos
6. ✅ **Normalización ETHUSD/ETHUSDT**: Mapeo interno → Binance API
7. ✅ **Endpoint de debug**: `/api/debug/bias-state`

---

## 🧪 Pasos de Verificación (Local)

### Paso 1: Verificar que compila
```bash
pnpm build
```
**Esperado:** Build exitoso sin errores de TypeScript

### Paso 2: Ejecutar limpieza de macro_bias
```bash
CRON_TOKEN="tu_token" \
curl -X POST http://localhost:3000/api/jobs/cleanup/macro-bias \
  -H "Authorization: Bearer $CRON_TOKEN"
```
**Esperado:** 
```json
{
  "success": true,
  "deleted": <número>,
  "allowedPairs": ["BTCUSD", "ETHUSD", ...]
}
```

### Paso 3: Ejecutar compute/bias
```bash
CRON_TOKEN="tu_token" \
curl -X POST http://localhost:3000/api/jobs/compute/bias \
  -H "Authorization: Bearer $CRON_TOKEN"
```
**Esperado:** 
- Logs muestran `filteredCount: 19`
- Solo se insertan 19 pares en `macro_bias`

### Paso 4: Verificar bias-state
```bash
curl http://localhost:3000/api/debug/bias-state | jq '.'
```
**Esperado:**
```json
{
  "tacticalCount": 19,
  "allowedCount": 19,
  "matches": true,
  "extraPairs": [],
  "missingPairs": []
}
```

### Paso 5: Verificar dashboard
```bash
# Abrir en navegador
open http://localhost:3000/dashboard
```
**Esperado:** Solo se muestran los 19 pares en "Vista rápida de pares tácticos"

---

## 🚀 Pasos de Verificación (Producción)

### Paso 1: Deploy a main
```bash
git push origin main
```
**Esperado:** Vercel deploy exitoso

### Paso 2: Ejecutar limpieza de macro_bias en producción
```bash
BASE_URL="https://macro-dashboard-seven.vercel.app"
CRON_TOKEN="cbc3d1139031a75f4721ddb45bf8cca4a79b115d4c15ba83e1a1713898cdbc82"

curl -X POST "$BASE_URL/api/jobs/cleanup/macro-bias" \
  -H "Authorization: Bearer $CRON_TOKEN" | jq '.'
```
**Esperado:** 
```json
{
  "success": true,
  "deleted": <número>,
  "allowedPairs": ["BTCUSD", "ETHUSD", ...]
}
```

### Paso 3: Ejecutar compute/bias en producción
```bash
curl -X POST "$BASE_URL/api/jobs/compute/bias" \
  -H "Authorization: Bearer $CRON_TOKEN" | jq '.'
```
**Esperado:** 
- Solo procesa 19 pares
- Solo inserta 19 pares en `macro_bias`

### Paso 4: Verificar bias-state en producción
```bash
curl "$BASE_URL/api/debug/bias-state" | jq '.'
```
**Esperado:**
```json
{
  "tacticalCount": 19,
  "allowedCount": 19,
  "matches": true,
  "extraPairs": [],
  "missingPairs": []
}
```

### Paso 5: Verificar dashboard en producción
```bash
# Abrir en navegador
open https://macro-dashboard-seven.vercel.app/dashboard
```
**Esperado:** Solo se muestran los 19 pares en "Vista rápida de pares tácticos"

---

## 🔍 Debugging

### Si `tacticalCount !== 19`:

1. **Revisar logs de Vercel:**
   - Buscar `[BIAS_DEBUG]` para ver qué pares se están generando
   - Buscar `[MACRO_BIAS_DB]` para ver qué pares vienen de la DB

2. **Verificar tabla macro_bias:**
   ```sql
   SELECT DISTINCT symbol FROM macro_bias ORDER BY symbol;
   ```
   Debe mostrar solo los 19 pares permitidos.

3. **Verificar que el filtrado se ejecuta:**
   - Revisar logs de `getBiasRaw()` para ver `beforeFilter` vs `afterFilter`
   - Verificar que `isAllowedPair()` funciona correctamente

### Si hay `extraPairs`:

1. **Identificar de dónde vienen:**
   - Revisar `domain/bias.ts` - función `getBiasTableTactical()`
   - Revisar `domain/bias.ts` - función `legacyGetBiasTableTactical()`
   - Verificar si hay listas hardcodeadas

2. **Añadir más filtrado:**
   - Asegurar que todas las funciones usen `isAllowedPair()`
   - Verificar que no hay fallbacks que devuelvan todos los pares

---

## 📝 Archivos Modificados

- ✅ `config/tactical-pairs.ts` - **NUEVO** - Fuente única de verdad
- ✅ `domain/macro-engine/bias.ts` - Filtrado con `isAllowedPair()`
- ✅ `lib/db/read.ts` - Filtrado en `getMacroTacticalBias()`
- ✅ `app/api/jobs/cleanup/macro-bias/route.ts` - **NUEVO** - Endpoint de limpieza
- ✅ `app/api/jobs/compute/bias/route.ts` - Solo procesa pares permitidos
- ✅ `app/api/debug/bias-state/route.ts` - **NUEVO** - Endpoint de debug
- ✅ `lib/markets/binance.ts` - Normalización ETHUSD → ETHUSDT
- ✅ `domain/corr-dashboard.ts` - Usa BTCUSD/ETHUSD internamente

---

## ✅ Criterio de Éxito

El sistema está funcionando correctamente cuando:

1. ✅ `/api/debug/bias-state` devuelve `tacticalCount: 19` y `matches: true`
2. ✅ El dashboard muestra solo 19 pares
3. ✅ La tabla `macro_bias` solo tiene 19 entradas
4. ✅ Los logs muestran filtrado correcto en cada capa
5. ✅ No hay `extraPairs` en el debug endpoint

---

**Última actualización:** 2025-12-12  
**Commit:** `def505a`


