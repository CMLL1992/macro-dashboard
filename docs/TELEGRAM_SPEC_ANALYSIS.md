# 📋 Análisis: Especificación Funcional vs Código Actual

## 🎯 Resumen Ejecutivo

**Especificación recibida**: Sistema completo de notificaciones Telegram con 3 casos de uso (Noticia nueva, Cambio de narrativa, Previa semanal).

**Estado actual**: Sistema básico de Telegram implementado, pero **falta ~70% de la funcionalidad** requerida.

**Gap principal**: No existe infraestructura para NewsItem, narrativa con estados discretos, ni calendario macro.

---

## 📊 Comparativa Detallada

### ✅ Lo que YA existe

| Componente | Estado | Ubicación | Notas |
|------------|--------|-----------|-------|
| **Core Telegram** | ✅ Completo | `lib/notifications/telegram.ts` | Envío, rate limiting básico, dry-run, test mode |
| **Builders de mensajes** | ✅ Parcial | `lib/alerts/builders.ts` | Solo para USD/Corr/Macro releases actuales |
| **Estado persistente** | ✅ Básico | `lib/alerts/state.ts` | SQLite con fallback a memoria |
| **Triggers básicos** | ✅ Parcial | `lib/alerts/triggers.ts` | USD change, Correlation changes, Macro releases |
| **Panel Admin** | ✅ Básico | `/admin` | Solo pruebas, falta estado completo |
| **Tests** | ✅ Básico | `tests/alerts/` | Solo dry-run mode |

### ❌ Lo que FALTA (según especificación)

| Componente | Prioridad | Esfuerzo | Descripción |
|------------|-----------|----------|-------------|
| **NewsItem Entity** | 🔴 Crítico | Alto | Tabla y lógica para noticias nuevas |
| **Hook post-inserción** | 🔴 Crítico | Medio | Disparar notificación al insertar NewsItem |
| **Narrativa con estados discretos** | 🔴 Crítico | Alto | RISK_ON/OFF, INFLACION_ARRIBA/ABAJO, etc. |
| **Cálculo de narrativa** | 🔴 Crítico | Alto | Scores por eje, histeresis, cooldown |
| **Calendario macro** | 🟡 Importante | Medio | Tabla y gestión de eventos futuros |
| **Scheduler semanal** | 🟡 Importante | Medio | Job domingo 18:00 para previa semanal |
| **Rate limiting avanzado** | 🟡 Importante | Medio | Por chat, cola de mensajes, prioridades |
| **Deduplicación noticias** | 🟡 Importante | Bajo | Por (fuente, id_fuente) en ventana 2h |
| **Validación temprana** | 🟡 Importante | Bajo | Health check al arranque |
| **Métricas estructuradas** | 🟢 Mejora | Medio | Contadores Prometheus-style |
| **Quiet hours** | 🟢 Opcional | Bajo | Diferir notificaciones en horarios |
| **Panel admin completo** | 🟢 Mejora | Medio | Historial, parámetros, reenvío |

---

## 🔍 Análisis Caso por Caso

### Caso A: "Noticia nueva" ❌ NO IMPLEMENTADO

#### Requisitos de la especificación:
- ✅ Entidad NewsItem con campos: id_fuente, fuente, pais, tema, titulo, impacto, timestamp, resumen, valor_publicado, valor_esperado
- ✅ Hook post-inserción que dispara notificación
- ✅ Deduplicación por (fuente, id_fuente) en 2h
- ✅ Cálculo de sorpresa (publicado - esperado)
- ✅ Prioridad HIGH/NORMAL según impacto/sorpresa
- ✅ Plantilla específica con formato [NEW]

#### Estado actual:
- ❌ **No existe tabla `news_items`** en schema
- ❌ **No existe entidad NewsItem** en código
- ❌ **No hay hook post-inserción** para noticias
- ❌ **No hay deduplicación** de noticias
- ❌ **No hay cálculo de sorpresa**
- ✅ Existe trigger `checkMacroReleases` pero solo para series macro existentes, no noticias nuevas

#### Gap a cubrir:
```sql
-- Tabla necesaria
CREATE TABLE news_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_fuente TEXT NOT NULL,
  fuente TEXT NOT NULL,
  pais TEXT,
  tema TEXT,
  titulo TEXT NOT NULL,
  impacto TEXT CHECK(impacto IN ('low', 'med', 'high')),
  timestamp_publicacion TEXT NOT NULL,
  resumen_breve TEXT,
  valor_publicado REAL,
  valor_esperado REAL,
  sorpresa REAL, -- calculado
  sorpresa_clasificacion TEXT, -- 'al alza' | 'a la baja' | 'en línea'
  estado TEXT DEFAULT 'pendiente' CHECK(estado IN ('pendiente', 'validado', 'notificado')),
  notificado_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(fuente, id_fuente)
);
```

