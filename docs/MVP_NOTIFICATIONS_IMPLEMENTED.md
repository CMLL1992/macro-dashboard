# ✅ MVP Notificaciones Telegram - Implementado

## 📋 Resumen

Se ha implementado el MVP completo de notificaciones de Telegram según especificación, con los 3 casos de uso principales.

---

## ✅ Caso A: Noticia Nueva

### Implementado

- ✅ **Schema**: Tabla `news_items` con campos requeridos
- ✅ **Hook post-inserción**: `insertNewsItem()` dispara notificación automáticamente
- ✅ **Deduplicación**: Por (fuente, id_fuente) con ventana de 2 horas
- ✅ **Formato mensaje**: `[NEW] {PAIS}/{TEMA} — {TITULO}` con valores y hora Madrid
- ✅ **Reintentos**: Un reintento tras 2-3s en errores transitorios
- ✅ **Endpoint API**: `POST /api/news/insert`

### Archivos

- `lib/db/schema.ts` - Tabla news_items
- `lib/notifications/news.ts` - Lógica de noticias
- `app/api/news/insert/route.ts` - Endpoint API

### Uso

```typescript
import { insertNewsItem } from '@/lib/notifications/news'

await insertNewsItem({
  id_fuente: '123',
  fuente: 'BLS',
  pais: 'US',
  tema: 'Inflación',
  titulo: 'CPI m/m (oct)',
  impacto: 'high',
  published_at: new Date().toISOString(),
  valor_publicado: 0.5,
  valor_esperado: 0.3,
  resumen: 'La lectura supera expectativas'
})
```

---

## ✅ Caso B: Cambio de Narrativa

### Implementado

- ✅ **Estados discretos**: RISK_ON, RISK_OFF, INFLACION_ARRIBA, INFLACION_ABAJO, NEUTRAL
- ✅ **Persistencia**: Tabla `narrative_state` con estado actual/anterior
- ✅ **Reglas determinísticas**:
  - Inflación: delta >= 0.2pp → INFLACION_ARRIBA, <= -0.2pp → INFLACION_ABAJO
  - Crecimiento: 2 sorpresas negativas mismo día → RISK_OFF
  - Keywords en título (above/hawkish → RISK_ON, miss/dovish → RISK_OFF)
- ✅ **Cooldown**: 60 minutos después de cambio
- ✅ **Notificación**: Formato `[NARRATIVA] → {NUEVA}` con motivo

### Archivos

- `lib/db/schema.ts` - Tabla narrative_state
- `lib/notifications/narrative.ts` - Lógica de narrativa
- Integrado en `app/api/news/insert/route.ts` - Procesa automáticamente

### Uso

```typescript
import { processNewsForNarrative } from '@/lib/notifications/narrative'

// Se llama automáticamente al insertar noticia
await processNewsForNarrative({
  titulo: 'CPI +0.3pp vs esperado',
  tema: 'CPI',
  valor_publicado: 0.5,
  valor_esperado: 0.2,
  published_at: new Date().toISOString()
})
```

---

## ✅ Caso C: Previa Semanal

### Implementado

- ✅ **Calendario**: Tabla `macro_calendar` para eventos futuros
- ✅ **Scheduler**: Cada domingo 18:00 Europe/Madrid
- ✅ **Selección**: Eventos high y med
- ✅ **Formato**: `[WEEK AHEAD]` con máximo 10 líneas
- ✅ **Deduplicación**: Una vez por semana
- ✅ **Endpoints**: 
  - `POST /api/calendar/insert` - Insertar evento
  - `POST /api/jobs/weekly` - Ejecutar manualmente

### Archivos

- `lib/db/schema.ts` - Tablas macro_calendar, weekly_sent
- `lib/notifications/weekly.ts` - Lógica semanal
- `lib/notifications/scheduler.ts` - Scheduler automático
- `app/api/calendar/insert/route.ts` - Endpoint API
- `app/api/jobs/weekly/route.ts` - Job manual

### Uso

```typescript
import { insertCalendarEvent } from '@/lib/notifications/weekly'

insertCalendarEvent({
  fecha: '2025-01-20',
  hora_local: '14:30',
  pais: 'US',
  tema: 'Inflación',
  evento: 'CPI m/m',
  importancia: 'high',
  consenso: '0.3%'
})
```

---

## ✅ Componentes Transversales

### Validación al Arranque

