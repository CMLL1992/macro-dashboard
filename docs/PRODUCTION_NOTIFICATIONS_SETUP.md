# 🚀 Configuración Producción - Notificaciones Telegram

## Variables de Entorno Requeridas

```bash
# Telegram
TELEGRAM_BOT_TOKEN=<tu_token_del_bot>
TELEGRAM_CHAT_ID=<tu_chat_id_produccion>
ENABLE_TELEGRAM_NOTIFICATIONS=true

# Configuración
TIMEZONE=Europe/Madrid
NEWS_DEDUP_WINDOW_HOURS=2
NARRATIVE_COOLDOWN_MINUTES=60
GLOBAL_RATE_LIMIT_PER_MIN=10
DELTA_INFL_PP=0.2

# Seguridad (OBLIGATORIO para producción)
# ⚠️  INGEST_KEY es REQUERIDO. El sistema NO funcionará sin él.
# Genera un secreto largo y aleatorio manualmente:
INGEST_KEY=mi_super_secreto_123
# Ejemplo de generación: openssl rand -hex 32
```

## Verificación Inicial

### 1. Verificar Estado del Sistema

```bash
curl http://localhost:3000/api/notifications/status
```

**Respuesta esperada:**
```json
{
  "initialized": true,
  "validation": {
    "valid": true,
    "bot_ok": true,
    "chat_ok": true,
    "checked_at": "2025-01-10T22:15:00Z",
    "errors": [],
    "warnings": []
  },
  "bot_ok": true,
  "chat_ok": true,
  "ingest_key_loaded": true,
  "currentNarrative": "NEUTRAL",
  "weekly_next_run": "2025-01-19T17:00:00.000Z",
  "enabled": true
}
```

**Verificaciones importantes:**
- ✅ `ingest_key_loaded: true` - INGEST_KEY está configurado
- ✅ `bot_ok: true` - Token de bot válido
- ✅ `chat_ok: true` - Chat ID válido

Si `bot_ok: false` o `chat_ok: false`, revisar configuración de Telegram.

## Integración con Pipeline

### 2. Enviar Noticia Real

**Endpoint:** `POST /api/news/insert`

**Autenticación:** Header `X-INGEST-KEY: <INGEST_KEY>`

**Ejemplo:**
```bash
curl -X POST http://localhost:3000/api/news/insert \
  -H "Content-Type: application/json" \
  -H "X-INGEST-KEY: tu_secreto_aqui" \
  -d '{
    "id_fuente": "bls_2025-01_cpi_mom",
    "fuente": "BLS",
    "pais": "US",
    "tema": "Inflación",
    "titulo": "CPI m/m (oct)",
    "impacto": "high",
    "published_at": "2025-01-10T13:30:00Z",
    "valor_publicado": 0.5,
    "valor_esperado": 0.3,
    "resumen": "Lectura por encima del consenso por energía/shelter."
  }'
```

**Respuesta exitosa:**
```json
{
  "success": true,
  "inserted": true,
  "notified": true
}
```

### 3. Insertar Evento Calendario

**Endpoint:** `POST /api/calendar/insert`

**Autenticación:** Header `X-INGEST-KEY: <INGEST_KEY>`

**Ejemplo:**
```bash
curl -X POST http://localhost:3000/api/calendar/insert \
  -H "Content-Type: application/json" \
  -H "X-INGEST-KEY: tu_secreto_aqui" \
  -d '{
    "fecha": "2025-01-20",
    "hora_local": "14:30",
    "pais": "US",
    "tema": "Inflación",
    "evento": "CPI m/m",
    "importancia": "high",
    "consenso": "0.3%"
  }'
```

## Flujo Automático

### Noticias → Notificación [NEW]

1. Tu pipeline hace `POST /api/news/insert` con `X-INGEST-KEY`
2. El sistema:
   - Verifica deduplicación (2h ventana)
   - Envía Telegram `[NEW]` automáticamente
   - Procesa para narrativa (si aplica)

### Narrativa → Notificación [NARRATIVA]

