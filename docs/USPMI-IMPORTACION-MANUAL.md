# Importación Manual USPMI (ISM Manufacturing PMI)

**Fecha**: 2025-12-17  
**Estado**: ✅ Implementación completa y activa  
**Fuente**: ISM (Institute for Supply Management) - datos oficiales  
**Método**: Importación manual vía CSV

---

## ⚠️ Nota importante

**USPMI se mantiene por importación manual hasta disponer de API profesional (Trading Economics).**

- ✅ **Estado actual**: Datos importados manualmente desde CSV
- 📊 **Fuente**: ISM (Institute for Supply Management) - datos oficiales
- 🔄 **Actualización**: Manual mensual (ver procedimiento abajo)
- 🚀 **Futuro**: Cuando Trading Economics esté disponible, se migrará a ingesta automática

---

## 🎯 Objetivo

Importar US ISM Manufacturing PMI manualmente desde datos oficiales ISM, normalizarlos y guardarlos en `macro_observations` con:
- `series_id = 'USPMI'`
- `source = 'MANUAL_ISM'`

**Por qué manual**: Trading Economics requiere plan de pago para acceso a datos de Estados Unidos. Esta solución permite usar datos oficiales de ISM sin depender de APIs de pago.

---

## 📋 Requisitos

### 1. Archivo CSV

**Ubicación**: `data/manual/USPMI.csv`

**Formato**:
```csv
date,value
1990-01,52.1
1990-02,51.9
1990-03,52.4
...
2025-12,49.4
```

**Reglas**:
- Primera línea: headers `date,value`
- `date`: Formato `YYYY-MM` (ej: `1990-01`, `2025-12`)
- `value`: Número (PMI típicamente 0-100)
- Sin filas vacías
- Sin headers extra

**Formatos de fecha aceptados**:
- `YYYY-MM` (recomendado): `1990-01`
- `YYYY-MM-DD`: `1990-01-15` (se normaliza a `1990-01-01`)
- `MM/YYYY`: `01/1990`
- `DD/MM/YYYY` o `MM/DD/YYYY`: `15/01/1990`

### 2. Variables de entorno

```bash
TURSO_DATABASE_URL=...
TURSO_AUTH_TOKEN=...
```

Cargadas desde `.env.local` o exportadas en el shell.

---

## 🚀 Uso

### Paso 1: Preparar CSV

1. Descargar datos oficiales de ISM Manufacturing PMI
2. Convertir a formato CSV con columnas `date,value`
3. Guardar en `data/manual/USPMI.csv`

**Ejemplo de conversión desde Excel**:
- Columna A: Fecha (formato `YYYY-MM`)
- Columna B: PMI (número)
- Exportar como CSV con headers `date,value`

### Paso 2: Ejecutar script

```bash
cd ~/Desktop/"macro-dashboard-with-data 2"
set -a && source .env.local && set +a
pnpm tsx scripts/import-uspmi-manual.ts
```

**O con NODE_OPTIONS**:
```bash
NODE_OPTIONS="--conditions=react-server" pnpm tsx scripts/import-uspmi-manual.ts
```

### Paso 3: Validar

```bash
set -a && source .env.local && set +a

node - <<'NODE'
const { createClient } = require("@libsql/client");
const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
});
(async () => {
  const r = await client.execute({
    sql: "SELECT COUNT(*) n, MIN(date) min_date, MAX(date) max_date, ROUND(AVG(value), 2) avg_value FROM macro_observations WHERE series_id='USPMI'"
  });
  console.log(r.rows[0]);
})();
NODE
```

**Esperado**:
- `n > 300` (observaciones)
- `min_date`: ~1990-01-01 (o fecha más antigua disponible)
- `max_date`: Fecha reciente
- `avg_value`: ~50-55 (rango típico de PMI)

---

## 📊 Comportamiento del script

### Normalización automática

- **Fechas**: Todas se normalizan a `YYYY-MM-01` (primer día del mes)
- **Valores**: Se validan (deben ser números, típicamente 0-100)
- **Duplicados**: Se omiten automáticamente (usando `ON CONFLICT`)

### Evita duplicados

El script **NO borra** datos existentes automáticamente. Si quieres reset completo:

```sql
DELETE FROM macro_observations WHERE series_id='USPMI';
```

Luego ejecuta el script nuevamente.

### Logs detallados

El script muestra:
- ✅ Filas parseadas
- ⚠️ Errores de parsing (si los hay)
- 📊 Rango de fechas y valores
- 🔍 Duplicados detectados
- 💾 Observaciones insertadas
- 📈 Estadísticas finales en BD

---

## 🔄 Integración con el sistema

### Job `ingest_fred`

**Comportamiento actual**:
- USPMI **NO** se ingesta automáticamente desde Trading Economics (requiere plan de pago)
- Si USPMI existe en BD (manual o futuro Trading Economics) → el dashboard lo muestra
- Si no existe → `pmi_mfg` queda `null` (no rompe nada)

**No se requiere modificar el job**. La importación manual es completamente independiente.

### Dashboard

