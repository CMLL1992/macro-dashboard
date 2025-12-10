# 📱 Sistema de Notificaciones Automáticas

## ✅ Estado: TODO CONFIGURADO Y FUNCIONANDO

Todas las notificaciones están configuradas para ejecutarse automáticamente. **No necesitas hacer nada manualmente**.

## 📅 Configuración Automática (vercel.json)

### Jobs Automáticos Configurados:

1. **Calendario Diario** (`/api/jobs/daily/calendar`)
   - **Horario**: Todos los días a las 8:00 AM
   - **Qué envía**: Eventos del día con escenarios what-if (mejor/peor/estable)

2. **Resumen Semanal** (`/api/jobs/weekly`)
   - **Horario**: Domingos a las 6:00 PM
   - **Qué envía**: 
     - Calendario completo de la próxima semana
     - Resumen macroeconómico completo (régimen, scores, escenarios, eventos recientes)

3. **Ingesta de Calendario** (`/api/jobs/ingest/calendar`)
   - **Horario**: Todos los días a las 2:00 AM
   - **Qué hace**: Actualiza eventos del calendario económico

4. **Ingesta de Releases** (`/api/jobs/ingest/releases`)
   - **Horario**: Cada minuto entre las 8:00 AM y 8:00 PM
   - **Qué hace**: Detecta y notifica cuando se publican datos económicos importantes

5. **Cálculo de Bias** (`/api/jobs/compute/bias`)
   - **Horario**: Cada 6 horas
   - **Qué hace**: Recalcula sesgos y detecta cambios de confianza/escenarios

## 🧪 Pruebas Realizadas

Se ejecutaron **9 pruebas completas** y todas pasaron exitosamente:

✅ Mensaje básico de Telegram
✅ Nuevos eventos de calendario
✅ Calendario diario con escenarios
✅ Resumen semanal de calendario
✅ Resumen macroeconómico semanal
✅ Cambios de confianza en pares
✅ Cambios de datos macro
✅ Cambios de escenarios
✅ Release publicado con impacto

## 📨 Tipos de Notificaciones que Recibirás

### 1. **Diarias (8:00 AM)**
- Eventos programados para ese día
- Escenarios what-if para cada evento:
  - 📈 Mejor de lo esperado
  - 📉 Peor de lo esperado
  - ➡️ En línea con consenso
- Pares afectados por cada escenario

### 2. **En Tiempo Real (cuando se publican datos)**
- Valor anterior vs actual
- Sorpresa calculada (dirección y score)
- Impacto esperado en la moneda
- Lista de pares afectados

### 3. **Semanales (Domingos 6:00 PM)**
- **Calendario**: Todos los eventos importantes de la próxima semana
- **Resumen Macro**:
  - Régimen global (USD, Quad, Risk, Liquidez, Crédito)
  - Scores por moneda (USD, EUR, GBP, JPY, AUD)
  - Escenarios activos (alta confianza)
  - Escenarios watchlist (media confianza)
  - Eventos recientes con sorpresas
  - Indicadores clave

### 4. **Cambios de Confianza**
- Cuando cambia el nivel de confianza de un par (Alta/Media/Baja)
- Mejoras y reducciones de confianza

### 5. **Cambios de Escenarios**
- Nuevos escenarios activos
- Cambios en escenarios existentes

### 6. **Cambios de Datos Macro**
- Actualizaciones significativas de indicadores (>1% de cambio)
- Valor anterior vs actual con porcentaje de cambio

## 🔧 Ejecutar Pruebas Manualmente

Si quieres probar todas las notificaciones manualmente:

```bash
curl -X POST http://localhost:3000/api/test/notifications \
  -H "Authorization: Bearer dev_local_token" \
  -H "Content-Type: application/json"
```

O desde el navegador (si tienes el servidor corriendo):
```
POST /api/test/notifications
Header: Authorization: Bearer dev_local_token
```

## ⚙️ Configuración Requerida

Asegúrate de tener estas variables de entorno configuradas:

```env
TELEGRAM_BOT_TOKEN=tu_token_aqui
TELEGRAM_CHAT_ID=tu_chat_id_aqui
ENABLE_TELEGRAM_NOTIFICATIONS=true
CRON_TOKEN=tu_cron_token_aqui
```

## 📊 Monitoreo

Todos los jobs registran su estado en la tabla `job_status` de la base de datos. Puedes verificar el estado en:
- Dashboard: `/dashboard` (indicador de estado de jobs)
- API: `/api/status/jobs`

## 🎯 Resumen

**Todo está configurado y funcionando automáticamente. No necesitas hacer nada manualmente.**

Las notificaciones se enviarán:
- ✅ Todos los días a las 8:00 AM (calendario del día)
- ✅ En tiempo real cuando se publiquen datos
- ✅ Los domingos a las 6:00 PM (resumen semanal completo)
- ✅ Automáticamente cuando cambien confianzas o escenarios