Se dispara automáticamente cuando:
- CPI/PPI con delta ≥ 0.2pp → `INFLACION_ARRIBA` o `INFLACION_ABAJO`
- 2 sorpresas negativas/positivas mismo día → `RISK_OFF` o `RISK_ON`
- Keywords en título → `RISK_ON`/`RISK_OFF`

**Cooldown:** 60 minutos entre cambios

### Weekly → Notificación [WEEK AHEAD]

- **Automático:** Cada domingo 18:00 Europe/Madrid
- **Manual:** `POST /api/jobs/weekly` con `X-INGEST-KEY` o `CRON_TOKEN`

## Mapeo de Proveedores

### CPI (BLS/TradingEconomics)
```json
{
  "id_fuente": "bls_2025-01_cpi_mom",
  "fuente": "BLS",
  "tema": "Inflación",
  "titulo": "CPI m/m (oct)",
  "impacto": "high",
  "valor_publicado": 0.5,
  "valor_esperado": 0.3
}
```

### PMI (S&P Global)
```json
{
  "id_fuente": "spglobal_pmi_manu_2025-01",
  "fuente": "S&P Global",
  "tema": "Crecimiento",
  "titulo": "PMI Manufacturas (nov, flash)",
  "impacto": "high",
  "valor_publicado": 49.0,
  "valor_esperado": 50.0
}
```

### NFP (BLS/ForexFactory)
```json
{
  "id_fuente": "bls_nfp_2025-01",
  "fuente": "BLS",
  "tema": "Crecimiento",
  "titulo": "Nonfarm Payrolls (oct)",
  "impacto": "high",
  "valor_publicado": 150000,
  "valor_esperado": 175000
}
```

## Backfill Histórico

**IMPORTANTE:** Antes de cargar histórico masivo:

1. Desactivar notificaciones:
```bash
ENABLE_TELEGRAM_NOTIFICATIONS=false
```

2. Cargar datos históricos (sin notificar)

3. Reactivar:
```bash
ENABLE_TELEGRAM_NOTIFICATIONS=true
```

## Troubleshooting

### Error 500 en `/api/notifications/status`

- Verificar que las tablas existen (se crean automáticamente)
- Revisar logs del servidor
- Verificar que `TELEGRAM_BOT_TOKEN` y `TELEGRAM_CHAT_ID` están configurados

### Notificaciones no se envían

1. Verificar `ENABLE_TELEGRAM_NOTIFICATIONS=true`
2. Verificar `bot_ok: true` y `chat_ok: true` en status
3. Revisar logs: `[TELEGRAM]` en consola
4. Verificar rate limit (10 msg/min)

### Weekly no se ejecuta

1. Verificar `ENABLE_WEEKLY_SCHEDULER=true` (o no estar en false)
2. Verificar que el proceso es persistente (no se duerme)
3. Si se duerme, usar cron externo:
```bash
# Cada domingo 18:00 Madrid (17:00 UTC en invierno, 16:00 UTC en verano)
0 17 * * 0 curl -X POST https://tu-dominio.com/api/jobs/weekly \
  -H "X-INGEST-KEY: tu_secreto"
```

## Seguridad

### INGEST_KEY - OBLIGATORIO

⚠️ **El sistema NO funcionará sin `INGEST_KEY` configurado.**

1. **Generar secreto:**
```bash
# Opción 1: OpenSSL
openssl rand -hex 32

# Opción 2: Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

2. **Configurar en `.env.local`:**
```bash
INGEST_KEY=Trading11!
```

3. **Verificar carga:**
Al arrancar el servidor, debe aparecer:
```
[security] INGEST_KEY loaded: true
```

Si aparece `false`, el sistema rechazará todas las peticiones a endpoints de ingesta.

4. **Uso en producción:**
- **NUNCA** expongas `INGEST_KEY` en el cliente
- Usa HTTPS en producción
- Rota `INGEST_KEY` periódicamente
- Limita IPs de origen si es posible (a nivel de infraestructura)

5. **Fallback desarrollo:**
En desarrollo (`NODE_ENV !== 'production'`), si `ENABLE_TELEGRAM_TESTS=true`, puedes usar `CRON_TOKEN` como alternativa temporal. **Esto NO funciona en producción.**

---

*Última actualización: Enero 2025*

