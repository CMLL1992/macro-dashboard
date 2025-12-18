# Diagnóstico: Ingesta UK/JP (0% cobertura)

**Fecha:** 2025-12-17  
**Problema:** GBP y JPY tienen 0% cobertura (0 indicadores con datos)

---

## ✅ Lo que SÍ existe

1. **Jobs configurados:**
   - `/api/jobs/ingest/uk` ✅ Existe
   - `/api/jobs/ingest/jp` ✅ Existe

2. **Configuraciones:**
   - `config/uk-indicators.json` ✅ 11 indicadores configurados
   - `config/jp-indicators.json` ✅ 12 indicadores configurados
   - IDs coinciden con `currency-indicators.json` ✅

3. **Mapeo correcto:**
   - Los jobs usan `indicator.id` como `series_id` en BD
   - Estos IDs coinciden exactamente con los esperados en `currency-indicators.json`

---

## 🔴 Problemas identificados

### 1. Trading Economics devuelve HTTP 404 para todos los indicadores

**Síntoma:**
```json
{
  "success": true,
  "ingested": 0,
  "errors": 11,
  "ingestErrors": [
    {"indicatorId": "UK_GDP_QOQ", "error": "Trading Economics error: TradingEconomics HTTP 404: "},
    {"indicatorId": "UK_GDP_YOY", "error": "Trading Economics error: TradingEconomics HTTP 404: "},
    ...
  ]
}
```

**Causa probable:**
- Plan free de Trading Economics no permite acceso a datos UK/JP
- Endpoints incorrectos o desactualizados
- API key sin permisos para UK/JP

**Evidencia previa:**
- Ya se encontró el mismo problema con USPMI (403 No Access to this country as free user)
- Trading Economics free tier tiene limitaciones geográficas

### 2. No hay cron configurado en Vercel

**Estado actual (`vercel.json`):**
```json
{
  "crons": [
    { "path": "/api/jobs/ingest/fred", "schedule": "0 6 * * *" },
    { "path": "/api/jobs/ingest/european", "schedule": "0 7 * * *" },
    // ❌ No hay cron para /api/jobs/ingest/uk
    // ❌ No hay cron para /api/jobs/ingest/jp
  ]
}
```

**Impacto:** Los jobs no se ejecutan automáticamente, incluso si funcionaran.

### 3. No hay datos en BD

**Verificación:**
```sql
SELECT series_id FROM macro_observations 
WHERE series_id LIKE 'UK_%' OR series_id LIKE 'JP_%';
-- Resultado: 0 filas
```

**Confirmado:** No hay series UK/JP en la BD.

---

## 🎯 Soluciones Recomendadas

### Opción A: Migrar a fuentes oficiales gratuitas (Recomendado)

**Similar a lo hecho con EUR (Eurostat/ECB) y Calendar (fuentes oficiales):**

1. **UK (GBP):**
   - ONS (Office for National Statistics) - API oficial gratuita
   - BoE (Bank of England) - API oficial gratuita
   - Similar a cómo EUR usa Eurostat/ECB

2. **JP (JPY):**
   - Cabinet Office / Ministry of Finance - APIs oficiales
   - BoJ (Bank of Japan) - API oficial gratuita
   - Similar a cómo EUR usa ECB

**Ventajas:**
- ✅ Gratis y sin límites
- ✅ Datos oficiales y fiables
- ✅ Sin dependencia de Trading Economics

**Esfuerzo:** Medio (similar a implementación EUR)

### Opción B: Remover GBP/JPY del cálculo hasta tener datos

**Acción rápida:**
- Modificar `domain/diagnostic.ts` para excluir GBP/JPY del cálculo de regímenes
- Añadir validación: si `coverage < 0.3`, marcar como "insufficient_data"

**Ventajas:**
- ✅ Evita señales falsas ("mixed" por falta de datos)
- ✅ Implementación rápida (< 30 min)

**Desventajas:**
- ❌ No resuelve el problema de raíz
- ❌ Dashboard incompleto

### Opción C: Usar Trading Economics Premium (si está disponible)

**Solo si:**
- Ya tienes plan premium
- O estás dispuesto a pagar

**Acción:**
- Verificar permisos de API key
- Actualizar endpoints si es necesario

---

## 📋 Checklist de Verificación

### Para confirmar el problema:

1. ✅ Jobs existen: `/api/jobs/ingest/uk` y `/api/jobs/ingest/jp`
2. ✅ Configs existen: `uk-indicators.json` y `jp-indicators.json`
3. ✅ IDs coinciden: Los IDs en configs coinciden con `currency-indicators.json`
4. ❌ **Trading Economics devuelve 404** para todos los indicadores
5. ❌ **No hay cron** configurado en `vercel.json`
6. ❌ **No hay datos** en BD (0 series UK/JP)

### Próximos pasos:

1. **Decidir estrategia:**
   - [ ] Opción A: Migrar a fuentes oficiales (recomendado)
   - [ ] Opción B: Remover GBP/JPY temporalmente
   - [ ] Opción C: Verificar Trading Economics Premium

2. **Si Opción A:**
   - [ ] Investigar APIs oficiales ONS/BoE para UK
   - [ ] Investigar APIs oficiales Cabinet/BoJ para JP
   - [ ] Crear providers similares a `european/route.ts`
   - [ ] Actualizar configs con nuevos endpoints

3. **Si Opción B:**
   - [ ] Modificar `calcCurrencyRegime` para validar cobertura
   - [ ] Añadir "insufficient_data" como régimen válido
   - [ ] Actualizar UI para mostrar "sin datos suficientes"

---

## 🔍 Notas Técnicas

- Los jobs están bien implementados (código correcto)
- El problema es 100% de fuente de datos (Trading Economics 404)
- Similar al problema previo con USPMI (resuelto con importación manual)
- EUR funciona porque usa Eurostat/ECB (fuentes oficiales gratuitas)

---

## 📊 Comparación con EUR

| Aspecto | EUR | GBP/JPY |
|---------|-----|---------|
| Job existe | ✅ | ✅ |
| Config existe | ✅ | ✅ |
| Fuente | Eurostat/ECB (gratis) | Trading Economics (404) |
| Cron configurado | ✅ | ❌ |
| Datos en BD | ✅ 13 series | ❌ 0 series |
| Cobertura | 54% reciente | 0% |

**Conclusión:** EUR funciona porque usa fuentes oficiales gratuitas. GBP/JPY fallan porque dependen de Trading Economics que devuelve 404.
