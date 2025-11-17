# 🧪 Guía de Pruebas - Notificaciones Telegram

## 🚀 Inicio Rápido

**Ejecutar test completo (recomendado):**
```bash
npm run test:notifs
```

Con variables personalizadas:
```bash
ING='TU_SECRETO' npm run test:notifs
BASE='https://tu-servidor.com' ING='TU_SECRETO' npm run test:notifs
```

El script valida automáticamente:
- ✅ Status del sistema (bot_ok, chat_ok, ingest_key_loaded)
- ✅ Weekly notification (con idempotencia)
- ✅ News insert ([NEW] en Telegram)
- ✅ Recent notifications actualizado

---

## Prerequisitos

1. **Variables de entorno configuradas:**
```bash
TELEGRAM_BOT_TOKEN=<token_real>
TELEGRAM_CHAT_ID=<id_real>
ENABLE_TELEGRAM_NOTIFICATIONS=true
INGEST_KEY=<tu_secreto>
TIMEZONE=Europe/Madrid
DELTA_INFL_PP=0.2
NARRATIVE_COOLDOWN_MINUTES=60
```

2. **Servidor corriendo:**
```bash
pnpm dev
```

## Test 1: Noticia Nueva → [NEW]

### ⚠️ Importante: Shell Quirks (zsh)

**Problema:** En zsh, el carácter `!` dentro de comillas dobles `"` causa problemas de interpretación.

**Solución:** Usa comillas simples `'` para headers y datos, o formato de una sola línea.

### Comando (Opción Segura - Comillas Simples):
```bash
curl -X POST 'http://localhost:3000/api/news/insert' \
  -H 'X-INGEST-KEY: Trading11!' \
  -H 'Content-Type: application/json' \
  --data '{"id_fuente":"bls_2025-11_cpi_mom","fuente":"BLS","pais":"US","tema":"Inflación","titulo":"CPI m/m (oct)","impacto":"high","published_at":"2025-11-10T13:30:00Z","valor_publicado":0.5,"valor_esperado":0.3,"resumen":"Por encima del consenso."}'
```

### Comando Alternativo (Una Sola Línea):
```bash
curl -X POST 'http://localhost:3000/api/news/insert' -H 'X-INGEST-KEY: Trading11!' -H 'Content-Type: application/json' --data '{"id_fuente":"bls_2025-11_cpi_mom","fuente":"BLS","pais":"US","tema":"Inflación","titulo":"CPI m/m (oct)","impacto":"high","published_at":"2025-11-10T13:30:00Z","valor_publicado":0.5,"valor_esperado":0.3,"resumen":"Por encima del consenso."}'
```

### Respuesta esperada:
```json
{
  "success": true,
  "inserted": true,
  "notified": true
}
```

### Verificación:
- ✅ Mensaje `[NEW]` en Telegram
- ✅ Hora mostrada en Europe/Madrid
- ✅ Formato: `[NEW] US/Inflación — CPI m/m (oct)`

### Deduplicación:
Repite el mismo comando → `"notified": false` (no reenvía en 2h)

---

## Test 2: Cambio de Narrativa → [NARRATIVA]

### Disparador:
Con el payload anterior (delta = 0.5 - 0.3 = 0.2pp ≥ DELTA_INFL_PP):
- Tema: "Inflación"
- Delta: +0.2pp
- Debe disparar: `INFLACION_ARRIBA`

### Verificación:
- ✅ Mensaje `[NARRATIVA] → INFLACION_ARRIBA` en Telegram
- ✅ Aparece automáticamente después de insertar la noticia

### Cooldown:
Si no aparece, puede estar en cooldown (60 min). Verifica:
```bash
curl http://localhost:3000/api/notifications/status | jq '.currentNarrative'
```

### Forzar cambio (si está en cooldown):
Espera 60 minutos o ajusta `NARRATIVE_COOLDOWN_MINUTES=0` temporalmente.

---

## Test 3: Weekly Ahead → [WEEK AHEAD]

### Comando (Usar Comillas Simples):
```bash
curl -X POST 'http://localhost:3000/api/jobs/weekly' \
  -H 'X-INGEST-KEY: Trading11!' \
  -H 'Content-Type: application/json' \
  --data '{}'
```

### Respuesta esperada:
```json
{
  "success": true,
  "eventCount": 0,
  "message": "Weekly ahead notification sent"
}
```

### Verificación:
- ✅ Mensaje `[WEEK AHEAD]` en Telegram
- ✅ ≤10 líneas o "Sin eventos high/med la próxima semana"

