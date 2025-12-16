# 📅 Configuración de Notificaciones de Calendario

Este documento explica cómo configurar las notificaciones automáticas por Telegram para eventos del calendario económico.

## 🎯 Funcionalidad

El sistema envía automáticamente un mensaje por Telegram cuando hay eventos de **alto impacto** a punto de publicarse (30 minutos antes).

Ejemplo de mensaje:
```
⚠️ Evento macro en 30 min

*CPI USA*
Importancia: 🔴 Alta
Zona: Estados Unidos · United States (USD)
Hora: 14:30 (Madrid)
Categoría: Inflation
```

## 📋 Requisitos Previos

### Variables de Entorno

Asegúrate de tener configuradas estas variables en Vercel:

- `TELEGRAM_BOT_TOKEN` - Token del bot de Telegram
- `TELEGRAM_CHAT_ID` - ID del chat donde recibir las notificaciones
- `CRON_TOKEN` - Token para proteger el endpoint (opcional pero recomendado)
- `ENABLE_TELEGRAM_NOTIFICATIONS=true` - Habilitar notificaciones

## 🔧 Configuración del Cron en Vercel

### Opción 1: Usando Vercel Cron Jobs (Recomendado)

1. Ve a tu proyecto en Vercel Dashboard
2. Ve a **Settings** → **Cron Jobs**
3. Haz clic en **Add Cron Job**
4. Configura:
   - **Schedule**: `*/5 * * * *` (cada 5 minutos)
   - **Path**: `/api/jobs/notify/calendar`
   - **Method**: `POST`
   - **Headers**: 
     - `Authorization: Bearer ${CRON_TOKEN}` (si usas CRON_TOKEN)
     - O deja vacío si solo usas localhost

### Opción 2: Usando vercel.json

Añade esto a tu `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/jobs/notify/calendar",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

Y luego configura el header de autorización en Vercel Dashboard → Settings → Environment Variables.

## 🧪 Probar el Job Manualmente

### Desde el navegador (localhost)

```bash
curl -X POST http://localhost:3000/api/jobs/notify/calendar \
  -H "Authorization: Bearer ${CRON_TOKEN}"
```

### Desde Vercel (producción)

```bash
curl -X POST https://TU_DOMINIO/api/jobs/notify/calendar \
  -H "Authorization: Bearer ${CRON_TOKEN}"
```

## 📊 Cómo Funciona

1. **Cada 5 minutos**, el cron ejecuta el job
2. El job busca eventos que:
   - Tienen importancia **High**
   - Están programados entre **30-35 minutos** en el futuro
   - Aún **no han sido notificados** (`notified_at IS NULL`)
3. Para cada evento encontrado:
   - Construye un mensaje formateado
   - Envía el mensaje a Telegram
   - Marca el evento como notificado (`notified_at = ahora`)
4. Evita duplicados: cada evento solo se notifica una vez

## ⚙️ Personalización

### Cambiar el margen de tiempo (lead minutes)

Por defecto es **30 minutos**. Para cambiarlo:

1. Edita `app/api/jobs/notify/calendar/route.ts`
2. Cambia la línea:
   ```typescript
   const leadMinutes = 30 // Cambiar a 15, 60, etc.
   ```

### Incluir eventos de importancia Media

Por defecto solo se notifican eventos **High**. Para incluir también **Medium**:

1. Edita `app/api/jobs/notify/calendar/route.ts`
2. Cambia la query SQL:
   ```sql
   WHERE importance IN ('high', 'medium')
   ```

### Filtrar por región

Para recibir solo eventos de ciertas regiones:

1. Añade un filtro en el SQL:
   ```sql
   AND currency IN ('USD', 'EUR', 'GBP')
   ```

## 🐛 Troubleshooting

### No recibo notificaciones

1. **Verifica que el cron esté configurado**:
   - Ve a Vercel Dashboard → Cron Jobs
   - Verifica que el job esté activo

2. **Verifica las variables de entorno**:
   ```bash
   curl https://TU_DOMINIO/api/notifications/verify
   ```
   Debe devolver `telegram.valid: true`

3. **Verifica que haya eventos**:
   - Ejecuta el job manualmente y revisa los logs
   - Verifica que haya eventos High en los próximos días

4. **Revisa los logs de Vercel**:
   - Ve a Vercel Dashboard → Deployments → Functions
   - Busca logs del endpoint `/api/jobs/notify/calendar`

### Recibo notificaciones duplicadas

- Verifica que `notified_at` se esté guardando correctamente
- Revisa que no haya múltiples cron jobs ejecutándose

### El mensaje no se formatea correctamente

- Verifica que `noParseMode: false` en `sendTelegramMessage`
- Los mensajes usan Markdown, asegúrate de escapar caracteres especiales si es necesario

## 📝 Notas

- El job está protegido con `CRON_TOKEN` para evitar ejecuciones no autorizadas
- En localhost, el token es opcional para facilitar desarrollo
- El rate limiting de Telegram es de 10 mensajes por minuto (configurable)
- Los eventos se marcan como notificados incluso si falla el envío (para evitar spam)

## 🚀 Próximos Pasos

Una vez que funcione la versión básica, puedes:

1. **Añadir filtros por región** (solo US, EU, etc.)
2. **Ventanas diferentes por tipo de evento** (60 min para FOMC, 30 min para CPI)
3. **Configuración por archivo JSON** (`config/notifications.json`)
4. **Notificaciones para eventos Medium** (opcional)







