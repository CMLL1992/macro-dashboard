# Migración a date-fns-tz v3.x

## Cambios en la API

En `date-fns-tz` v3.x, los nombres de las funciones cambiaron:

### v1.x / v2.x (date-fns v2.x)
```typescript
import { utcToZonedTime, zonedTimeToUtc } from 'date-fns-tz'
```

### v3.x (date-fns v3.x)
```typescript
import { toZonedTime, fromZonedTime } from 'date-fns-tz'
```

## Mapeo de Funciones

| v1.x/v2.x | v3.x | Descripción |
|-----------|------|-------------|
| `utcToZonedTime(date, timeZone)` | `toZonedTime(date, timeZone)` | Convierte UTC a zona horaria |
| `zonedTimeToUtc(date, timeZone)` | `fromZonedTime(date, timeZone)` | Convierte de zona horaria a UTC |

## Versiones Instaladas

```bash
date-fns: 3.6.0
date-fns-tz: 3.2.0
```

✅ **Compatibles** - Ambas son v3.x

## Archivos Actualizados

1. ✅ `lib/notifications/scheduler.ts`
   - `utcToZonedTime` → `toZonedTime`
   - `zonedTimeToUtc` → `fromZonedTime`

2. ✅ `lib/notifications/weekly.ts`
   - `utcToZonedTime` → `toZonedTime`

3. ✅ `lib/notifications/news.ts`
   - `utcToZonedTime` → `toZonedTime`

4. ✅ `app/api/notifications/status/route.ts`
   - `utcToZonedTime` → `toZonedTime`
   - `zonedTimeToUtc` → `fromZonedTime`

5. ✅ `lib/notifications/__test_timezone.ts`
   - `utcToZonedTime` → `toZonedTime`

## Guards de Desarrollo

Todos los archivos ahora incluyen guards de desarrollo que verifican que los imports funcionan correctamente:

```typescript
// Development guard: verify import works correctly
if (process.env.NODE_ENV !== 'production') {
  if (typeof toZonedTime !== 'function') {
    throw new Error('toZonedTime import mismatch. Check date-fns/date-fns-tz versions.')
  }
}
```

## Verificación

Después de la migración, verifica:

1. ✅ No hay errores de linter
2. ✅ Los guards de desarrollo no lanzan errores
3. ✅ El test de timezone funciona: `[TIMEZONE TEST] ✅ toZonedTime works correctly`
4. ✅ `/api/notifications/status` retorna `weekly_next_run` correctamente
5. ✅ `POST /api/jobs/weekly` funciona sin errores

---

*Última actualización: Enero 2025*




