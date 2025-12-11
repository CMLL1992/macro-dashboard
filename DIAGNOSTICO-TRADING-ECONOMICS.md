# 🔍 Diagnóstico: TradingEconomics en Local vs Producción

## 1️⃣ API Key de TradingEconomics

### Variable de Entorno
```
TRADING_ECONOMICS_API_KEY
```

### Valores encontrados en el código:

#### En `.env.local.backup` (local):
```
TRADING_ECONOMICS_API_KEY=0fb12631518c455:dlh6z0e5e84cut7
```

#### Fallbacks en el código:
- `'guest:guest'` - Acceso básico/gratuito (usado en calendar)
- `'3EE47420-8691-4DE1-AF46-32283925D96C'` - Hardcoded en algunos scripts de test

### ⚠️ IMPORTANTE: Verificar en Vercel
La API key en producción (Vercel) debe ser la misma que en local:
- **Formato**: `client_id:client_secret` (ejemplo: `0fb12631518c455:dlh6z0e5e84cut7`)
- **Plan requerido**: Para datos de Euro Area, se necesita plan **Premium/Full Access**
- El código detecta errores 403 que indican falta de acceso a Euro Area

---

## 2️⃣ Variables de Entorno Completas

### Variables necesarias para TradingEconomics:

```bash
# TradingEconomics API Key (formato: client_id:client_secret)
TRADING_ECONOMICS_API_KEY=0fb12631518c455:dlh6z0e5e84cut7

# Otras variables relacionadas (si existen):
# TE_CLIENT_SECRET= (no se usa en el código actual)
```

### Variables de base de datos (para comparar):
```bash
TURSO_DATABASE_URL=libsql://macro-dashboard-cm11-cmll1992.aws-eu-west-1.turso.io
TURSO_AUTH_TOKEN=eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9...
```

### Variables de FRED (para comparar):
```bash
FRED_API_KEY=tu_fred_api_key
```

---

## 3️⃣ Bypass, Mocks y Entornos Alternativos

### ❌ NO hay bypass ni mocks en el código

El código hace llamadas **directas** a la API de TradingEconomics:
- **URL base**: `https://api.tradingeconomics.com`
- **Sin proxy**: Las llamadas van directamente a TradingEconomics
- **Sin whitelist IP**: No hay configuración de IP en el código
- **Sin archivos locales**: No se cargan datos de TradingEconomics desde archivos locales
- **Sin backend auxiliar**: No hay servidor intermedio

### Rate Limiting implementado:
- **Delay mínimo**: 2000ms (2 segundos) entre requests
- **Retries**: Hasta 3 intentos con backoff exponencial
- **Manejo de errores 409/429**: Reintentos automáticos

### Endpoints usados para Euro Area:
1. `historical/country/euro%20area/indicator/{indicator}` (sin rango de fechas)
2. `historical/country/euro%20area/indicator/{indicator}?d1={start}&d2={end}` (últimos 5 años)
3. `indicator/{indicator}?country=euro%20area` (fallback)

---

## 4️⃣ Restricciones de IP

### ⚠️ TradingEconomics puede limitar por IP

**Problema potencial**: TradingEconomics puede tener restricciones de IP que:
- Funcionan en local (tu IP está permitida)
- No funcionan en Vercel (IPs de Vercel pueden estar bloqueadas)

**Solución**: Verificar en el dashboard de TradingEconomics:
1. Login en https://tradingeconomics.com
2. Ir a API Settings / API Keys
3. Verificar si hay **IP whitelist** configurada
4. Si hay whitelist, añadir los rangos de IP de Vercel:
   - Vercel usa IPs dinámicas, pero puedes contactar a TradingEconomics para whitelist de rangos
   - O usar un plan que no requiera whitelist

---

## 5️⃣ Diagnóstico del Problema

### Síntomas:
- ✅ Local funciona perfecto
- ❌ Producción no recibe datos europeos
- ❌ Producción no recibe correlaciones (excepto EUR/USD)

### Posibles causas:

