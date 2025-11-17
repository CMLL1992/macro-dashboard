# Mejoras en Inicialización y Validación

## Cambios Implementados

### 1. Inicialización Forzada

#### `ensureNotificationsInitialized()`
Nueva función exportada que garantiza que el sistema se inicialice antes de usar:

```typescript
export async function ensureNotificationsInitialized(): Promise<void> {
  if (!initialized) {
    await initializeNotifications()
  }
}
```

#### Uso en Endpoints
- ✅ `/api/notifications/status` - Llama a `ensureNotificationsInitialized()` antes de construir respuesta
- ✅ `/api/health` - Llama a `ensureNotificationsInitialized()` para forzar inicialización temprana

### 2. Validación Mejorada

#### Campos Nuevos en `ValidationResult`
```typescript
interface ValidationResult {
  valid: boolean
  bot_ok: boolean        // ✅ NUEVO: Estado explícito del bot
  chat_ok: boolean       // ✅ NUEVO: Estado explícito del chat
  errors: string[]
  warnings: string[]
  checked_at?: string   // ✅ NUEVO: Timestamp de la validación
}
```

#### Validación del Bot
- Llama a `getMe` API de Telegram
- Verifica que el token sea válido
- Marca `bot_ok = true` si responde OK
- Logs: `[validation] ✅ Bot token valid: <username>`

#### Validación del Chat
- Llama a `sendChatAction` con `action: 'typing'`
- Verifica que el bot tenga acceso al chat
- Maneja errores específicos:
  - `400`: Chat no encontrado o bot no es miembro
  - `403`: Bot bloqueado o sin permisos
- Marca `chat_ok = true` si responde OK
- Logs: `[validation] ✅ Chat ID valid: <chat_id>`

### 3. Respuesta del Status Endpoint

El endpoint `/api/notifications/status` ahora retorna:

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
  "currentNarrative": "NEUTRAL",
  "recentNotifications": [],
  "weeklyLastSent": null,
  "weekly_next_run": "2025-01-16T17:00:26.591Z",
  "enabled": true
}
```

## Variables de Entorno Requeridas

```bash
TELEGRAM_BOT_TOKEN=<token_real>
TELEGRAM_CHAT_ID=<id_real>
ENABLE_TELEGRAM_NOTIFICATIONS=true
TIMEZONE=Europe/Madrid
```

### Notas sobre Chat ID

- **Usuario**: Número positivo (ej: `123456789`)
  - Conseguir: Escribir al bot y leer `getUpdates`
  
- **Grupo/Canal**: Número negativo (ej: `-1001234567890`)
  - El bot debe ser miembro del grupo/canal

## Flujo de Inicialización

1. **Al arrancar el servidor:**
   - `lib/notifications/init.ts` se auto-inicializa (si `window === undefined`)
   - O se inicializa al llamar `/api/health` o `/api/notifications/status`

2. **Validación:**
   - Verifica `TELEGRAM_BOT_TOKEN` existe
   - Verifica `TELEGRAM_CHAT_ID` o `TELEGRAM_TEST_CHAT_ID` existe
   - Llama a `getMe` → `bot_ok = true/false`
   - Llama a `sendChatAction` → `chat_ok = true/false`
   - Calcula `valid = bot_ok && chat_ok && errors.length === 0`

3. **Scheduler:**
   - Solo se inicia si `ENABLE_TELEGRAM_NOTIFICATIONS === 'true'` y `valid === true`

## Logs de Inicialización

### Éxito:
```
[notifications] Initializing notifications system...
[validation] ✅ Bot token valid: <username>
[validation] ✅ Chat ID valid: <chat_id>
[notifications] ✅ Configuration valid
[notifications] Bot OK: true
[notifications] Chat OK: true
```

### Error:
```
[notifications] Initializing notifications system...
[notifications] ❌ Configuration invalid: [...]
[notifications] Bot OK: false
[notifications] Chat OK: false
[notifications] Notifications will be disabled
```

## Prueba Rápida de Credenciales

Para aislar problemas de credenciales, puedes probar directamente:

```bash
# Test bot token
curl "https://api.telegram.org/bot<TOKEN>/getMe"

# Test chat access
curl -X POST "https://api.telegram.org/bot<TOKEN>/sendChatAction" \
  -H "Content-Type: application/json" \
  -d '{"chat_id": "<CHAT_ID>", "action": "typing"}'
```

Si estos fallan, el problema es de credenciales/chat_id, no del código.

## Importante

⚠️ **Después de cambiar variables `.env`, reinicia el servidor**

Next.js no recarga variables de entorno en caliente. Debes reiniciar el proceso.

---

*Última actualización: Enero 2025*




