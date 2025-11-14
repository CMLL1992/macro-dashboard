# ✅ Checklist de Verificación - Notificaciones Telegram

## 1. Status OK

### Verificar `/api/notifications/status`

```bash
curl http://localhost:3000/api/notifications/status
```

**Debe retornar:**
```json
{
  "initialized": true,
  "bot_ok": true,
  "chat_ok": true,
  "weekly_next_run": "2025-01-19T17:00:00.000Z",  // Domingo 18:00 Madrid
  "enabled": true,
  "currentNarrative": "NEUTRAL",
  "recentNotifications": [],
  "weeklyLastSent": null
}
```

**Verificaciones:**
- ✅ `bot_ok: true` - Token válido
- ✅ `chat_ok: true` - Chat ID válido
- ✅ `weekly_next_run` - Próximo domingo 18:00 Europe/Madrid
- ✅ Sin error 500 aunque falten tablas

---

## 2. Variables de Entorno

Verificar que están configuradas en `.env`:

```bash
TELEGRAM_BOT_TOKEN=<token>
TELEGRAM_CHAT_ID=<chat_id>
ENABLE_TELEGRAM_NOTIFICATIONS=true
INGEST_KEY=<secreto_largo>
TIMEZONE=Europe/Madrid
NEWS_DEDUP_WINDOW_HOURS=2
NARRATIVE_COOLDOWN_MINUTES=60
GLOBAL_RATE_LIMIT_PER_MIN=10
DELTA_INFL_PP=0.2
```

---

## 3. Autenticación

**Endpoints protegidos:**
- `POST /api/news/insert` - Acepta `X-INGEST-KEY` o `CRON_TOKEN`
- `POST /api/calendar/insert` - Acepta `X-INGEST-KEY` o `CRON_TOKEN`
- `POST /api/jobs/weekly` - Acepta `X-INGEST-KEY` o `CRON_TOKEN`

---

## 4. Smoke Tests

### Test 1: Insertar Noticia Real

```bash
curl -X POST http://localhost:3000/api/news/insert \
  -H "X-INGEST-KEY: tu_secreto" \
  -H "Content-Type: application/json" \
  -d '{
    "id_fuente":"bls_2025-11_cpi_mom",
    "fuente":"BLS",
    "pais":"US",
    "tema":"Inflación",
    "titulo":"CPI m/m (oct)",
    "impacto":"high",
    "published_at":"2025-11-10T13:30:00Z",
    "valor_publicado":0.5,
    "valor_esperado":0.3,
    "resumen":"Lectura por encima del consenso."
  }'
```

**Esperado:**
- ✅ Mensaje `[NEW]` en Telegram con hora Madrid
- ✅ Respuesta: `{"success": true, "inserted": true, "notified": true}`

**Deduplicación:**
- Repetir el mismo curl → `{"notified": false}` (no envía de nuevo)

---

### Test 2: Narrativa por Inflación

Con el payload anterior (delta = 0.2pp ≥ umbral):
- ✅ Debe saltar `[NARRATIVA] → INFLACION_ARRIBA` (si no hay cooldown)

**Cooldown:**
- Enviar dato opuesto inmediatamente → no cambia (cooldown 60 min activo)

---

### Test 3: Narrativa por Crecimiento (RISK_OFF)

**Sorpresa negativa 1:**
```bash
curl -X POST http://localhost:3000/api/news/insert \
  -H "X-INGEST-KEY: tu_secreto" \
  -H "Content-Type: application/json" \
  -d '{
    "id_fuente":"pmi_us_2025-11",
    "fuente":"S&P Global",
    "pais":"US",
    "tema":"Crecimiento",
    "titulo":"PMI Manufacturas (nov)",
    "impacto":"high",
    "published_at":"2025-11-10T14:45:00Z",
    "valor_publicado":49.0,
    "valor_esperado":50.0
  }'
```

**Sorpresa negativa 2 (mismo día):**
```bash
curl -X POST http://localhost:3000/api/news/insert \
  -H "X-INGEST-KEY: tu_secreto" \
  -H "Content-Type: application/json" \
  -d '{
    "id_fuente":"retail_us_2025-11",
    "fuente":"Census",
    "pais":"US",
    "tema":"Crecimiento",
    "titulo":"Ventas minoristas (oct)",
    "impacto":"high",
    "published_at":"2025-11-10T15:30:00Z",
    "valor_publicado":-0.3,
    "valor_esperado":0.1
  }'
```

**Esperado:**
- ✅ `[NARRATIVA] → RISK_OFF` (si no hay cooldown activo)

---

### Test 4: Weekly

```bash
curl -X POST http://localhost:3000/api/jobs/weekly \
  -H "X-INGEST-KEY: tu_secreto" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Esperado:**
- ✅ `[WEEK AHEAD]` con ≤10 líneas o "sin eventos high/med"

---

## 5. Seguridad y Operación

### Separar Claves
- ✅ `INGEST_KEY` distinto de `CRON_TOKEN`
- ✅ Guardar en vault/secret manager

### Rate Limit
- ✅ 60 req/min por IP para `/api/news/insert` y `/api/calendar/insert`
- ✅ Implementado en `middleware.ts`

### Logs
- ✅ Registra `id_fuente`, `fuente`, `status` (sent/failed), `reason`
- ✅ Últimos 20 visibles en `/api/notifications/status`
- ✅ Panel admin muestra "Últimos Envíos"

---

## 6. Cosas a Vigilar

### Zona Horaria
- ✅ `Europe/Madrid` considera DST automáticamente
- ✅ Scheduler calcula próximo domingo correctamente

### Campos Faltantes
- ✅ Si no hay `valor_esperado`, usa keywords del título/resumen
- ✅ Verificar con noticia "sin consenso"

### Ráfagas
- ✅ Con `GLOBAL_RATE_LIMIT_PER_MIN=10`, si posteas 12 en 60s, alguna puede retrasarse 1-2s (esperable)

### 500 Antiguos
- ✅ Ya manejado con try-catch en `/api/notifications/status`
- ✅ Tablas inexistentes no causan error

---

## 7. Panel Admin

### Verificar `/admin`

- ✅ Botón "Enviar mensaje de prueba"
- ✅ Sección "Últimos Envíos" (20 filas)
- ✅ Muestra: tipo, fuente, id_fuente, estado, fecha

---

## 8. Alertas

### Verificar Logs

Si `bot_ok` o `chat_ok` cambian a `false`:
- ✅ Se registra en logs: `[notifications/status] ⚠️ ALERT: bot_ok or chat_ok is false`
- ✅ Aparece en `/api/notifications/status` con `validation.errors`

---

## ✅ Checklist Completo

- [ ] Status endpoint retorna `bot_ok: true`, `chat_ok: true`
- [ ] `weekly_next_run` es domingo 18:00 Madrid
- [ ] Variables de entorno configuradas
- [ ] Test 1: Noticia real envía `[NEW]`
- [ ] Test 1: Deduplicación funciona
- [ ] Test 2: Narrativa inflación funciona
- [ ] Test 2: Cooldown funciona
- [ ] Test 3: Narrativa crecimiento funciona
- [ ] Test 4: Weekly funciona
- [ ] Rate limit 60 req/min activo
- [ ] Logs registran id_fuente, fuente, status
- [ ] Panel admin muestra últimos envíos
- [ ] Alertas si bot_ok/chat_ok false

---

*Última actualización: Enero 2025*




