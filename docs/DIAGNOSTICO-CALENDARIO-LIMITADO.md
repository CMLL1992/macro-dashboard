# Diagnóstico: Calendario Solo Muestra 10 Eventos

## Problema Reportado
- Solo se muestran 10 eventos en la página `/calendario`
- Ninguno de los eventos es de **Prioridad Alta** (high importance)
- El usuario espera ver eventos importantes de mañana (miércoles)

## Estado Actual

### Eventos en Base de Datos
```sql
SELECT COUNT(*) as total, importance 
FROM economic_events 
WHERE scheduled_time_utc >= datetime('now') 
  AND scheduled_time_utc <= datetime('now', '+14 days') 
GROUP BY importance;
```

**Resultado:**
- `medium`: 2 eventos
- `low`: 8 eventos
- `high`: 0 eventos

### Eventos Actuales (próximos 3 días)
1. **1-Year Bill Auction** (low) - NZD - 9 dic 2025, 01:35
2. **6-Month Bill Auction** (low) - NZD - 9 dic 2025, 01:35
3. **3-Month Bill Auction** (low) - NZD - 9 dic 2025, 01:35
4. **Inflation Rate MoM** (medium) - MXN - 9 dic 2025, 12:00
5. **Inflation Rate YoY** (medium) - MXN - 9 dic 2025, 12:00
6. **Core Inflation Rate YoY** (low) - MXN - 9 dic 2025, 12:00
7. **Core Inflation Rate MoM** (low) - MXN - 9 dic 2025, 12:00
8. **Visitor Arrivals YoY** (low) - NZD - 9 dic 2025, 21:45
9. **Constitution Day** (low) - USD - 10 dic 2025, 00:00
10. **New Orders YoY** (low) - SEK - 10 dic 2025, 07:00

## Posibles Causas

### 1. Límites de la API de TradingEconomics
La API de TradingEconomics puede tener límites según el plan:
- **Plan Gratuito/Básico**: Puede limitar el número de eventos devueltos
- **Plan Premium**: Acceso completo a todos los eventos

**Solución:** Verificar el plan de la API key y considerar actualizar si es necesario.

### 2. La API Realmente No Tiene Eventos de Alta Importancia
Es posible que en este rango de fechas específico no haya eventos marcados como "High" (Importance = 3) por TradingEconomics.

**Solución:** 
- Verificar directamente en la API qué eventos están disponibles
- Revisar si eventos importantes están marcados como "Medium" en lugar de "High"

### 3. Problema con el Filtro de Importancia
El código actual filtra eventos por importancia antes de procesarlos. Si la API devuelve eventos pero el filtro los excluye, no se guardarán.

**Solución Implementada:**
- Cambiado el orden de filtros para primero mapear moneda y luego filtrar por importancia
- Agregado logging detallado para ver qué está devolviendo la API

## Cambios Realizados

### 1. Aumentado Rango de Fechas
- **Antes:** +7 días
- **Ahora:** +14 días (2 semanas)

### 2. Actualizada Página de Calendario
- **Antes:** Mostraba eventos de los próximos 7 días
- **Ahora:** Muestra eventos de los próximos 14 días

### 3. Mejorado Logging
Agregado logging detallado en `TradingEconomicsProvider` para ver:
- Número total de eventos devueltos por la API
- Desglose de importancia (cuántos High, Medium, Low)
- Ejemplos de eventos devueltos

### 4. Reordenado Filtros
Cambiado el orden de los filtros para asegurar que todos los eventos con país/moneda válidos se procesen antes de filtrar por importancia.

## Próximos Pasos Recomendados

1. **Revisar Logs del Servidor**
   - Ejecutar el job de calendario y revisar los logs de Next.js
   - Buscar mensajes que empiecen con `[TradingEconomicsProvider]`
   - Verificar el desglose de importancia que devuelve la API

2. **Verificar Plan de API**
   - Revisar la documentación de TradingEconomics sobre límites del plan
   - Considerar actualizar el plan si es necesario

3. **Verificar Eventos Directamente en la API**
   ```bash
   curl "https://api.tradingeconomics.com/calendar?c=TU_API_KEY&d1=2025-12-09&d2=2025-12-16" | jq '[.[] | select(.Importance == 3)] | length'
   ```

4. **Considerar Alternativas**
   - Si la API tiene límites estrictos, considerar:
     - Usar múltiples llamadas con rangos de fechas más pequeños
     - Filtrar eventos importantes manualmente después de recibirlos
     - Usar otro proveedor de calendario económico como complemento

## Comandos Útiles

### Ejecutar Job de Calendario
```bash
curl -X POST http://localhost:3000/api/jobs/ingest/calendar \
  -H "Authorization: Bearer dev_local_token"
```

### Ver Eventos en Base de Datos
```bash
sqlite3 macro.db "SELECT name, importance, scheduled_time_utc, currency 
FROM economic_events 
WHERE scheduled_time_utc >= datetime('now') 
  AND scheduled_time_utc <= datetime('now', '+14 days') 
ORDER BY importance DESC, scheduled_time_utc ASC;"
```

### Verificar Eventos de Alta Importancia
```bash
sqlite3 macro.db "SELECT COUNT(*) FROM economic_events 
WHERE importance = 'high' 
  AND scheduled_time_utc >= datetime('now');"
```

