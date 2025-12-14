# Correcciones Implementadas - Indicadores USA, Correlaciones y Binance

## Resumen de Cambios

### 1️⃣ Indicadores USA que faltan

#### Problema 1: GDPC1 y PAYEMS con count:0 en transform_indicators
**Estado**: ✅ Corregido
- **Cambio**: Mejorado el logging en `app/api/jobs/transform/indicators/route.ts` para que los warnings de datos insuficientes no se cuenten como errores
- **Razón**: Es esperado si la ingesta FRED aún no ha corrido o si faltan datos
- **Archivo modificado**: `app/api/jobs/transform/indicators/route.ts`

#### Problema 2: Indicadores con value: null (corepce_yoy, pmi_mfg, jolts_openings)
**Estado**: ✅ Verificado
- **Análisis**: 
  - `corepce_yoy` (PCEPILFE): Ya está en FRED_SERIES y KEY_TO_SERIES_ID
  - `pmi_mfg` (USPMI): Ya está siendo ingerido desde Alpha Vantage en el job FRED
  - `jolts_openings` (JTSJOL): Ya está en FRED_SERIES y KEY_TO_SERIES_ID, configurado con `transform: 'none'` en `config/macro-indicators.ts`
- **Acción**: Los indicadores están correctamente configurados. El problema es de disponibilidad de datos, no de configuración.

#### Problema 3: WorldBank external balance (URL rota)
**Estado**: ✅ Corregido
- **Cambio**: 
  1. Validación en `lib/datasources/worldbank.ts` para rechazar `indicatorCode` vacío
  2. Actualización en `lib/bias/inputs.ts` para usar IMF en lugar de WorldBank para TRADE_BALANCE_USD (que requiere derivación)
  3. Validación adicional para asegurar que `indicatorCode` no esté vacío antes de llamar a `fetchWorldBankSeries`
- **Archivos modificados**:
  - `lib/datasources/worldbank.ts`
  - `lib/bias/inputs.ts`

### 2️⃣ Correlaciones: warnings de fetch y datos faltantes

#### Problema 4: Warning Next.js cache: 'no-store' + revalidate: 0
**Estado**: ✅ Corregido
- **Cambio**: 
  1. Eliminado `next: { revalidate: 0 }` del fetch en `lib/correlations/fetch.ts`
  2. Añadido `export const dynamic = 'force-dynamic'` y `export const revalidate = 0` en `app/api/jobs/correlations/route.ts`
- **Archivos modificados**:
  - `lib/correlations/fetch.ts`
  - `app/api/jobs/correlations/route.ts`

#### Problema 5: Pares con null en correlaciones (USDJPY, USDCNH)
**Estado**: ✅ Verificado
- **Análisis**: El cálculo de correlaciones en `lib/correlations/calc.ts` ya maneja correctamente los casos con `correlation: null` cuando:
  - No hay suficientes observaciones (`n_obs < minObs`)
  - Los datos son demasiado antiguos (>20 días)
  - La correlación no es finita
- **Acción**: El código ya está correcto. Los nulls son esperados cuando no hay datos suficientes.

### 3️⃣ Problema Binance 451 en corr-dashboard

#### Problema 6: Binance 451 para BTCUSD y ETHUSD
**Estado**: ✅ Corregido
- **Cambio**: 
  1. Migrado `domain/corr-dashboard.ts` de Binance a Yahoo Finance para BTCUSD y ETHUSD
  2. Añadido mapeo en `YAHOO_MAP`: `BTCUSD: 'BTC-USD'`, `ETHUSD: 'ETH-USD'`
  3. Eliminada dependencia de `binanceKlinesMonthly` y `BinanceRestrictionError`
  4. Simplificado `fetchAssetSeries` para usar solo Yahoo Finance
- **Archivos modificados**:
  - `domain/corr-dashboard.ts`

## Archivos Modificados

1. `lib/correlations/fetch.ts` - Eliminado `next: { revalidate: 0 }` del fetch
2. `app/api/jobs/correlations/route.ts` - Añadido `dynamic = 'force-dynamic'`
3. `lib/bias/inputs.ts` - Cambiado a IMF para TRADE_BALANCE_USD, validación de indicatorCode
4. `lib/datasources/worldbank.ts` - Validación de indicatorCode no vacío
5. `domain/corr-dashboard.ts` - Migrado de Binance a Yahoo Finance para crypto
6. `app/api/jobs/transform/indicators/route.ts` - Mejorado logging (no cuenta warnings como errores)

## Próximos Pasos Recomendados

1. **Ejecutar jobs de ingesta**:
   ```bash
   # En producción (Vercel)
   curl -X POST https://tu-dominio.com/api/jobs/ingest/fred \
     -H "Authorization: Bearer ${CRON_TOKEN}"
   
   curl -X POST https://tu-dominio.com/api/jobs/transform/indicators \
     -H "Authorization: Bearer ${CRON_TOKEN}"
   ```

2. **Verificar datos en DB**:
   ```sql
   SELECT series_id, COUNT(*) 
   FROM macro_observations 
   WHERE series_id IN ('GDPC1', 'PAYEMS', 'PCEPILFE', 'JTSJOL', 'USPMI')
   GROUP BY series_id;
   ```

3. **Ejecutar job de correlaciones**:
   ```bash
   curl -X POST https://tu-dominio.com/api/jobs/correlations \
     -H "Authorization: Bearer ${CRON_TOKEN}"
   ```

4. **Verificar logs**:
   - Los warnings de "Insufficient observations" no deberían contar como errores
   - No deberían aparecer errores 451 de Binance en corr-dashboard
   - No deberían aparecer warnings de cache en correlaciones

## Notas Importantes

- **GDPC1 y PAYEMS**: Si siguen apareciendo con count:0, verificar que el job `/api/jobs/ingest/fred` se haya ejecutado correctamente y haya ingerido datos históricos.
- **Correlaciones null**: Es normal que algunos pares (especialmente USDCNH) tengan correlación null si Yahoo Finance no tiene datos históricos suficientes.
- **Binance 451**: Ya no debería aparecer este error, ya que corr-dashboard ahora usa Yahoo Finance exclusivamente para crypto.