### Idempotencia:
Repite el mismo comando → `"error": "Already sent this week"` (no reenvía)

---

## Test 4: Script Automatizado (Recomendado)

### Cómo Ejecutar el Test End-to-End

**Opción 1: Usando npm (Recomendado)**
```bash
# Local (usa valores por defecto: http://localhost:3000, Trading11!)
npm run test:notifs

# Con variables personalizadas
ING='TU_SECRETO' npm run test:notifs

# Remoto
BASE='https://tu-servidor.com' ING='TU_SECRETO' npm run test:notifs
```

**Opción 2: Ejecutar directamente**
```bash
# Configurar variables
export BASE='http://localhost:3000'
export ING='Trading11!'

# Ejecutar
./scripts/test_notifications.sh
```

### Qué Valida el Script

1. **Status Check:**
   - ✅ HTTP 200
   - ✅ `bot_ok: true`
   - ✅ `chat_ok: true`
   - ✅ `ingest_key_loaded: true`

2. **Weekly Test:**
   - ✅ HTTP 200/201
   - ✅ Idempotencia (si ya enviado esta semana, no falla)

3. **News Insert:**
   - ✅ HTTP 200/201
   - ✅ `notified: true` (envía [NEW] a Telegram)
   - ✅ Payload único (timestamp) para evitar deduplicación

4. **Final Status:**
   - ✅ Muestra `recentNotifications` actualizado
   - ✅ Confirma que la notificación fue registrada

### Resultados Esperados

**Éxito:**
```
✅ All tests completed!
Check your Telegram for:
  - [NEW] message (should arrive)
  - [NARRATIVA] message (if delta ≥ 0.2pp and no cooldown)
  - [WEEK AHEAD] message (if weekly was sent)
```

**Si falla:**
- HTTP 401/403 → Revisar `ING` / `INGEST_KEY`
- HTTP 404 → Revisar `BASE` URL
- HTTP 500 → Revisar logs del servidor y `/api/notifications/status`

### Notas Importantes

- **Shell Quirks:** El script usa bash y comillas simples, evitando problemas con zsh y `!`
- **Deduplicación:** El script genera `id_fuente` único con timestamp para evitar dedupe
- **Cooldown:** Si hay cooldown de narrativa activo, no se considera fallo que no llegue [NARRATIVA]
- **Idempotencia:** El weekly es idempotente; si ya se envió esta semana, espera 200 con "no action"

---

## Pruebas en Admin

### Acceso al Panel

1. Navegar a `/admin/notifications`
2. El panel carga automáticamente el estado y últimos envíos
3. Se actualiza cada 30 segundos

### Probar Acciones

**Enviar Test:**
1. Click en "Enviar Test"
2. Esperar toast de éxito/error
3. Verificar mensaje en Telegram

**Enviar Weekly:**
1. Click en "Enviar Weekly"
2. Si ya se envió esta semana, mostrará "Already sent this week"
3. Si no, enviará el weekly y mostrará toast de éxito

**Enviar Digest:**
1. Click en "Enviar Digest"
2. Si ya se envió hoy, mostrará "Already sent today"
3. Si no, enviará el digest y mostrará toast de éxito

### Usar Filtros

**Por Tipo:**
- Seleccionar tipos deseados (NEW, NARR, WE, DIG)
- La tabla se actualiza automáticamente

**Por Rango:**
- **Hoy:** Solo notificaciones de hoy
- **24h:** Últimas 24 horas
- **7d:** Últimos 7 días
- **Custom:** Seleccionar fechas manualmente

**Paginación:**
- Cambiar tamaño de página (25/50)
- Navegar con offset (próxima versión)

### Interpretar History

**Columnas:**
- **Hora (Madrid):** Hora local de creación
- **Tipo:** NEW (noticia), NARR (narrativa), WE (weekly), DIG (digest)
- **Título:** Primera línea del mensaje (truncado)
- **Status:** `sent` (verde), `failed` (rojo), `queued` (amarillo)
- **Razón:** Mensaje de error si `status=failed`

**Casos Comunes:**
- `status=sent` + `tipo=news` → Noticia enviada correctamente
- `status=failed` + `error=rate limit` → Rate limit activo
- `status=failed` + `error=chat not found` → Chat ID inválido

### Ajustar Parámetros

1. Editar valores en el formulario
2. Verificar rangos (mostrados debajo de cada campo)
3. Click en "Guardar Parámetros"
4. Verificar toast de éxito
5. Los cambios se aplican inmediatamente

**Nota:** Algunos parámetros requieren reinicio del servidor para aplicar completamente (ej: `GLOBAL_RATE_LIMIT_PER_MIN`).

