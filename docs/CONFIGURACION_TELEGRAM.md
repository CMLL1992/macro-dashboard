# 📱 Configuración de Notificaciones Telegram

## Variables de Entorno Requeridas

Crea un archivo `.env.local` en la raíz del proyecto con las siguientes variables:

```bash
# Telegram Notifications Configuration
# ====================================

# Bot Token (obligatorio)
# Obtener de @BotFather en Telegram
TELEGRAM_BOT_TOKEN=tu_bot_token_aqui

# Chat ID (obligatorio)
# Obtener enviando mensaje a tu bot y visitando:
# https://api.telegram.org/bot<TOKEN>/getUpdates
TELEGRAM_CHAT_ID=tu_chat_id_aqui

# Habilitar notificaciones
ENABLE_TELEGRAM_NOTIFICATIONS=true

# Chat ID para tests (opcional)
# Usar un chat diferente para pruebas
TELEGRAM_TEST_CHAT_ID=tu_test_chat_id_aqui

# Habilitar modo test (opcional)
# Si está en true, siempre usa TELEGRAM_TEST_CHAT_ID
ENABLE_TELEGRAM_TESTS=false

# Timezone (opcional, por defecto Europe/Madrid)
TIMEZONE=Europe/Madrid

# Ingest Key (opcional, para producción)
# Clave secreta para autenticar inserción de noticias/eventos
INGEST_KEY=tu_ingest_key_secreta_aqui

# Rate Limiting (opcional)
# Mensajes por minuto (por defecto 10)
GLOBAL_RATE_LIMIT_PER_MIN=10

# Configuración de Notificaciones (opcional)
# Ventana de deduplicación de noticias (horas)
NEWS_DEDUP_WINDOW_HOURS=2

# Cooldown de narrativa (minutos)
NARRATIVE_COOLDOWN_MINUTES=60

# Delta para cambio de narrativa de inflación (puntos porcentuales)
DELTA_INFL_PP=0.2

# Scheduler (opcional)
# Habilitar scheduler semanal automático
ENABLE_WEEKLY_SCHEDULER=true

# Habilitar digest diario (opcional)
ENABLE_DAILY_DIGEST=false

# CRON Token (para jobs protegidos)
CRON_TOKEN=tu_cron_token_secreto_aqui

# App URL (para jobs)
APP_URL=http://localhost:3000
```

## Cómo Obtener las Credenciales

### 1. Obtener Bot Token

1. Abre Telegram y busca `@BotFather`
2. Envía `/newbot` y sigue las instrucciones
3. Copia el token que te proporciona (formato: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)

### 2. Obtener Chat ID

**Opción A: Chat privado**
1. Envía un mensaje a tu bot
2. Visita: `https://api.telegram.org/bot<TOKEN>/getUpdates`
3. Busca `"chat":{"id":` en la respuesta
4. El número después de `"id":` es tu Chat ID

**Opción B: Grupo/Canal**
1. Añade el bot al grupo/canal
2. Hazlo administrador (si es canal)
3. Envía un mensaje en el grupo/canal
4. Visita: `https://api.telegram.org/bot<TOKEN>/getUpdates`
5. Busca el `chat.id` (puede ser negativo para grupos)

## Verificación

Una vez configurado, ejecuta:

```bash
tsx scripts/verify-notifications.ts
```

Esto verificará:
- ✅ Inicialización del sistema
- ✅ Configuración de Telegram
- ✅ Tablas de base de datos
- ✅ Narrativa actual
- ✅ Noticias y eventos
- ✅ Variables de entorno

## Pruebas

### Insertar Noticia de Prueba

```bash
./scripts/test-insert-news.sh
```

### Insertar Evento de Calendario

```bash
./scripts/test-insert-calendar.sh
```

### Verificar Estado

```bash
curl http://localhost:3000/api/notifications/status
```

## Endpoints API

### Insertar Noticia

```bash
curl -X POST http://localhost:3000/api/news/insert \
  -H "X-INGEST-KEY: tu_ingest_key" \
  -H "Content-Type: application/json" \
  -d '{
    "id_fuente": "123",
    "fuente": "BLS",
    "pais": "US",
    "tema": "Inflación",
    "titulo": "CPI m/m (oct)",
    "impacto": "high",
    "published_at": "2025-11-12T14:30:00Z",
    "valor_publicado": 0.5,
    "valor_esperado": 0.3
  }'
```

### Insertar Evento Calendario

```bash
curl -X POST http://localhost:3000/api/calendar/insert \
  -H "X-INGEST-KEY: tu_ingest_key" \
  -H "Content-Type: application/json" \
  -d '{
    "fecha": "2025-11-20",
    "hora_local": "14:30",
    "pais": "US",
    "tema": "Inflación",
    "evento": "CPI m/m",
    "importancia": "high",
    "consenso": "0.3%"
  }'
```

### Ejecutar Previa Semanal Manualmente

```bash
curl -X POST http://localhost:3000/api/jobs/weekly \
  -H "Authorization: Bearer tu_cron_token"
```