**Esfuerzo estimado**: 3-5 días
- 1 día: Schema y entidad
- 1 día: Hook post-inserción
- 1 día: Deduplicación y sorpresa
- 1 día: Builder de mensaje y trigger
- 1 día: Tests

---

### Caso B: "Cambio de narrativa" ❌ PARCIALMENTE IMPLEMENTADO

#### Requisitos de la especificación:
- ✅ Estados discretos: RISK_ON, RISK_OFF, INFLACION_ARRIBA, INFLACION_ABAJO, CRECIMIENTO_MEJORA, CRECIMIENTO_DETERIORA, NEUTRAL
- ✅ Cálculo de scores por eje (inflación, crecimiento, riesgo)
- ✅ Histeresis (M minutos o K eventos)
- ✅ Cooldown después de notificar
- ✅ Plantilla específica con formato [NARRATIVA]

#### Estado actual:
- ✅ Existe `domain/narratives.ts` pero calcula narrativas **por par/activo**, no régimen macro global
- ✅ Existe `lib/bias/inputs.ts` con `risk_regime` pero no estados discretos
- ✅ Existe `checkUSDChange` pero solo para USD (Fuerte/Débil/Neutral), no narrativa completa
- ❌ **No hay estados discretos** como RISK_ON/OFF, INFLACION_ARRIBA/ABAJO
- ❌ **No hay histeresis** ni cooldown
- ❌ **No hay cálculo de scores por eje** con sorpresas de datos

#### Gap a cubrir:
```typescript
// Estados necesarios
type NarrativeState = 
  | 'RISK_ON'
  | 'RISK_OFF'
  | 'INFLACION_ARRIBA'
  | 'INFLACION_ABAJO'
  | 'CRECIMIENTO_MEJORA'
  | 'CRECIMIENTO_DETERIORA'
  | 'NEUTRAL'

// Scores por eje
interface NarrativeScores {
  inflacion: number  // Media ponderada de sorpresas CPI/PPI/Core
  crecimiento: number  // Media ponderada de sorpresas NFP/PMI/Ventas
  riesgo: number  // Sentimiento de titulares + señales mercado
}

// Estado con histeresis
interface NarrativeState {
  current: NarrativeState
  candidate: NarrativeState | null
  candidateSince: Date | null
  lastChange: Date | null
  cooldownUntil: Date | null
}
```

**Esfuerzo estimado**: 5-7 días
- 2 días: Cálculo de scores por eje
- 1 día: Mapeo a estados discretos
- 1 día: Histeresis y cooldown
- 1 día: Trigger y builder
- 1 día: Tests
- 1 día: Integración con jobs existentes

---

### Caso C: "Previa semanal" ❌ NO IMPLEMENTADO

#### Requisitos de la especificación:
- ✅ Calendario macro con eventos futuros
- ✅ Scheduler domingo 18:00 Europe/Madrid
- ✅ Selección eventos high/medium
- ✅ Agrupación por día
- ✅ Plantilla específica con formato [WEEK AHEAD]

#### Estado actual:
- ❌ **No existe tabla `macro_calendar`** en schema
- ❌ **No hay scheduler semanal** (solo jobs manuales/cron)
- ❌ **No hay gestión de eventos futuros**
- ✅ Existe `docs/PROJECT_SUMMARY.md` que menciona "Próximas fechas/noticias" como **eliminado**

#### Gap a cubrir:
```sql
-- Tabla necesaria
CREATE TABLE macro_calendar (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha TEXT NOT NULL,
  hora_local TEXT, -- Europe/Madrid
  pais TEXT,
  tema TEXT NOT NULL,
  evento TEXT NOT NULL,
  importancia TEXT CHECK(importancia IN ('low', 'med', 'high')),
  impacto_estimado TEXT,
  consenso TEXT, -- valor esperado si existe
  riesgo_volatilidad BOOLEAN DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_calendar_fecha ON macro_calendar(fecha);
```

**Esfuerzo estimado**: 3-4 días
- 1 día: Schema y gestión de calendario
- 1 día: Scheduler semanal (node-cron o similar)
- 1 día: Builder de mensaje y selección eventos
- 1 día: Tests