Una vez importado, `pmi_mfg` aparecerá automáticamente en el dashboard:
- `key: 'pmi_mfg'`
- `series_id: 'USPMI'`
- `source: 'MANUAL_ISM'`

---

## 🔮 Migración futura a Trading Economics

**Cuando tengas plan de pago de Trading Economics**:

### Pasos de migración

1. **Activar ingestor** (ya implementado):
   - El código en `packages/ingestors/tradingEconomics.ts` ya está listo
   - Solo necesita API key con acceso a Estados Unidos
   - Configurar `TRADING_ECONOMICS_API_KEY` en `.env.local` y Vercel

2. **Opcional: Limpiar datos manuales** (recomendado para consistencia):
   ```sql
   -- En Turso
   DELETE FROM macro_observations WHERE series_id='USPMI';
   DELETE FROM macro_series WHERE series_id='USPMI';
   ```

3. **Ejecutar job de ingesta automática**:
   ```bash
   curl -X POST "http://localhost:3001/api/jobs/ingest/fred?reset=true&batch=1&only=USPMI" \
     -H "Authorization: Bearer dev_local_token"
   ```

4. **Resultado**: 
   - Datos de Trading Economics reemplazan manuales
   - Mismo `series_id='USPMI'`
   - `source` cambia de `'MANUAL_ISM'` a `'TRADING_ECONOMICS'`
   - El dashboard no cambia (mismo indicador)
   - El histórico se mantiene (o se reemplaza si hiciste DELETE)

### Ventajas de la migración

- ✅ Actualización automática mensual (sin intervención manual)
- ✅ Datos históricos más completos (si Trading Economics los tiene)
- ✅ Consistencia con otras series del sistema
- ✅ Sin cambios en el código (ya está implementado)

**Sin deuda técnica**: No hay cambios necesarios en el código. El sistema ya está preparado.

---

## 📅 Procedimiento mensual de actualización

### Paso a paso (1 minuto)

1. **Obtener nuevo valor de PMI**:
   - ISM publica el PMI el **primer día hábil de cada mes**
   - Fuente: https://www.ismworld.org/supply-management-news-and-reports/reports/ism-pmi-reports/

2. **Añadir al CSV**:
   ```bash
   # Editar data/manual/USPMI.csv
   # Añadir nueva línea al final:
   2026-01,XX.X
   ```

3. **Ejecutar script**:
   ```bash
   cd ~/Desktop/"macro-dashboard-with-data 2"
   set -a && source .env.local && set +a
   NODE_OPTIONS="--conditions=react-server" pnpm tsx scripts/import-uspmi-manual.ts
   ```

4. **Validar**:
   ```bash
   # Verificar en dashboard
   curl -s http://localhost:3001/api/dashboard | jq '[.data.indicators[] | select(.key == "pmi_mfg")][0]'
   ```

**Tiempo total**: ~1 minuto

---

## 📝 Fuentes de datos oficiales

### ISM (Institute for Supply Management)

**Website**: https://www.ismworld.org/supply-management-news-and-reports/reports/ism-pmi-reports/

**Datos disponibles**:
- ISM Manufacturing PMI (mensual)
- Publicación: Primer día hábil del mes
- Formato: PDF, Excel, CSV (según disponibilidad)

**Alternativas**:
- FRED (removido en 2016, no disponible)
- Trading Economics (requiere plan de pago para US)
- ISM directo (scraping manual o descarga)

---

## ✅ Checklist de importación

- [ ] CSV preparado en `data/manual/USPMI.csv`
- [ ] Formato correcto (`date,value`)
- [ ] Variables de entorno configuradas
- [ ] Script ejecutado sin errores
- [ ] Validación en BD: `count > 300`
- [ ] Dashboard muestra `pmi_mfg` con valor

---

## 🐛 Troubleshooting

### Error: "Cannot normalize date"

**Causa**: Formato de fecha no reconocido  
**Solución**: Usar formato `YYYY-MM` (ej: `1990-01`)

### Error: "Invalid PMI value"

**Causa**: Valor no numérico  
**Solución**: Verificar que la columna `value` contiene solo números

### Error: "TURSO_DATABASE_URL not configured"

**Causa**: Variables de entorno no cargadas  
**Solución**: Ejecutar `set -a && source .env.local && set +a` antes del script

### "Todas las observaciones ya existen"

**Causa**: Datos ya importados previamente  
**Solución**: Si quieres reimportar, borrar primero:
```sql
DELETE FROM macro_observations WHERE series_id='USPMI';
```

---

## 📌 Notas importantes

1. **Datos oficiales**: Esta solución usa datos oficiales de ISM, garantizando calidad profesional
2. **Sin dependencias externas**: No requiere APIs de pago ni keys externas
3. **Fácil de mantener**: CSV simple, script claro, logs detallados
4. **Sin hacks**: Integración limpia con el pipeline existente
5. **Fácil de retirar**: Cuando Trading Economics esté disponible, simplemente ejecutar el job

---

**Estado**: ✅ Listo para usar. Solo falta preparar el CSV con datos oficiales de ISM.
