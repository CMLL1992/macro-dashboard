# Guía de Pruebas - Alertas de Telegram

## 🔒 Seguridad

**IMPORTANTE**: El token del bot quedó expuesto en el historial. **Debes rotarlo inmediatamente**:

1. Ve a [@BotFather](https://t.me/botfather) en Telegram
2. Ejecuta `/revoke` o `/newtoken` para generar un nuevo token
3. Actualiza `TELEGRAM_BOT_TOKEN` en `.env`

## 📋 Variables de Entorno

### Producción
```bash
TELEGRAM_BOT_TOKEN=<nuevo_token>
TELEGRAM_CHAT_ID=1156619610
ENABLE_TELEGRAM_NOTIFICATIONS=true
ENABLE_USD_REGIME_ALERTS=true
ENABLE_CORR_ALERTS=true
ENABLE_MACRO_RELEASE_ALERTS=true
```

### Desarrollo/Testing
```bash
# Añadir estas variables para pruebas
TELEGRAM_TEST_CHAT_ID=<tu_chat_id_de_pruebas>
ENABLE_TELEGRAM_TESTS=true
DRY_RUN_TELEGRAM=false  # true para solo loguear sin enviar
BYPASS_RATE_LIMIT_FOR_TESTS=true  # Permite enviar sin rate limit en tests
```

## 🧪 Endpoints de Prueba

### 1. Test Básico
```bash
POST /api/alerts/test
Authorization: Bearer <CRON_TOKEN>
```

**Respuesta exitosa:**
```json
{
  "success": true,
  "messageId": 12345,
  "timestamp": "2025-11-07T12:00:00.000Z",
  "env": "development",
  "message": "Test message sent successfully"
}
```

### 2. Simular Triggers
```bash
POST /api/alerts/simulate
Authorization: Bearer <CRON_TOKEN>
Content-Type: application/json

# Trigger A (USD)
{
  "type": "usd",
  "persist": false,
  "prevUSD": "Neutral",
  "currentUSD": "Débil",
  "regime": "Neutral",
  "score": -0.30,
  "latestDataDate": "2025-11-07",
  "categoryChips": "Test: 1 · Test: 2"
}

# Trigger B (Correlaciones)
{
  "type": "correlations",
  "persist": false,
  "correlations": [
    { "symbol": "EURUSD", "corr12m": 0.65, "corr3m": 0.70 }
  ]
}

# Trigger C (Macro)
{
  "type": "macro",
  "persist": false,
  "observations": [
    {
      "seriesId": "CPIAUCSL",
      "label": "CPI YoY",
      "value": 3.02,
      "valuePrevious": 3.08,
      "date": "2025-11-01",
      "datePrevious": "2025-10-01",
      "trend": "Mejora",
      "posture": "Dovish"
    }
  ]
}
```

## 🎯 Panel de Admin

Accede a `/admin` cuando `ENABLE_TELEGRAM_TESTS=true`.

**Características:**
- Botón "Enviar mensaje de prueba" - Envía mensaje inmediato al chat de pruebas
- Simulador de triggers - Prueba cada trigger sin afectar estado real
- Estado del sistema - Muestra configuración y flags activos

## ✅ Matriz de Pruebas Manuales

### Smoke Test
- [ ] `POST /api/alerts/test` → Mensaje llega al chat de pruebas
- [ ] Panel `/admin` muestra "Modo TEST activo"

### Trigger A (USD)
- [ ] Simular `Neutral → Débil` → Mensaje "Cambio USD" llega
- [ ] Repetir inmediatamente → Bloqueado por rate limit (o permitido con bypass)
- [ ] Primera ejecución (sin estado) → No envía, solo inicializa (ver logs)

### Trigger B (Correlaciones)
- [ ] Cambiar nivel `Media → Alta` para 1 símbolo → Mensaje llega
- [ ] >3 símbolos cambian → Mensaje agrupado llega
- [ ] Sin cambios → No envía

### Trigger C (Macro)
- [ ] Publicar CPI con `date > lastDate` → Mensaje "Nuevo dato macro" llega
- [ ] `date` igual o menor → No envía
- [ ] Series no críticas → Ignorar

### Feature Flags
- [ ] Desactivar `ENABLE_CORR_ALERTS` → Trigger B no envía
- [ ] Desactivar `ENABLE_TELEGRAM_NOTIFICATIONS` → Nada sale del sistema

### Errores Controlados
- [ ] Token inválido → Error log, respuesta 401/403, no crashea
- [ ] Rate limit activo → Respuesta clara, sin caída

## 🧪 Tests Automatizados

Ejecutar:
```bash
pnpm test tests/alerts/
```

**Cobertura:**
- ✅ Builders (plantillas de mensajes)
- ✅ State (cálculo de niveles, transiciones)
- ✅ Integración (dry-run mode)

## 📊 Observabilidad

**Logs estructurados:**
- `[TELEGRAM] Message sent successfully` - Envío exitoso
- `[TELEGRAM] Rate limit: wait Xs` - Rate limit activo
- `[TELEGRAM] DRY RUN - Would send:` - Modo dry-run
- `[alerts] Rate limit: skipping...` - Trigger respeta rate limit

**Métricas:**
- Último envío: `getLastMessageTime()` en `lib/notifications/telegram.ts`
- Estado actual: Ver en `/admin`

## 🛡️ Protección para Producción

**Endpoints de test:**
- ✅ Requieren autenticación (`CRON_TOKEN`)
- ✅ Rechazan en `NODE_ENV=production` salvo `ENABLE_TELEGRAM_TESTS=true`
- ✅ Requieren `TELEGRAM_TEST_CHAT_ID` en producción

**Panel de admin:**
- ✅ Solo visible si `ENABLE_TELEGRAM_TESTS=true`
- ✅ Muestra banner "Modo TEST activo"
- ✅ No expone tokens ni credenciales

## 🚀 Uso Rápido

1. **Configurar variables:**
   ```bash
   ENABLE_TELEGRAM_TESTS=true
   TELEGRAM_TEST_CHAT_ID=<tu_chat_id>
   ```

2. **Probar conexión:**
   - Ir a `/admin`
   - Clic en "Enviar mensaje de prueba"
   - Verificar mensaje en Telegram

3. **Simular triggers:**
   - Seleccionar tipo de trigger
   - Clic en "Simular trigger"
   - Verificar mensaje formateado en Telegram

4. **Desactivar antes de producción:**
   ```bash
   ENABLE_TELEGRAM_TESTS=false
   ```



