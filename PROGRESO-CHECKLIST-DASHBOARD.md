# 📋 Progreso Checklist Dashboard - Dejar 100% Operativo

**Fecha inicio:** 2025-12-17  
**Estado:** En progreso

---

## ✅ Tareas Completadas

### 1. ✅ GBP/JPY: Jobs mejorados con verificación de inserts
- **Estado:** Mejorado
- **Cambios:**
  - Añadida verificación de conteo antes/después de inserts en jobs UK/JP
  - Mejorado logging con `beforeCount`, `afterCount`, `newRows`, `firstDate`, `lastDate`
- **Pendiente:** Ejecutar manualmente para poblar datos históricos

### 4. ✅ Pares tácticos: Filtrado de insufficient_data
- **Estado:** Implementado
- **Cambios:**
  - Añadido filtro en `lib/dashboard-data.ts` línea ~637
  - Filtra pares donde base o quote tienen `insufficient_data`
  - Usa función `extractCurrenciesFromPair()` para extraer monedas

### 5. ✅ Escenarios: Filtrado de insufficient_data
- **Estado:** Implementado
- **Cambios:**
  - Añadido filtro en `lib/dashboard-data.ts` línea ~660
  - Filtra escenarios donde base o quote tienen `insufficient_data`
  - Mismo helper `extractCurrenciesFromPair()` reutilizado

---

## 🔄 Tareas En Progreso

### 1. GBP/JPY: Ejecutar jobs manualmente
- **Estado:** Jobs mejorados, falta ejecución
- **Próximo paso:** 
  - Verificar `TRADING_ECONOMICS_API_KEY` en variables de entorno
  - Ejecutar `/api/jobs/ingest/uk` manualmente
  - Ejecutar `/api/jobs/ingest/jp` manualmente
  - Verificar logs y confirmar inserts en BD

### 2. AUD: Mapear indicadores
- **Estado:** Pendiente
- **Decisión:** Mapear (hay pares tácticos con AUD)
- **Próximo paso:**
  - Añadir mapeo en `currency-indicators.json`
  - Crear `config/au-indicators.json`
  - Crear `/api/jobs/ingest/au/route.ts`
  - Añadir al cron workflow

### 3. USD/EUR: Revisar pipelines obsoletos
- **Estado:** Pendiente
- **Próximo paso:**
  - Revisar `/api/jobs/ingest/fred`
  - Revisar `/api/jobs/ingest/european`
  - Verificar por qué datos se quedaron en 2025-09-01
  - Ejecutar manualmente y verificar actualización

### 6. Régimen global: Validación de cobertura
- **Estado:** Pendiente
- **Próximo paso:**
  - Añadir función `validateGlobalRegimeCoverage()`
  - Verificar cobertura mínima (30%) y frescura de indicadores clave
  - Mostrar aviso en UI si está calculado con datos incompletos/obsoletos

### 7. Tabla indicadores: Columna última actualización
- **Estado:** Pendiente
- **Próximo paso:**
  - Obtener `last_updated` desde `macro_series` en `getAllLatestFromDBWithPrev()`
  - Añadir campo `lastUpdated` a `IndicatorRow`
  - Añadir columna en tabla del dashboard
  - Ordenar por más obsoleto primero

---

## 📝 Notas Técnicas

### Jobs UK/JP
- **Fuente:** Trading Economics
- **Config:** `config/uk-indicators.json`, `config/jp-indicators.json`
- **Endpoint:** `/api/jobs/ingest/uk`, `/api/jobs/ingest/jp`
- **Cron:** Ya están en `.github/workflows/daily-jobs.yml` (líneas 24-42)

### Filtrado de Pares/Escenarios
- **Lógica:** Verifica `currencyRegimes[currency]?.regime === 'insufficient_data'`
- **Impacto:** Pares como GBPUSD, USDJPY, AUDUSD no aparecerán si una moneda tiene insufficient_data

---

## 🎯 Próximos Pasos Inmediatos

1. **Ejecutar jobs UK/JP manualmente** (verificar API key primero)
2. **Crear mapeo y job AUD** (siguiendo patrón UK/JP)
3. **Añadir columna última actualización** (quick win)
4. **Añadir validación régimen global** (importante para evitar señales falsas)
5. **Revisar pipelines USD/EUR** (investigar por qué datos obsoletos)
