# ✅ Checklist de Pruebas End-to-End

## 🎯 Objetivo

Validar que el pipeline completo funciona antes de usar en trading real:
**Calendario → Releases → Sorpresas → Bias → UI**

---

## A. Probar Ingesta de Calendario

### 1. Ejecutar Job de Calendario

```bash
# En local
export CRON_TOKEN="tu_token_secreto"
curl -X POST http://localhost:3000/api/jobs/ingest/calendar \
  -H "Authorization: Bearer $CRON_TOKEN" \
  -H "Content-Type: application/json"
```

**Respuesta esperada:**
```json
{
  "status": "ok",
  "count": 45,
  "upserted": 45,
  "errors": 0,
  "from": "2025-12-08T02:00:00.000Z",
  "to": "2025-12-15T02:00:00.000Z"
}
```

### 2. Verificar en Base de Datos

```sql
-- Ver eventos insertados
SELECT 
  id,
  source_event_id,
  country,
  currency,
  name,
  importance,
  scheduled_time_utc,
  series_id,
  indicator_key,
  directionality,
  consensus_value
FROM economic_events
WHERE scheduled_time_utc >= datetime('now', '-1 day')
ORDER BY scheduled_time_utc ASC
LIMIT 20;
```

**✅ Checklist:**
- [ ] Hay eventos para hoy y próximos días
- [ ] `series_id` está rellenado para eventos conocidos (CPI → `CPIAUCSL`, NFP → `PAYEMS`)
- [ ] `indicator_key` está rellenado (ej: `us_cpi_yoy`, `us_nfp_change`)
- [ ] `directionality` es correcto (`higher_is_positive` para CPI, `lower_is_positive` para unemployment)
- [ ] `importance` es `medium` o `high` para eventos importantes
- [ ] `consensus_value` está presente cuando el proveedor lo proporciona

### 3. Verificar en UI (si existe página de calendario)

Navega a `/dashboard` o donde se muestren eventos recientes.

**✅ Checklist:**
- [ ] Los eventos aparecen con hora correcta (UTC y local)
- [ ] La importancia se muestra correctamente (badges/colores)
- [ ] La moneda está visible (USD, EUR, GBP, JPY)
- [ ] El nombre del evento es legible

---

## B. Probar Creación de Release + Sorpresa (Modo Simulado)

### 1. Preparar Evento de Prueba

```sql
-- Elegir un evento de hoy (ej: US CPI)
SELECT id, name, currency, scheduled_time_utc, consensus_value
FROM economic_events
WHERE currency = 'USD' 
  AND name LIKE '%CPI%'
  AND scheduled_time_utc >= datetime('now', '-1 day')
LIMIT 1;

-- Forzar que el evento esté en la ventana de tiempo del job
-- (ajustar scheduled_time_utc a ahora - 1 minuto)
UPDATE economic_events
SET scheduled_time_utc = datetime('now', '-1 minute')
WHERE id = <EVENT_ID>;
```

### 2. Ejecutar Job de Releases

```bash
curl -X POST http://localhost:3000/api/jobs/ingest/releases \
  -H "Authorization: Bearer $CRON_TOKEN" \
  -H "Content-Type: application/json"
```

**Respuesta esperada:**
```json
{
  "status": "ok",
  "releases": 1,
  "releases_created": [
    {
      "id": 123,
      "event": "US CPI YoY"
    }
  ],
  "window": {
    "from": "2025-12-09T10:58:00.000Z",
    "to": "2025-12-09T11:01:00.000Z"
  }
}
```

### 3. Verificar Release en Base de Datos

```sql
-- Ver release creado
SELECT 
  er.id,
  er.event_id,
  ee.name,
  er.actual_value,
  er.consensus_value,
  er.previous_value,
  er.surprise_raw,
  er.surprise_pct,
  er.surprise_score,
  er.surprise_direction,
  er.release_time_utc
FROM economic_releases er
JOIN economic_events ee ON er.event_id = ee.id
WHERE er.event_id = <EVENT_ID>
ORDER BY er.created_at DESC
LIMIT 1;
```

**✅ Checklist:**
- [ ] `actual_value` está rellenado
- [ ] `consensus_value` coincide con el del evento
- [ ] `surprise_raw` = `actual_value - consensus_value`
- [ ] `surprise_pct` = `(actual - consensus) / abs(consensus)`
- [ ] `surprise_score` está entre -1 y 1
- [ ] `surprise_direction` es `positive` o `negative` según `directionality`
- [ ] `release_time_utc` es reciente

### 4. Verificar Cálculo de Sorpresa

