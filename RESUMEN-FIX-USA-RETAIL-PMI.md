# ✅ Fix USA Retail YoY y PMI Manufacturing - Resumen

**Fecha:** 2025-01-XX  
**Estado:** ✅ **RETAIL_YOY COMPLETADO** | ⚠️ **PMI_MFG PENDIENTE (requiere fuente externa)**

---

## 📊 Resultados

### Cobertura US
- **Antes:** 88% (15/17 indicadores)
- **Después:** 94% (16/17 indicadores) ✅
- **Objetivo:** 100% (17/17) - Pendiente: PMI Manufacturing

---

## ✅ 1. Retail YoY (retail_yoy) - COMPLETADO

### Problema
- Indicador mostraba `value: null` en dashboard
- Config intentaba usar `fredTransform: 'pc1'` (FRED units=pc1)
- FRED puede no soportar `units=pc1` para RSAFS, o los datos se estaban ingiriendo como YoY en lugar de nivel crudo

### Solución Implementada
1. **Config (`config/macro-indicators.ts`)**:
   - ❌ Eliminado: `fredTransform: 'pc1'`
   - ✅ Añadido: `transform: 'yoy'` (calcular YoY desde nivel crudo)

2. **Job FRED (`app/api/jobs/ingest/fred/route.ts`)**:
   - ✅ Añadida lógica para forzar re-ingesta de RSAFS como nivel crudo
   - ✅ Borrado de datos antiguos (YoY) antes de re-ingerir nivel crudo

3. **Transformación (`lib/db/read-macro.ts`)**:
   - ✅ Ya soportaba `transform: 'yoy'` usando función `yoy()` de `lib/fred.ts`
   - ✅ Calcula YoY desde nivel crudo: `((value / value_12_months_ago) - 1) * 100`

### Verificación
```json
{
  "retail_yoy": {
    "value": 8.58,
    "date": "2025-10-01"
  }
}
```
✅ **Funciona correctamente** - Valor calculado desde nivel crudo (732633 → 8.58% YoY)

---

## ⚠️ 2. PMI Manufacturing (pmi_mfg) - PENDIENTE

### Problema
- Indicador muestra `value: null` en dashboard
- No hay datos de USPMI en BD (count: 0)

### Causa
USPMI no está disponible en FRED. El sistema intenta obtenerlo de:
1. **Alpha Vantage** (requiere `ALPHA_VANTAGE_API_KEY`)
2. **Job PMI** (`/api/jobs/ingest/pmi`) - solo ingiere si hay eventos de calendario para hoy
3. **Inserción manual** (`/api/admin/pmi/insert`)

### Estado Actual
- ❌ Alpha Vantage: Probablemente no configurado (`ALPHA_VANTAGE_API_KEY` no presente)
- ❌ Job PMI: No hay eventos de calendario para hoy (solo ingiere eventos del día actual)
- ✅ Endpoint manual disponible: `/api/admin/pmi/insert`

### Soluciones Posibles

#### Opción A: Configurar Alpha Vantage (Recomendado)
```bash
# En Vercel, añadir variable de entorno:
ALPHA_VANTAGE_API_KEY=tu_api_key_aqui
```

El job FRED intentará ingerir USPMI desde Alpha Vantage automáticamente cuando:
- Es el último batch del job
- `ALPHA_VANTAGE_API_KEY` está configurado
- No se ha excedido el tiempo límite

#### Opción B: Inserción Manual
Usar el endpoint `/api/admin/pmi/insert` para insertar valores manualmente:

```bash
curl -X POST https://macro-dashboard-seven.vercel.app/api/admin/pmi/insert \
  -H "Authorization: Bearer ${CRON_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"date": "2025-12-01", "value": 52.5}'
```

#### Opción C: Mejorar Job PMI para Eventos Históricos
Modificar `/api/jobs/ingest/pmi` para que también ingiera eventos de calendario históricos (últimos 30 días) en lugar de solo eventos de hoy.

---

## 📈 Impacto

### Cobertura US
- **Antes:** 88% (15/17)
- **Después:** 94% (16/17) ✅
- **Con PMI:** 100% (17/17) - Pendiente

### Indicadores Funcionando
- ✅ **retail_yoy**: 8.58% (2025-10-01)
- ⚠️ **pmi_mfg**: null (requiere fuente externa)

---

## 🔧 Archivos Modificados

1. ✅ `config/macro-indicators.ts` - Cambiado `retail_yoy` de `fredTransform: 'pc1'` a `transform: 'yoy'`
2. ✅ `app/api/jobs/ingest/fred/route.ts` - Añadida lógica para forzar re-ingesta de RSAFS como nivel crudo
3. ✅ `app/api/debug/usa-indicators/route.ts` - Endpoint de debug para verificar datos en BD
4. ✅ `app/api/debug/pmi-calendar/route.ts` - Endpoint de debug para verificar eventos PMI en calendario

---

## ✅ Checklist

- [x] RSAFS se ingiere como nivel crudo (no YoY)
- [x] Transformación YoY se calcula correctamente en `read-macro.ts`
- [x] `retail_yoy` muestra valor en dashboard (8.58%)
- [x] Cobertura US sube a 94% (16/17)
- [ ] USPMI se ingiere desde Alpha Vantage o manualmente
- [ ] Cobertura US alcanza 100% (17/17)

---

## 🎯 Próximos Pasos

1. **Para alcanzar 100% cobertura US:**
   - Configurar `ALPHA_VANTAGE_API_KEY` en Vercel, O
   - Insertar USPMI manualmente usando `/api/admin/pmi/insert`, O
   - Mejorar job PMI para ingerir eventos históricos

2. **Verificación final:**
   ```bash
   curl https://macro-dashboard-seven.vercel.app/api/dashboard | jq '.data.coverage.US'
   # Debería mostrar: { "total": 17, "withData": 17, "percentage": 100 }
   ```

---

## 📝 Notas Técnicas

### Por qué RSAFS necesita nivel crudo
- FRED `units=pc1` puede no estar disponible para todas las series
- Calcular YoY localmente desde nivel crudo es más robusto
- Permite control total sobre la transformación

### Por qué USPMI no está en FRED
- ISM Manufacturing PMI es publicado por Institute for Supply Management (ISM)
- FRED no tiene esta serie directamente
- Alternativas: Alpha Vantage, Trading Economics (removido), inserción manual

---

## 🎉 Conclusión

**Retail YoY:** ✅ **COMPLETADO Y FUNCIONANDO**  
**PMI Manufacturing:** ⚠️ **PENDIENTE - Requiere configuración externa o inserción manual**

**Cobertura US:** 88% → **94%** (falta solo PMI para llegar a 100%)
