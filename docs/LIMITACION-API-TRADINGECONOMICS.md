# Limitación de API: TradingEconomics Plan Gratuito

## Problema Identificado

La API de TradingEconomics con plan **gratuito** solo tiene acceso a los siguientes países:
- México (MXN)
- Nueva Zelanda (NZD)
- Suecia (SEK)
- Tailandia (THB)

**NO tiene acceso a:**
- Estados Unidos (USD) ❌
- Euro Area (EUR) ❌
- Reino Unido (GBP) ❌
- Japón (JPY) ❌
- Australia (AUD) ❌
- Canadá (CAD) ❌
- Suiza (CHF) ❌
- Y otros países principales para FX trading

## Mensaje de la API

Cuando se intenta acceder a países no incluidos en el plan gratuito, la API puede devolver un mensaje como:

```
"Free accounts have access to the following countries: Mexico, New Zealand, Sweden, Thailand. 
For more, contact us at support@tradingeconomics.com."
```

## Soluciones

### Opción 1: Actualizar Plan de TradingEconomics (Recomendado)

Para obtener acceso a todos los países principales (USD, EUR, GBP, JPY, etc.), necesitas actualizar tu plan de TradingEconomics:

1. **Contactar soporte:** support@tradingeconomics.com
2. **Solicitar acceso a países principales** para FX trading
3. **Verificar precios** del plan que incluye estos países

**Ventajas:**
- ✅ Acceso completo a todos los países principales
- ✅ Eventos de alta importancia (NFP, CPI, tipos de interés, etc.)
- ✅ Datos en tiempo real
- ✅ Integración directa con el código existente

### Opción 2: Usar Múltiples Proveedores

Combinar TradingEconomics (para países gratuitos) con otro proveedor para países principales:

**Proveedores alternativos:**
- **FRED API** (gratuito) - Para datos económicos de EEUU
- **ECB Statistical Data Warehouse** (gratuito) - Para datos de Euro Area
- **Bank of England API** (gratuito) - Para datos del Reino Unido
- **Bank of Japan API** (gratuito) - Para datos de Japón
- **Investing.com** (scraping, requiere manejo de términos de servicio)
- **ForexFactory** (scraping, requiere manejo de términos de servicio)

**Desventajas:**
- ❌ Requiere implementar múltiples proveedores
- ❌ Diferentes formatos de datos
- ❌ Mantenimiento más complejo
- ❌ Algunos requieren scraping (riesgo legal/técnico)

### Opción 3: Usar Solo Países Disponibles (Temporal)

Mientras se resuelve el acceso a países principales, el sistema funcionará con:
- México (MXN) - Eventos de inflación, PIB, etc.
- Nueva Zelanda (NZD) - Eventos económicos
- Suecia (SEK) - Eventos económicos
- Tailandia (THB) - Eventos económicos

**Limitaciones:**
- ❌ No hay eventos de USD, EUR, GBP, JPY
- ❌ No hay acceso a eventos de alta importancia de países principales
- ⚠️ **No es adecuado para trading FX de pares mayores**

## Implementación Actual

El código actual está configurado para usar el endpoint `/calendar/country/` con los países principales, pero la API limitará automáticamente los resultados según el plan.

### Código Actualizado

El código ahora:
1. ✅ Intenta obtener eventos de países principales
2. ✅ Detecta y registra limitaciones de cuenta gratuita
3. ✅ Procesa los eventos disponibles (países gratuitos)
4. ✅ Registra warnings cuando hay limitaciones

### Verificación

Para verificar qué países están disponibles en tu cuenta:

```bash
# Ejecutar el job de calendario
curl -X POST http://localhost:3000/api/jobs/ingest/calendar \
  -H "Authorization: Bearer dev_local_token"

# Ver qué países están en la base de datos
sqlite3 macro.db "SELECT DISTINCT country, currency, COUNT(*) as count 
FROM economic_events 
WHERE scheduled_time_utc >= datetime('now') 
GROUP BY country, currency 
ORDER BY count DESC;"
```

## Recomendación

**Para uso en producción con trading FX:**

1. **Actualizar plan de TradingEconomics** para obtener acceso a USD, EUR, GBP, JPY
2. **O implementar proveedores alternativos** para países principales
3. **No usar solo países gratuitos** para trading de pares mayores

El sistema está preparado para funcionar con cualquier plan, pero para trading FX profesional necesitas acceso a los países principales.

## Contacto TradingEconomics

- **Email:** support@tradingeconomics.com
- **Documentación:** https://docs.tradingeconomics.com/
- **Precios:** Contactar directamente para planes personalizados