---

## 🔧 Componentes Transversales

### 1. Validación temprana al arranque ❌ NO IMPLEMENTADO

**Requisito**: Verificar token, chat, zona horaria, conectividad al arranque.

**Estado actual**: No hay validación temprana. Errores solo aparecen al intentar enviar.

**Esfuerzo**: 0.5 días

---

### 2. Rate limiting avanzado ⚠️ PARCIAL

**Requisito**: 
- Global: 30 msg/min
- Por chat: 5 msg/min
- Cola de mensajes con prioridades
- Narrativa puede "saltar cola"

**Estado actual**: Solo 1 msg/min global, sin cola ni prioridades.

**Esfuerzo**: 2-3 días

---

### 3. Deduplicación general ⚠️ PARCIAL

**Requisito**:
- Noticias: por (fuente, id_fuente) en 2h
- Narrativa: no repetir mismo from→to en cooldown
- Weekly: una vez por semana

**Estado actual**: Solo deduplicación básica en `checkMacroReleases` por fecha.

**Esfuerzo**: 1 día

---

### 4. Métricas estructuradas ❌ NO IMPLEMENTADO

**Requisito**: Contadores Prometheus-style con labels.

**Estado actual**: Solo logs, no métricas estructuradas.

**Esfuerzo**: 2 días

---

### 5. Panel admin completo ⚠️ PARCIAL

**Requisito**:
- Últimos 50 mensajes enviados
- Estado token y scheduler
- Parámetros configurables
- Botón reenviar weekly

**Estado actual**: Solo pruebas básicas.

**Esfuerzo**: 2-3 días

---

## 📐 Arquitectura Propuesta

### Flujo Caso A (Noticia nueva)

```
Pipeline de Ingesta
    ↓
Insert NewsItem (estado='validado')
    ↓
Hook: onNewsItemInserted()
    ↓
Verificar deduplicación (fuente, id_fuente, 2h)
    ↓
Calcular sorpresa (si aplica)
    ↓
Determinar prioridad (HIGH/NORMAL)
    ↓
Encolar mensaje (cola con prioridades)
    ↓
Rate limiter (global + por chat)
    ↓
sendTelegramMessage()
    ↓
Actualizar estado: notificado_at
    ↓
Métricas: news_notified_total++
```

### Flujo Caso B (Cambio narrativa)

```
Nueva noticia/evento
    ↓
Recalcular scores por eje:
  - inflacion: media ponderada sorpresas CPI/PPI
  - crecimiento: media ponderada sorpresas NFP/PMI
  - riesgo: sentimiento titulares + señales mercado
    ↓
Mapear scores → estados discretos
    ↓
Aplicar reglas prioridad → estado candidato
    ↓
Verificar histeresis:
  - Si candidato != actual y mantiene M min o K eventos
    ↓
Verificar cooldown:
  - Si lastChange + cooldown < ahora → bloquear
    ↓
Confirmar cambio → actualizar estado
    ↓
Encolar mensaje (prioridad ALTA)
    ↓
sendTelegramMessage()
    ↓
Métricas: narrative_changes_total++
```

### Flujo Caso C (Previa semanal)

```
Scheduler (domingo 18:00 Europe/Madrid)
    ↓
Query calendario: eventos lunes-domingo siguiente
    ↓
Filtrar: importancia IN ('high', 'med')
    ↓
Agrupar por día
    ↓
Generar mensaje [WEEK AHEAD]
    ↓
Verificar deduplicación: ya enviado esta semana?
    ↓
Encolar mensaje
    ↓
sendTelegramMessage()
    ↓
Métricas: week_ahead_sent_total++
```

---

## 🗄️ Esquema de Base de Datos Propuesto