---

## Shell Quirks y Mejores Prácticas

### Problema con zsh y `!`

En zsh (y algunos otros shells), el carácter `!` dentro de comillas dobles `"` puede causar problemas de interpretación histórica.

**Reglas:**
- ❌ **NO usar:** `"X-INGEST-KEY: Trading11!"` (comillas dobles con `!`)
- ✅ **Usar:** `'X-INGEST-KEY: Trading11!'` (comillas simples)
- ✅ **Alternativa:** Formato de una sola línea sin `\`
- ✅ **Alternativa:** Heredoc o archivo JSON externo

### Opción Segura Definitiva (Funciona Siempre)

```bash
# Comillas simples para todo
curl -X POST 'http://localhost:3000/api/news/insert' \
  -H 'X-INGEST-KEY: Trading11!' \
  -H 'Content-Type: application/json' \
  --data '{"id_fuente":"test_001","fuente":"Test","pais":"US","tema":"Inflación","titulo":"Test CPI","impacto":"high","published_at":"2025-01-10T13:30:00Z","valor_publicado":0.5,"valor_esperado":0.3}'
```

### Usar Archivo JSON (Para Payloads Largos)

```bash
# Crear archivo payload.json
cat > payload.json << 'EOF'
{
  "id_fuente": "bls_2025-11_cpi_mom",
  "fuente": "BLS",
  "pais": "US",
  "tema": "Inflación",
  "titulo": "CPI m/m (oct)",
  "impacto": "high",
  "published_at": "2025-11-10T13:30:00Z",
  "valor_publicado": 0.5,
  "valor_esperado": 0.3,
  "resumen": "Por encima del consenso."
}
EOF

# Usar archivo
curl -X POST 'http://localhost:3000/api/news/insert' \
  -H 'X-INGEST-KEY: Trading11!' \
  -H 'Content-Type: application/json' \
  --data @payload.json
```

### Nota Importante

**El backend NO tiene problemas.** El sistema funciona 100% correctamente. Solo el formato del comando en el shell puede causar problemas si usas comillas dobles con `!`.

---

## Troubleshooting

### Nada llega a Telegram

1. **Verificar status:**
```bash
curl http://localhost:3000/api/notifications/status
```

Debe mostrar:
- `bot_ok: true`
- `chat_ok: true`
- `enabled: true`

2. **Verificar logs del servidor:**
```bash
# Buscar errores
grep -i "error\|failed" logs
```

3. **Verificar recentNotifications:**
```bash
curl http://localhost:3000/api/notifications/status | jq '.recentNotifications'
```

Debe mostrar las notificaciones enviadas.

### Duplicados

- Hay deduplicación por `(fuente, id_fuente)` en ventana de 2 horas
- Si envías el mismo `id_fuente` dos veces en <2h, solo se notifica la primera

### Sin narrativa

1. **Verificar DELTA_INFL_PP:**
```bash
echo $DELTA_INFL_PP  # Debe ser 0.2
```

2. **Verificar valores:**
- `valor_publicado` y `valor_esperado` deben estar presentes
- Delta = `valor_publicado - valor_esperado`
- Para inflación: delta ≥ 0.2pp → `INFLACION_ARRIBA`

3. **Verificar cooldown:**
```bash
curl http://localhost:3000/api/notifications/status | jq '.currentNarrative'
```

Si hay cooldown activo, espera 60 minutos.

---

## Integración con Pipeline Real

Una vez que los tests funcionen, tu pipeline solo necesita:

```bash
# Por cada noticia real (usar comillas simples o variable)
curl -X POST 'https://tu-servidor.com/api/news/insert' \
  -H "X-INGEST-KEY: ${INGEST_KEY}" \
  -H 'Content-Type: application/json' \
  --data '{"id_fuente":"proveedor_fecha_indicador","fuente":"Proveedor","pais":"US","tema":"Inflación","titulo":"CPI m/m","impacto":"high","published_at":"2025-01-10T13:30:00Z","valor_publicado":0.5,"valor_esperado":0.3}'
```

**Nota:** En scripts, puedes usar variables de entorno con comillas dobles para `${INGEST_KEY}`, pero asegúrate de que el valor no contenga `!` o usa comillas simples alrededor de la variable.

El sistema automáticamente:
- ✅ Envía `[NEW]` a Telegram
- ✅ Procesa para narrativa (si aplica)
- ✅ Envía `[NARRATIVA]` si hay cambio
- ✅ Programa `[WEEK AHEAD]` cada domingo 18:00 Madrid

---

*Última actualización: Enero 2025*