**Ejemplo con valores reales:**
- CPI Consensus: 3.1%
- CPI Actual: 3.3%
- Directionality: `higher_is_positive`

**Esperado:**
- `surprise_raw` = 0.2
- `surprise_pct` = 0.2 / 3.1 ≈ 0.0645 (6.45%)
- `surprise_score` = 0.0645 / 0.1 ≈ 0.645 (clamped a 1.0)
- `surprise_direction` = `positive` (porque 3.3 > 3.1 y higher_is_positive)

---

## C. Validar que el Bias se Recalcula

### 1. Verificar Meta en `/api/bias`

```bash
curl http://localhost:3000/api/bias | jq '.meta'
```

**Respuesta esperada:**
```json
{
  "bias_updated_at": "2025-12-09T11:00:15.234Z",
  "last_event_applied_at": "2025-12-09T11:00:10.123Z"
}
```

**✅ Checklist:**
- [ ] `bias_updated_at` es reciente (últimos minutos)
- [ ] `last_event_applied_at` coincide con el `release_time_utc` del release de prueba

### 2. Verificar RecentEvents en `/api/bias`

```bash
curl http://localhost:3000/api/bias | jq '.recentEvents[0]'
```

**Respuesta esperada:**
```json
{
  "currency": "USD",
  "name": "US CPI YoY",
  "importance": "high",
  "actual": 3.3,
  "consensus": 3.1,
  "surprise_direction": "positive",
  "surprise_score": 0.645,
  "release_time_utc": "2025-12-09T11:00:10.123Z",
  "impact": {
    "currency": "USD",
    "score_before": 0.15,
    "score_after": 0.27,
    "regime_before": "mixed",
    "regime_after": "reflation"
  }
}
```

**✅ Checklist:**
- [ ] El evento de prueba aparece en `recentEvents[]`
- [ ] `surprise_direction` y `surprise_score` son correctos
- [ ] `impact.score_before` y `score_after` muestran cambio (si aplica)
- [ ] `impact.regime_before` y `regime_after` muestran cambio (si aplica)

### 3. Verificar Tactical Table

```bash
curl http://localhost:3000/api/bias | jq '.tableTactical[] | select(.pair == "EURUSD")'
```

**Respuesta esperada:**
```json
{
  "pair": "EURUSD",
  "symbol": "EURUSD",
  "trend": "Mejora",
  "action": "Long",
  "confidence": "Alta",
  "last_relevant_event": {
    "currency": "USD",
    "name": "US CPI YoY",
    "surprise_direction": "positive",
    "surprise_score": 0.645,
    "release_time_utc": "2025-12-09T11:00:10.123Z"
  },
  "updated_after_last_event": true
}
```

**✅ Checklist:**
- [ ] Pares con la moneda afectada muestran `last_relevant_event`
- [ ] `last_relevant_event.currency` coincide con la moneda del evento
- [ ] `last_relevant_event.surprise_direction` es correcto
- [ ] `updated_after_last_event` es `true` si el bias se recalculó después del evento

### 4. Verificar en UI (Dashboard)

Navega a `/dashboard` y verifica:

**✅ Checklist:**
- [ ] El componente `RecentMacroEvents` muestra el evento de prueba
- [ ] La sorpresa se muestra con color correcto (verde para positive, rojo para negative)
- [ ] El impacto en scores/regímenes se muestra si existe
- [ ] La tabla táctica muestra `last_relevant_event` en los pares afectados
- [ ] El indicador `updated_after_last_event` aparece correctamente

---

## D. Prueba de Integridad Completa

### 1. Flujo Completo Simulado