```sql
-- News items (Caso A)
CREATE TABLE news_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_fuente TEXT NOT NULL,
  fuente TEXT NOT NULL,
  pais TEXT,
  tema TEXT,
  titulo TEXT NOT NULL,
  impacto TEXT CHECK(impacto IN ('low', 'med', 'high')),
  timestamp_publicacion TEXT NOT NULL,
  resumen_breve TEXT,
  valor_publicado REAL,
  valor_esperado REAL,
  sorpresa REAL,
  sorpresa_clasificacion TEXT,
  estado TEXT DEFAULT 'pendiente',
  notificado_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(fuente, id_fuente)
);

-- Macro calendar (Caso C)
CREATE TABLE macro_calendar (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha TEXT NOT NULL,
  hora_local TEXT,
  pais TEXT,
  tema TEXT NOT NULL,
  evento TEXT NOT NULL,
  importancia TEXT CHECK(importancia IN ('low', 'med', 'high')),
  impacto_estimado TEXT,
  consenso TEXT,
  riesgo_volatilidad BOOLEAN DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Narrative state (Caso B)
CREATE TABLE narrative_state (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  estado_actual TEXT NOT NULL,
  estado_candidato TEXT,
  candidato_desde TEXT,
  ultimo_cambio TEXT,
  cooldown_hasta TEXT,
  scores_json TEXT, -- {inflacion, crecimiento, riesgo}
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Notification history (transversal)
CREATE TABLE notification_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo TEXT NOT NULL, -- 'news' | 'narrative' | 'weekly'
  mensaje TEXT NOT NULL,
  prioridad TEXT, -- 'HIGH' | 'NORMAL'
  chat_id TEXT,
  message_id INTEGER,
  status TEXT, -- 'sent' | 'failed' | 'queued'
  error TEXT,
  sent_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Deduplication tracking
CREATE TABLE notification_dedup (
  clave TEXT PRIMARY KEY, -- hash de (tipo, identificador)
  ultimo_envio TEXT NOT NULL,
  contador INTEGER DEFAULT 1
);

-- Métricas (opcional, o usar logs estructurados)
CREATE TABLE notification_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  metric_name TEXT NOT NULL,
  labels_json TEXT, -- {impacto: 'high', tema: 'CPI', ...}
  value INTEGER DEFAULT 1,
  timestamp TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Índices
CREATE INDEX idx_news_fuente_id ON news_items(fuente, id_fuente);
CREATE INDEX idx_news_estado ON news_items(estado);
CREATE INDEX idx_news_timestamp ON news_items(timestamp_publicacion);
CREATE INDEX idx_calendar_fecha ON macro_calendar(fecha);
CREATE INDEX idx_calendar_importancia ON macro_calendar(importancia);
CREATE INDEX idx_notification_tipo ON notification_history(tipo);
CREATE INDEX idx_notification_sent_at ON notification_history(sent_at);
CREATE INDEX idx_dedup_clave ON notification_dedup(clave);
```

---

## 🚀 Plan de Implementación

### Fase 1: Infraestructura Base (5-7 días)

**Objetivo**: Base de datos y entidades core.

- [ ] Crear schemas: `news_items`, `macro_calendar`, `narrative_state`, `notification_history`
- [ ] Implementar entidades TypeScript para NewsItem
- [ ] Implementar gestión de calendario macro
- [ ] Implementar estado de narrativa con histeresis
- [ ] Tests de schemas y entidades

**Entregables**:
- Schemas SQLite
- Types TypeScript
- Funciones CRUD básicas

---

### Fase 2: Caso A - Noticia Nueva (3-5 días)

**Objetivo**: Notificar cada noticia nueva insertada.

- [ ] Hook post-inserción de NewsItem
- [ ] Cálculo de sorpresa (publicado - esperado)
- [ ] Deduplicación por (fuente, id_fuente) en 2h
- [ ] Builder de mensaje [NEW]
- [ ] Prioridad HIGH/NORMAL
- [ ] Integración con rate limiter
- [ ] Tests de aceptación

**Entregables**:
- Trigger automático al insertar noticia
- Mensajes Telegram con formato [NEW]
- Métricas: `news_notified_total`

---

### Fase 3: Caso B - Cambio Narrativa (5-7 días)

**Objetivo**: Detectar y notificar cambios de régimen macro.

- [ ] Cálculo de scores por eje (inflación, crecimiento, riesgo)
- [ ] Mapeo a estados discretos (RISK_ON/OFF, etc.)
- [ ] Reglas de prioridad entre ejes
- [ ] Histeresis (M minutos o K eventos)
- [ ] Cooldown después de notificar
- [ ] Builder de mensaje [NARRATIVA]
- [ ] Integración con jobs existentes
- [ ] Tests de aceptación

**Entregables**:
- Motor de narrativa con estados discretos
- Notificaciones de cambios de régimen
- Métricas: `narrative_changes_total`

---

### Fase 4: Caso C - Previa Semanal (3-4 días)

**Objetivo**: Resumen semanal de eventos futuros.

