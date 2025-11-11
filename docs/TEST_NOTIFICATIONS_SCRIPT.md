# 🧪 Script de Pruebas - Notificaciones Telegram

## Descripción

Script "a prueba de balas" para validar el sistema completo de notificaciones Telegram.

**Ubicación:** `scripts/test_notifications.sh`

## Uso

### Básico
```bash
npm run test:notifs
```

### Con Variables Personalizadas
```bash
# Local con INGEST_KEY personalizado
ING='TU_SECRETO' npm run test:notifs

# Remoto
BASE='https://tu-servidor.com' ING='TU_SECRETO' npm run test:notifs
```

### Ejecutar Directamente
```bash
./scripts/test_notifications.sh
```

## Variables de Entorno

| Variable | Por Defecto | Descripción |
|----------|-------------|-------------|
| `BASE` | `http://localhost:3000` | URL base del servidor |
| `ING` o `INGEST_KEY` | `Trading11!` | Clave de autenticación para ingest |

## Qué Valida

### 1. Status Check
- ✅ HTTP 200
- ✅ `bot_ok: true`
- ✅ `chat_ok: true`
- ✅ `ingest_key_loaded: true`

**Si falla:** El sistema no está configurado correctamente.

### 2. Weekly Test
- ✅ HTTP 200/201 (envío exitoso)
- ✅ HTTP 500 con "Already sent this week" (idempotencia OK)

**Si falla:** Revisar logs del servidor.

### 3. News Insert
- ✅ HTTP 200/201
- ✅ `notified: true` (envía [NEW] a Telegram)
- ✅ Payload único con timestamp para evitar deduplicación

**Si falla:** Revisar autenticación (INGEST_KEY) o logs del servidor.

### 4. Final Status
- ✅ Muestra `recentNotifications` actualizado
- ✅ Confirma que la notificación fue registrada

## Salida del Script

### Éxito
```
🧪 Testing Telegram Notifications
==================================
Base URL: http://localhost:3000
Using INGEST_KEY: Trading1...

==> Comprobando status...
✅ Success
✅ Status OK: bot_ok=true, chat_ok=true, ingest_key_loaded=true

==> Probando WEEKLY (manual)...
✅ Weekly idempotency working (already sent this week)

==> Insertando CPI (NEW + posible NARRATIVA)...
✅ Success
✅ News notification sent to Telegram

==> Estado final (recentNotifications)...
✅ Success
Recent notifications (first 3):
[...]

==================================
✅ All tests completed!

Check your Telegram for:
  - [NEW] message (should arrive)
  - [NARRATIVA] message (if delta ≥ 0.2pp and no cooldown)
  - [WEEK AHEAD] message (if weekly was sent)

Unique test ID: test_1234567890
```

### Errores Comunes

**HTTP 401/403:**
```
❌ Failed with HTTP 401
💡 Tip: Check INGEST_KEY environment variable
```
→ Revisar variable `ING` o `INGEST_KEY`

**HTTP 404:**
```
❌ Failed with HTTP 404
💡 Tip: Check BASE URL (currently: http://localhost:3000)
```
→ Revisar variable `BASE` o que el servidor esté corriendo

**HTTP 500:**
```
❌ Failed with HTTP 500
💡 Tip: Check server logs and /api/notifications/status
```
→ Revisar logs del servidor y estado del sistema

## Características del Script

### ✅ A Prueba de Balas

1. **Shell Compatible:**
   - Usa `#!/usr/bin/env bash` (no depende de zsh)
   - `set -euo pipefail` para manejo estricto de errores
   - Comillas simples para evitar problemas con `!`

2. **Payload Único:**
   - Genera `id_fuente` con timestamp: `test_<timestamp>`
   - Evita deduplicación entre ejecuciones

3. **Manejo de Errores:**
   - Muestra códigos HTTP claros
   - Tips específicos según tipo de error
   - Exit codes apropiados

4. **Idempotencia:**
   - Weekly puede retornar 500 si ya se envió (OK)
   - No falla si hay cooldown de narrativa

5. **Salida Clara:**
   - Bloques separados por paso
   - Códigos HTTP visibles
   - JSON formateado (si jq disponible)

## Integración CI/CD

### GitHub Actions

El workflow `.github/workflows/test-notifications.yml` ejecuta automáticamente:

- En push a `main` (si cambian archivos de notificaciones)
- En `workflow_dispatch` (manual)
- **NO** en PRs externos (seguridad)

**Secrets requeridos:**
- `NOTIFICATIONS_TEST_BASE_URL` (opcional, default: localhost)
- `NOTIFICATIONS_TEST_INGEST_KEY` (requerido)

## Troubleshooting

### Script no ejecuta

```bash
# Verificar permisos
chmod +x scripts/test_notifications.sh

# Verificar sintaxis
bash -n scripts/test_notifications.sh
```

### jq no disponible

El script funciona sin `jq`, pero la salida será menos formateada. Para instalar:

```bash
# macOS
brew install jq

# Linux
apt-get install jq  # o yum install jq
```

### Finales de Línea

El script usa LF (Unix). Si tienes problemas en Windows:

```bash
# Verificar
file scripts/test_notifications.sh

# Convertir (si necesario)
dos2unix scripts/test_notifications.sh
```

## Criterios de Aceptación

✅ `npm run test:notifs` devuelve `exit 0`  
✅ Muestra `[http 200]` en status  
✅ Muestra `[http 2xx]` en weekly y news  
✅ Telegram recibe al menos `[NEW]`  
✅ `/api/notifications/status` refleja la notificación en `recentNotifications`

---

*Última actualización: Enero 2025*