```bash
# 1. Limpiar datos de prueba anteriores
sqlite3 data.db "DELETE FROM economic_releases WHERE event_id IN (SELECT id FROM economic_events WHERE name LIKE '%TEST%');"

# 2. Crear evento de prueba con hora futura cercana
sqlite3 data.db "
INSERT INTO economic_events (
  source_event_id, country, currency, name, category, importance,
  series_id, indicator_key, directionality,
  scheduled_time_utc, consensus_value, previous_value,
  created_at, updated_at
) VALUES (
  'test-cpi-001', 'US', 'USD', 'TEST CPI YoY', 'Inflation', 'high',
  'CPIAUCSL', 'us_cpi_yoy', 'higher_is_positive',
  datetime('now', '+1 minute'), 3.1, 3.2,
  datetime('now'), datetime('now')
);
"

# 3. Esperar 2 minutos

# 4. Ejecutar job de releases (simular que el dato ya salió)
# Primero actualizar el evento para que esté en ventana pasada
sqlite3 data.db "
UPDATE economic_events
SET scheduled_time_utc = datetime('now', '-1 minute')
WHERE source_event_id = 'test-cpi-001';
"

# 5. Simular release manualmente (porque el proveedor no tiene este evento)
sqlite3 data.db "
INSERT INTO economic_releases (
  event_id, release_time_utc, actual_value, consensus_value, previous_value,
  surprise_raw, surprise_pct, surprise_score, surprise_direction,
  created_at
) VALUES (
  (SELECT id FROM economic_events WHERE source_event_id = 'test-cpi-001'),
  datetime('now'),
  3.3, 3.1, 3.2,
  0.2, 0.0645, 0.645, 'positive',
  datetime('now')
);
"

# 6. Ejecutar recompute de bias
curl -X POST http://localhost:3000/api/jobs/compute/bias \
  -H "Authorization: Bearer $CRON_TOKEN"

# 7. Verificar resultado
curl http://localhost:3000/api/bias | jq '.recentEvents[] | select(.name == "TEST CPI YoY")'
```

**✅ Checklist Final:**
- [ ] El evento aparece en `recentEvents`
- [ ] La sorpresa está calculada correctamente
- [ ] El bias se recalculó (`bias_updated_at` es reciente)
- [ ] Los pares USD muestran `last_relevant_event` con este evento
- [ ] `updated_after_last_event` es `true`

---

## E. Pruebas de Errores y Edge Cases

### 1. Evento sin Release (Normal)

```bash
# Ejecutar job cuando no hay eventos en ventana
curl -X POST http://localhost:3000/api/jobs/ingest/releases \
  -H "Authorization: Bearer $CRON_TOKEN"
```

**Esperado:** `releases: 0` (no es error, simplemente no hay eventos)

### 2. Evento sin Consensus

```sql
-- Crear evento sin consensus
INSERT INTO economic_events (
  source_event_id, currency, name, importance, scheduled_time_utc,
  consensus_value
) VALUES (
  'test-no-consensus', 'USD', 'Test Event', 'high',
  datetime('now', '-1 minute'),
  NULL
);
```

**Esperado:** El job debe manejar `consensus_value = NULL` sin fallar

### 3. Provider API Error

Simular error de API (desconectar internet o usar API key inválida).

**Esperado:** El job debe loguear el error pero no fallar completamente

---

## 📊 Resumen de Validación

Si todas las pruebas pasan:

✅ **Calendario funciona:** Eventos se insertan correctamente con mapeos  
✅ **Releases funcionan:** Sorpresas se calculan correctamente  
✅ **Bias se recalcula:** El sistema macro se actualiza tras releases  
✅ **UI muestra datos:** Dashboard refleja eventos y sorpresas  
✅ **Pipeline completo:** Desde calendario hasta UI, todo conectado

**🎯 Listo para uso en trading real** (con monitoreo activo)

---

## 🐛 Troubleshooting

### Problema: Job de calendario retorna 0 eventos

**Posibles causas:**
- API key inválida o expirada
- Proveedor sin eventos en el rango de fechas
- Error de red

**Solución:**
```bash
# Verificar logs del job
# Probar provider directamente
node -e "
const { TradingEconomicsProvider } = require('./lib/calendar/tradingEconomicsProvider');
const p = new TradingEconomicsProvider(process.env.TRADING_ECONOMICS_API_KEY);
p.fetchCalendar({ from: new Date(), to: new Date(Date.now() + 7*24*60*60*1000) })
  .then(events => console.log('Events:', events.length))
  .catch(err => console.error('Error:', err));
"
```

### Problema: Releases no se crean

**Posibles causas:**
- Evento no está en ventana de tiempo (`[now - 2m, now + 1m]`)
- Provider aún no tiene el dato publicado
- `source_event_id` no coincide con el del proveedor

**Solución:**
```sql
-- Verificar eventos en ventana
SELECT id, name, scheduled_time_utc,
  datetime('now') as now,
  datetime('now', '-2 minutes') as window_start,
  datetime('now', '+1 minute') as window_end
FROM economic_events
WHERE scheduled_time_utc >= datetime('now', '-2 minutes')
  AND scheduled_time_utc <= datetime('now', '+1 minute');
```

### Problema: Bias no se recalcula

**Posibles causas:**
- Job de recompute falló
- Error en cálculo de bias
- `CRON_TOKEN` incorrecto

**Solución:**
```bash
# Verificar logs del job de bias
curl -X POST http://localhost:3000/api/jobs/compute/bias \
  -H "Authorization: Bearer $CRON_TOKEN" \
  -v
```