- [ ] Scheduler domingo 18:00 Europe/Madrid
- [ ] Query y filtrado de calendario
- [ ] Agrupación por día
- [ ] Builder de mensaje [WEEK AHEAD]
- [ ] Deduplicación semanal
- [ ] Tests de aceptación

**Entregables**:
- Job semanal automático
- Mensajes Telegram con formato [WEEK AHEAD]
- Métricas: `week_ahead_sent_total`

---

### Fase 5: Componentes Transversales (4-6 días)

**Objetivo**: Mejoras de robustez y UX.

- [ ] Validación temprana al arranque
- [ ] Rate limiting avanzado (global + por chat + cola)
- [ ] Prioridades en cola (narrativa puede saltar)
- [ ] Métricas estructuradas
- [ ] Panel admin completo
- [ ] Quiet hours (opcional)

**Entregables**:
- Health check al arranque
- Rate limiter con cola y prioridades
- Dashboard de métricas
- Panel admin con historial y configuración

---

### Fase 6: Testing y Documentación (2-3 días)

**Objetivo**: Asegurar calidad y documentar.

- [ ] Tests end-to-end de los 3 casos
- [ ] Tests de carga (rate limiting, cola)
- [ ] Tests de edge cases (errores, timeouts)
- [ ] Documentación de uso
- [ ] Guía de configuración

**Entregables**:
- Suite de tests completa
- Documentación actualizada
- Guía de administración

---

## 📊 Estimación Total

| Fase | Esfuerzo | Dependencias |
|------|----------|--------------|
| Fase 1: Infraestructura | 5-7 días | - |
| Fase 2: Caso A | 3-5 días | Fase 1 |
| Fase 3: Caso B | 5-7 días | Fase 1 |
| Fase 4: Caso C | 3-4 días | Fase 1 |
| Fase 5: Transversales | 4-6 días | Fases 2-4 |
| Fase 6: Testing | 2-3 días | Todas |
| **TOTAL** | **22-32 días** | - |

**Nota**: Asumiendo trabajo a tiempo completo. Con trabajo parcial, multiplicar por factor apropiado.

---

## ⚠️ Decisiones Técnicas Pendientes

### 1. Scheduler

**Opciones**:
- `node-cron` (simple, popular)
- `node-schedule` (más flexible)
- Vercel Cron Jobs (si está en Vercel)
- External cron (GitHub Actions, etc.)

**Recomendación**: `node-cron` para simplicidad.

---

### 2. Cola de Mensajes

**Opciones**:
- In-memory queue (simple, se pierde al reiniciar)
- SQLite queue (persistente, más lento)
- Redis (mejor, pero requiere infraestructura)
- Bull/BullMQ (completo, pero más complejo)

**Recomendación**: SQLite queue para MVP, migrar a Redis si escala.

---

### 3. Métricas

**Opciones**:
- Logs estructurados (simple)
- Tabla SQLite (persistente)
- Prometheus (estándar, pero requiere infraestructura)
- StatsD (ligero)

**Recomendación**: Logs estructurados + tabla SQLite para MVP.

---

### 4. Fuente de NewsItem

**Pregunta**: ¿De dónde vienen las noticias?

**Opciones**:
- Integrar con API de noticias (NewsAPI, Alpha Vantage, etc.)
- Scraping controlado
- Manual (admin inserta)
- Pipeline existente (si existe)

**Acción requerida**: Confirmar fuente de datos.

---

## 🎯 Próximos Pasos Inmediatos

1. **Confirmar fuente de NewsItem**
   - ¿De dónde vienen las noticias?
   - ¿Ya existe pipeline de ingesta?
   - ¿Necesitamos crear ingesta nueva?

2. **Decidir prioridad de fases**
   - ¿Qué caso es más crítico? (A, B, o C)
   - ¿Se puede hacer MVP con solo uno?

3. **Validar arquitectura**
   - ¿SQLite es suficiente para cola?
   - ¿Necesitamos Redis desde el inicio?
   - ¿Scheduler en servidor o externo?

4. **Setup inicial**
   - Crear schemas base
   - Setup de tipos TypeScript
   - Configurar variables de entorno

---

## 📝 Notas Finales

- **Compatibilidad**: El código existente de Telegram es compatible, solo necesita extenderse.
- **Migración**: Los triggers existentes (USD/Corr/Macro) pueden coexistir con los nuevos.
- **Testing**: Usar dry-run mode para desarrollo y tests.
- **Documentación**: Actualizar `PROJECT_SUMMARY.md` cuando se complete.

---

*Última actualización: Enero 2025*




