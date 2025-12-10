# Configuración de Proveedores Alternativos de Calendario Económico

## Resumen

El sistema ahora soporta múltiples proveedores de calendario económico:
- **TradingEconomics**: Países con acceso gratuito (México, Nueva Zelanda, Suecia, Tailandia)
- **FRED**: Eventos económicos de Estados Unidos (USD) - **GRATUITO**
- **ECB**: Eventos económicos de Euro Area (EUR) - **GRATUITO**

## Configuración

### 1. TradingEconomics (Ya configurado)

Ya tienes `TRADING_ECONOMICS_API_KEY` configurado. Este proveedor seguirá funcionando para los países disponibles en tu plan.

### 2. FRED API (Nuevo - Requerido para eventos de EEUU)

**FRED es GRATUITO** y proporciona acceso completo a eventos económicos de Estados Unidos.

#### Pasos para obtener API Key:

1. **Crear cuenta en FRED:**
   - Visita: https://fred.stlouisfed.org/
   - Crea una cuenta gratuita (si no tienes una)

2. **Obtener API Key:**
   - Visita: https://fred.stlouisfed.org/docs/api/api_key.html
   - Inicia sesión con tu cuenta FRED
   - Solicita una API key (32 caracteres alfanuméricos)
   - La recibirás inmediatamente

3. **Configurar variable de entorno:**
   ```bash
   # En tu archivo .env.local o variables de entorno
   FRED_API_KEY=tu_api_key_aqui
   ```

#### Eventos que FRED proporciona:

- ✅ Consumer Price Index (CPI) - Alta importancia
- ✅ Core CPI - Alta importancia
- ✅ Unemployment Rate - Alta importancia
- ✅ Nonfarm Payrolls (NFP) - Alta importancia
- ✅ Gross Domestic Product (GDP) - Alta importancia
- ✅ Federal Funds Rate - Alta importancia
- ✅ Producer Price Index (PPI) - Media importancia
- ✅ Retail Sales - Media importancia
- ✅ Industrial Production - Media importancia
- ✅ Housing Starts - Media importancia
- Y más...

### 3. ECB Provider (Ya configurado - Sin API Key)

El proveedor ECB está habilitado automáticamente y **no requiere API key**. 

**NOTA IMPORTANTE:** El proveedor ECB actualmente genera fechas **estimadas** basadas en patrones de frecuencia (mensual, trimestral). Las fechas exactas pueden variar.

**Mejora futura:** Implementar scraping del calendario web del ECB o integración con SDMX API para obtener fechas exactas.

#### Eventos que ECB proporciona (estimados):

- ✅ Harmonised Index of Consumer Prices (HICP) - Alta importancia
- ✅ Core HICP - Alta importancia
- ✅ Gross Domestic Product (GDP) - Alta importancia
- ✅ Unemployment Rate - Alta importancia
- ✅ ECB Interest Rate Decision - Alta importancia
- ✅ Industrial Production - Media importancia
- ✅ Retail Sales - Media importancia
- ✅ Trade Balance - Media importancia

## Verificación

### 1. Verificar que las variables de entorno están configuradas:

```bash
# En tu terminal
echo $FRED_API_KEY
echo $TRADING_ECONOMICS_API_KEY
```

### 2. Ejecutar el job de calendario:

```bash
curl -X POST http://localhost:3000/api/jobs/ingest/calendar \
  -H "Authorization: Bearer dev_local_token"
```

### 3. Verificar eventos en la base de datos:

```bash
# Ver eventos por país
sqlite3 macro.db "SELECT DISTINCT country, currency, COUNT(*) as count 
FROM economic_events 
WHERE scheduled_time_utc >= datetime('now') 
GROUP BY country, currency 
ORDER BY count DESC;"

# Ver eventos de EEUU (USD)
sqlite3 macro.db "SELECT name, importance, scheduled_time_utc 
FROM economic_events 
WHERE currency = 'USD' AND country = 'United States'
  AND scheduled_time_utc >= datetime('now') 
ORDER BY scheduled_time_utc ASC 
LIMIT 20;"

# Ver eventos de Euro Area (EUR)
sqlite3 macro.db "SELECT name, importance, scheduled_time_utc 
FROM economic_events 
WHERE currency = 'EUR' AND country = 'Euro Area'
  AND scheduled_time_utc >= datetime('now') 
ORDER BY scheduled_time_utc ASC 
LIMIT 20;"
```

## Límites de Rate Limiting

### FRED API:
- **120 requests por minuto** (gratuito)
- El código incluye delays automáticos para respetar este límite

### TradingEconomics:
- Depende de tu plan
- El código maneja errores automáticamente

### ECB:
- Sin límites conocidos (acceso público)

## Solución de Problemas

### "FRED_API_KEY not set, skipping FRED"

**Solución:** Configura la variable de entorno `FRED_API_KEY` con tu API key de FRED.

### "FRED API error: 429 Too Many Requests"

**Solución:** El código ya incluye delays automáticos. Si persiste, aumenta el delay en `fredProvider.ts`.

### Eventos de ECB con fechas incorrectas

**Solución:** El proveedor ECB actualmente usa fechas estimadas. Para fechas exactas, considera:
1. Implementar scraping del calendario web del ECB
2. Integrar con SDMX API del ECB
3. Mantener una base de datos manual de fechas exactas

### No aparecen eventos de EEUU o Euro Area

**Verificar:**
1. Que `FRED_API_KEY` está configurado correctamente
2. Que el job se ejecutó sin errores
3. Revisar los logs del servidor para ver qué proveedores se ejecutaron

## Próximos Pasos

1. ✅ Configurar `FRED_API_KEY` (obligatorio para eventos de EEUU)
2. ✅ Ejecutar el job de calendario
3. ✅ Verificar que aparecen eventos de USD y EUR
4. 🔄 (Opcional) Mejorar proveedor ECB para fechas exactas
5. 🔄 (Opcional) Agregar más proveedores (Bank of England, Bank of Japan, etc.)

## Referencias

- **FRED API:** https://fred.stlouisfed.org/docs/api/
- **FRED API Key:** https://fred.stlouisfed.org/docs/api/api_key.html
- **ECB Statistical Calendar:** https://www.ecb.europa.eu/press/calendars/statscal/html/index.en.html
- **ECB SDMX API:** https://www.ecb.europa.eu/stats/accessing-our-data/html/index.en.html

