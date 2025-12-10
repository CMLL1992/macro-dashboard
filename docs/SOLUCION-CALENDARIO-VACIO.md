# 🔧 Solución: Calendario Vacío

## Problema

La página `/calendario` muestra "0 eventos" porque el job de calendario no ha podido obtener datos.

---

## ✅ Solución Rápida

### 1. Configurar API Key de TradingEconomics

**Obtener API Key:**
1. Ve a: https://tradingeconomics.com/api
2. Regístrate (gratis) o inicia sesión
3. Obtén tu API key

**Configurar en Local:**
```bash
# Añadir a .env.local
echo "TRADING_ECONOMICS_API_KEY=tu_api_key_aqui" >> .env.local
```

**Configurar en Vercel:**
1. Ve a Vercel Dashboard → Tu Proyecto → Settings → Environment Variables
2. Añade: `TRADING_ECONOMICS_API_KEY` = `tu_api_key_aqui`
3. Marca para Production, Preview y Development

### 2. Ejecutar Job Manualmente

```bash
curl -X POST http://localhost:3000/api/jobs/ingest/calendar \
  -H "Authorization: Bearer dev_local_token" \
  -H "Content-Type: application/json"
```

### 3. Verificar Resultado

```bash
# Ver eventos insertados
sqlite3 macro.db "SELECT COUNT(*) FROM economic_events WHERE scheduled_time_utc >= datetime('now')"

# Ver eventos
sqlite3 macro.db "SELECT name, currency, scheduled_time_utc FROM economic_events ORDER BY scheduled_time_utc ASC LIMIT 10"
```

### 4. Refrescar Página

Navega a `http://localhost:3000/calendario` y deberías ver los eventos.

---

## 🔄 Automatización

Una vez configurado, los cron jobs en `vercel.json` ejecutarán automáticamente:

- **Calendario:** Cada día a las 02:00 UTC
- **Releases:** Cada minuto de 08:00 a 20:00 UTC

No necesitas hacer nada más. Los datos se actualizarán solos.

---

## ⚠️ Si TradingEconomics No Está Disponible

Si no puedes obtener una API key de TradingEconomics, puedes:

1. **Usar otro proveedor:** Implementar `InvestingProvider` o `FXStreetProvider`
2. **Datos manuales:** Insertar eventos manualmente usando `/admin/calendar`
3. **Mock data:** Para desarrollo, crear datos de prueba

---

## 📝 Ver Documentación Completa

Ver `docs/CONFIGURACION-AUTOMATICA-CALENDARIO.md` para configuración completa.

