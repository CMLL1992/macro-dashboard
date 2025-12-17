# Resumen: Fix Forex Whitelist (12 pares únicos)

**Fecha**: 2025-12-17  
**Estado**: ✅ Implementado y corregido

---

## 🎯 Objetivo

Mostrar **exactamente 12 pares de Forex** en el dashboard:
- **Majors (7)**: EURUSD, GBPUSD, USDJPY, USDCHF, AUDUSD, USDCAD, NZDUSD
- **Crosses (5)**: EURGBP, EURJPY, GBPJPY, EURCHF, AUDJPY

**Ningún otro par de Forex debe aparecer.**

---

## ❌ Problemas identificados

1. **BTCUSD, ETHUSD eliminados incorrectamente**
   - Fueron eliminados por el script de limpieza
   - **Fix**: Restaurados con `scripts/restore-missing-pairs.ts`

2. **XAUUSD no aparecía**
   - Estaba en BD pero no se mostraba
   - **Fix**: Verificado que existe con `category='metal'`

3. **Los 5 crosses no aparecían en dashboard**
   - Estaban en BD con `category='forex'`
   - Tenían datos (bias, precios)
   - **Causa**: Filtros demasiado estrictos en `domain/macro-engine/bias.ts`

4. **SX5E y WTI aparecían en sección Forex**
   - Tenían `category` incorrecta o se clasificaban mal
   - **Fix**: Creados/actualizados con `category='index'` y `category='commodity'` respectivamente

---

## ✅ Cambios implementados

### 1. Whitelist de Forex creada
- **Archivo**: `config/forex-whitelist.ts`
- **Función**: `isForexWhitelisted(symbol)`
- **12 pares definidos**

### 2. Filtros actualizados

**`lib/dashboard-data.ts`**:
- Filtro FOREX_WHITELIST aplicado solo a pares con `type='fx'`
- Otros tipos (crypto, commodity, index) pasan si están en `tactical-pairs.json`

**`domain/macro-engine/bias.ts`**:
- Filtro FOREX_WHITELIST aplicado solo a pares con `type='fx'` en `tactical-pairs.json`
- Carga `tactical-pairs.json` para verificar tipos antes de aplicar whitelist

**`components/TacticalTablesClient.tsx`**:
- `ALLOWED_SYMBOLS` actualizado: 12 Forex + otros permitidos
- Eliminados USDCNH, USDBRL, USDMXN de la lista

**`lib/assets.ts`**:
- `ASSET_CATEGORIES`: Solo 12 Forex whitelist marcados como 'forex'
- `getAssetCategory()`: Verifica FOREX_WHITELIST antes de clasificar como 'forex'
- `getAssetCategorySafe()`: No default a 'forex' si no está en whitelist
- SX5E, WTI, COPPER explícitamente como 'index'

### 3. Scripts de mantenimiento

**`scripts/ensure-forex-whitelist.ts`**:
- Asegura que los 12 pares existan en `asset_metadata`
- Crea/actualiza con `category='forex'`

**`scripts/cleanup-forex-pairs.ts`**:
- Elimina pares Forex no permitidos
- Recategoriza items mal clasificados (crypto/commodity/index)

**`scripts/restore-missing-pairs.ts`**:
- Restaura BTCUSD, ETHUSD, XAUUSD

**`scripts/ensure-sx5e-wti.ts`**:
- Asegura que SX5E y WTI existan con category correcta

### 4. Base de datos

**Estado actual**:
- ✅ 12 pares Forex en `asset_metadata` con `category='forex'`
- ✅ BTCUSD, ETHUSD en `asset_metadata` con `category='crypto'`
- ✅ XAUUSD en `asset_metadata` con `category='metal'`
- ✅ SX5E en `asset_metadata` con `category='index'`
- ✅ WTI en `asset_metadata` con `category='commodity'`
- ✅ Los 5 crosses tienen datos (bias, precios)

---

## 📊 Estado final esperado en dashboard

### Sección "Forex – Pares principales"
**Debe mostrar exactamente 12 pares**:
1. EUR/USD
2. GBP/USD
3. USD/JPY
4. USD/CHF
5. AUD/USD
6. USD/CAD
7. NZD/USD
8. EUR/GBP
9. EUR/JPY
10. GBP/JPY
11. EUR/CHF
12. AUD/JPY

### Otras secciones
- **Criptomonedas**: BTC/USD, ETH/USD
- **Metales**: XAU/USD
- **Índices**: SPX, NDX, SX5E, NIKKEI
- **Commodities**: WTI, COPPER

**SX5E y WTI NO deben aparecer en sección Forex.**

---

## 🔍 Verificación

Para verificar que todo está correcto:

```bash
# 1. Verificar BD
node - <<'NODE'
const { createClient } = require("@libsql/client");
const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
});
(async () => {
  const forex = await client.execute({
    sql: "SELECT symbol FROM asset_metadata WHERE category = 'forex' ORDER BY symbol"
  });
  console.log(`Forex en BD: ${forex.rows.length}`);
  forex.rows.forEach(r => console.log(`  - ${r.symbol}`));
})();
NODE

# 2. Verificar dashboard (cuando servidor esté corriendo)
curl -s http://localhost:3001/api/dashboard | jq '.data.tactical | map(select(.pair | test("^[A-Z]{3}/[A-Z]{3}$"))) | length'
# Debe devolver: 12
```

---

## 🚀 Próximos pasos

1. **Reiniciar servidor** para que cargue los cambios
2. **Verificar dashboard** que muestre exactamente 12 pares Forex
3. **Confirmar** que BTCUSD, ETHUSD, XAUUSD aparecen en sus secciones
4. **Confirmar** que SX5E y WTI NO aparecen en sección Forex

---

**Última actualización**: 2025-12-17