#### A) API Key diferente o incorrecta en Vercel
**Solución**: Verificar que `TRADING_ECONOMICS_API_KEY` en Vercel sea exactamente:
```
0fb12631518c455:dlh6z0e5e84cut7
```

#### B) Plan insuficiente (403 Forbidden)
**Síntoma**: Logs muestran errores 403
**Código detecta esto**: Línea 212-224 en `app/api/jobs/ingest/european/route.ts`
**Solución**: Actualizar plan de TradingEconomics a Premium/Full Access

#### C) Restricción de IP
**Síntoma**: Errores 401/403 sin mensaje claro
**Solución**: Verificar whitelist de IP en TradingEconomics dashboard

#### D) Rate limiting más estricto en producción
**Síntoma**: Errores 409/429 frecuentes
**Solución**: Aumentar `TRADING_ECONOMICS_MIN_DELAY_MS` (actualmente 2000ms)

---

## 6️⃣ Pasos de Verificación

### Paso 1: Verificar API Key en Vercel
```bash
# En Vercel Dashboard → Settings → Environment Variables
# Verificar que existe:
TRADING_ECONOMICS_API_KEY=0fb12631518c455:dlh6z0e5e84cut7
```

### Paso 2: Verificar logs de producción
```bash
# En Vercel → Deployments → Logs
# Buscar errores de TradingEconomics:
# - "403" → Plan insuficiente
# - "401" → API key incorrecta
# - "409/429" → Rate limit
# - "No Access to this country" → Plan no incluye Euro Area
```

### Paso 3: Probar endpoint directamente
```bash
# Desde tu máquina local (misma IP que funciona):
curl "https://api.tradingeconomics.com/historical/country/euro%20area/indicator/gdp%20growth?c=0fb12631518c455:dlh6z0e5e84cut7"

# Si funciona local pero no en Vercel → problema de IP whitelist
```

### Paso 4: Verificar plan de TradingEconomics
- Login en https://tradingeconomics.com
- Verificar que el plan incluye acceso a "Euro Area"
- Verificar límites de requests/minuto

---

## 7️⃣ Código Relevante

### Archivos que usan TradingEconomics:
- `app/api/jobs/ingest/european/route.ts` - Ingesta indicadores europeos
- `app/api/jobs/ingest/uk/route.ts` - Ingesta indicadores UK
- `app/api/jobs/ingest/jp/route.ts` - Ingesta indicadores Japón
- `app/api/jobs/ingest/pmi/route.ts` - Ingesta PMI
- `packages/ingestors/tradingeconomics.ts` - Cliente de API
- `lib/calendar/tradingEconomicsProvider.ts` - Calendario económico

### Variable usada:
```typescript
const apiKey = process.env.TRADING_ECONOMICS_API_KEY
```

### Sin fallback en jobs críticos:
- `app/api/jobs/ingest/european/route.ts` línea 162: Si no hay API key, **salta el indicador** (no usa guest:guest)
- `app/api/jobs/ingest/uk/route.ts` línea 62: Mismo comportamiento
- `app/api/jobs/ingest/jp/route.ts` línea 62: Mismo comportamiento

---

## 8️⃣ Recomendaciones

1. **Verificar API Key en Vercel**: Debe ser exactamente `0fb12631518c455:dlh6z0e5e84cut7`
2. **Verificar plan de TradingEconomics**: Debe incluir acceso a Euro Area
3. **Revisar logs de Vercel**: Buscar errores 403/401 específicos
4. **Contactar TradingEconomics**: Si hay restricción de IP, solicitar whitelist de Vercel
5. **Considerar alternativa**: Si TradingEconomics no funciona, migrar más indicadores a FRED/ECB

---

## 9️⃣ Próximos Pasos

1. ✅ Verificar `TRADING_ECONOMICS_API_KEY` en Vercel
2. ✅ Ejecutar job `/api/jobs/ingest/european` en producción
3. ✅ Revisar logs de Vercel para errores específicos
4. ✅ Comparar respuesta de API desde local vs Vercel
5. ✅ Verificar plan y whitelist en TradingEconomics dashboard