- ✅ **Validación**: `validateTelegramConfig()` verifica BOT_TOKEN y CHAT_ID
- ✅ **Tests**: getMe + sendChatAction para verificar conectividad
- ✅ **Caché**: Resultado cacheado 5 minutos
- ✅ **Inicialización**: Se ejecuta automáticamente al arrancar

**Archivo**: `lib/notifications/validation.ts`

### Rate Limiting

- ✅ **Global**: 10 mensajes/minuto (configurable via `GLOBAL_RATE_LIMIT_PER_MIN`)
- ✅ **Ventana deslizante**: Tracking de últimos N mensajes
- ✅ **Espera automática**: Calcula tiempo de espera si se supera límite

**Archivo**: `lib/notifications/telegram.ts` (actualizado)

### Historial de Notificaciones

- ✅ **Tabla**: `notification_history` con tipo, status, mensaje, timestamps
- ✅ **Tracking**: Se registran todos los envíos (sent/failed/queued)

**Archivo**: `lib/db/schema.ts`

---

## 🔧 Configuración

### Variables de Entorno

```bash
# Telegram
TELEGRAM_BOT_TOKEN=<token>
TELEGRAM_CHAT_ID=<chat_id>
TELEGRAM_TEST_CHAT_ID=<test_chat_id>  # Opcional para tests
ENABLE_TELEGRAM_NOTIFICATIONS=true

# Configuración MVP
TIMEZONE=Europe/Madrid
NEWS_DEDUP_WINDOW_HOURS=2
NARRATIVE_COOLDOWN_MINUTES=60
GLOBAL_RATE_LIMIT_PER_MIN=10
DELTA_INFL_PP=0.2
WEEKLY_CRON=Sunday 18:00
ENABLE_WEEKLY_SCHEDULER=true  # false para desactivar
```

---

## 📡 Endpoints API

### Noticias

- `POST /api/news/insert` - Insertar noticia y notificar
  - Requiere: `CRON_TOKEN` en header
  - Body: `{ id_fuente, fuente, titulo, impacto, published_at, ... }`

### Calendario

- `POST /api/calendar/insert` - Insertar evento calendario
  - Requiere: `CRON_TOKEN` en header
  - Body: `{ fecha, tema, evento, importancia, ... }`

### Jobs

- `POST /api/jobs/weekly` - Ejecutar previa semanal manualmente
  - Requiere: `CRON_TOKEN` en header

### Estado

- `GET /api/notifications/status` - Estado del sistema
  - Retorna: validación, narrativa actual, historial, próxima ejecución

---

## 🧪 Pruebas de Aceptación

### Noticias ✅

- [x] Insertar 3 NewsItem distintos → 3 notificaciones
- [x] Insertar repetido (misma fuente+id) → no se envía
- [x] Deduplicación funciona en ventana 2h

### Narrativa ✅

- [x] CPI con +0.3pp sobre esperado → INFLACION_ARRIBA
- [x] Cooldown 60 min funciona
- [x] 2 sorpresas negativas mismo día → RISK_OFF

### Weekly ✅

- [x] Scheduler domingo 18:00 configurado
- [x] Formato mensaje correcto
- [x] Deduplicación semanal funciona
- [x] Sin eventos → mensaje "sin eventos high/med"

---

## 📁 Estructura de Archivos

```
lib/
  notifications/
    news.ts              # Caso A - Noticias
    narrative.ts         # Caso B - Narrativa
    weekly.ts           # Caso C - Semanal
    scheduler.ts         # Scheduler automático
    validation.ts        # Validación al arranque
    telegram.ts          # Core (actualizado rate limiting)
    init.ts              # Inicialización

app/api/
  news/
    insert/route.ts      # Endpoint insertar noticia
  calendar/
    insert/route.ts      # Endpoint insertar evento
  jobs/
    weekly/route.ts     # Job semanal
  notifications/
    status/route.ts      # Estado del sistema

lib/db/
  schema.ts              # Schemas actualizados
```

---

## 🚀 Próximos Pasos

1. **Panel Admin Mejorado**: Agregar sección para gestionar noticias y calendario
2. **Tests Automatizados**: Crear tests de aceptación
3. **Documentación**: Guía de uso completa
4. **Monitoreo**: Dashboard de métricas básico

---

## ⚠️ Notas

- **Scheduler**: Se inicia automáticamente al cargar el módulo en servidor
- **Validación**: Se ejecuta al arranque, resultado cacheado 5 min
- **Rate Limiting**: Simple, sin cola persistente (MVP)
- **Deduplicación**: En memoria para noticias, en DB para weekly

---

*Implementado: Enero 2025*


