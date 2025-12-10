# 🔍 Guía Completa: Verificación 100% de Base de Datos Turso

## Objetivo
Confirmar al 100% que local y Vercel usan **EXACTAMENTE** la misma BD Turso y ejecutan las mismas consultas.

---

## 📋 Parte A: Verificar Logs de getUnifiedDB()

### A.1. Logs en Vercel

**Pasos:**
1. Espera al último deploy completado
2. Abre la ruta `/dashboard` en producción: `https://macro-dashboard-seven.vercel.app/dashboard`
3. Ve a **Vercel Dashboard** → Tu Proyecto → **Logs** → **Function** → **Route /dashboard**
4. Busca la línea: `[db] getUnifiedDB() - Using DB`
5. **Copia el objeto completo** que se loguea

**Formato esperado:**
```json
{
  "env": "production",
  "url": "libsql://macro-dashboard-cmll1992.aws-eu-west-1.turso.io",
  "tokenLength": 200,
  "isTurso": true,
  "isVercel": true
}
```

**Escribe claramente los valores:**
- `env` = ?
- `url` = ?
- `tokenLength` = ?
- `isTurso` = ?
- `isVercel` = ?

### A.2. Logs en Local (Modo Producción)

**Pasos:**
1. Asegúrate de que `.env.local` tiene las variables de Turso:
   ```bash
   TURSO_DATABASE_URL=libsql://macro-dashboard-cmll1992.aws-eu-west-1.turso.io
   TURSO_AUTH_TOKEN=eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9...
   ```

2. Ejecuta:
   ```bash
   pnpm build
   pnpm start
   ```

3. Abre `http://localhost:3000/dashboard` (modo producción)

4. Mira la **consola del servidor** (no la del navegador) y busca el mismo log:
   ```
   [db] getUnifiedDB() - Using DB { ... }
   ```

**Escribe claramente los valores:**
- `env` = ?
- `url` = ?
- `tokenLength` = ?
- `isTurso` = ?
- `isVercel` = ?

### A.3. Comparación

**Si cualquiera de estos campos NO coincide:**
- ❌ `url` diferente → **NO están usando la misma BD**
- ❌ `tokenLength` diferente → **Token diferente**
- ❌ `isTurso` diferente → **Uno usa Turso y otro no**

**Solución:**
1. Verifica que `.env.local` tiene los **mismos valores** que Vercel → Settings → Environment Variables
2. Reinicia el servidor local
3. Repite la prueba

**Una vez alineado**, repite la prueba para confirmar que los logs son **idénticos** en ambos entornos.

---

## 📊 Parte B: Comparar Datos Reales con Endpoint de Debug

### B.1. Probar Endpoint en Local (Modo Producción)

**Con el servidor de producción local levantado:**
```bash
pnpm build
pnpm start
```

**Abre en el navegador:**
```
http://localhost:3000/api/debug/macro-indicador
```

**O con curl:**
```bash
curl http://localhost:3000/api/debug/macro-indicador | jq
```

**Resume el JSON así:**
- **Longitud de `raw.observations`**: ?
- **Los 2-3 últimos elementos de `raw.observations`**: 
  ```json
  [
    { "date": "...", "value": ... },
    { "date": "...", "value": ... },
    { "date": "...", "value": ... }
  ]
  ```
- **Campos principales de `processed.gdp_yoy`**:
  - `value` = ?
  - `date` = ?
  - `value_previous` = ?
  - `date_previous` = ?
  - `isStale` = ?

### B.2. Probar Endpoint en Vercel

**Abre:**
```
https://macro-dashboard-seven.vercel.app/api/debug/macro-indicador
```

**O con curl:**
```bash
curl https://macro-dashboard-seven.vercel.app/api/debug/macro-indicador | jq
```

**Haz el mismo resumen:**
- **Longitud de `raw.observations`**: ?
- **Los 2-3 últimos elementos**: (mismo formato)
- **Campos principales de `processed.gdp_yoy`**: (mismos campos)

### B.3. Análisis de Resultados

#### ✅ Caso 1: `raw.observations` diferente entre local y Vercel

**Diagnóstico:**
→ No están leyendo los mismos datos desde la BD (aunque la URL coincida).

**Posibles causas:**
- Hay entornos/flags que cambian la consulta o filtrado
- `NODE_ENV`, `IS_VERCEL`, etc. afectan la consulta
- `getSeriesObservations()` tiene lógica condicional por entorno

**Solución:**
1. Revisa `lib/db/read-macro.ts` → `getSeriesObservations()`
2. Busca condiciones tipo:
   ```typescript
   if (process.env.NODE_ENV === 'development') { ... }
   if (isVercel) { ... }
   ```
3. Asegúrate de que la consulta SQL es **idéntica** en ambos entornos:
   ```sql
   SELECT date, value 
   FROM macro_observations 
   WHERE series_id = ? 
   AND value IS NOT NULL 
   ORDER BY date ASC
   ```
4. Elimina cualquier lógica condicional que cambie la consulta

#### ✅ Caso 2: `raw.observations` igual, pero `processed` distinto

**Diagnóstico:**
→ El problema está en la transformación, no en la BD.

**Solución:**
1. **Habilita logs de debug:**
   - En `.env.local` (local): `DEBUG_DASHBOARD=true`
   - En Vercel → Settings → Environment Variables: `DEBUG_DASHBOARD=true`
   - Haz redeploy

2. **Compara logs de `buildIndicatorRows()`:**
   - Local: busca `[dashboard-data] buildIndicatorRows - First row sample`
   - Vercel: busca el mismo log en Logs → Function → `/dashboard`

3. **Busca diferencias de comportamiento condicionadas por entorno:**
   ```typescript
   // ❌ MALO - comportamiento diferente por entorno
   if (process.env.NODE_ENV === 'development') { ... }
   if (isVercel) { ... }
   if (!isProd) { ... }
   ```

4. **Asegúrate de que:**
   - El cálculo de "Dato anterior", "Evolución", "Postura" **NO depende del entorno**
   - Solo depende de los datos
   - `computePrevCurr()` siempre hace lo mismo

5. **Si hace falta, simplifica:**
   ```typescript
   // ✅ BUENO - siempre igual
   const prev = observations[observations.length - 2] ?? null
   const last = observations[observations.length - 1] ?? null
   // Calcular evolución, postura, etc. siempre igual
   ```

#### ✅ Caso 3: `processed` también es igual, pero la UI de Vercel muestra más "—"

**Diagnóstico:**
→ El problema está en el componente React (renderización).

**Solución:**
1. Revisa el componente de la tabla de indicadores:
   - `app/dashboard/page.tsx`
   - Componentes relacionados

2. Busca condiciones tipo:
   ```typescript
   // ❌ MALO
   if (process.env.NODE_ENV === 'development') { ... }
   if (isVercel) { ... }
   ```

3. Asegúrate de que:
   - La tabla recibe y renderiza **exactamente** los datos de `processed` en ambos entornos
   - No hay filtrado condicional en producción
   - Los valores `null` se muestran como "—" de forma consistente

---

## 🔍 Verificación de Lógica Condicional

### Archivos a Revisar

1. **`lib/db/read-macro.ts`**:
   - `getSeriesObservations()` - debe hacer la misma consulta siempre
   - `getAllLatestFromDBWithPrev()` - debe procesar igual siempre

2. **`lib/macro/prev-curr.ts`**:
   - `computePrevCurr()` - debe calcular igual siempre
   - `isStale()` - debe calcular igual siempre

3. **`lib/dashboard-data.ts`**:
   - `buildIndicatorRows()` - debe transformar igual siempre

4. **`app/dashboard/page.tsx`**:
   - Renderizado de la tabla - debe mostrar igual siempre

### Comandos para Buscar Lógica Condicional

```bash
# Buscar condiciones por NODE_ENV
grep -r "NODE_ENV" lib/ app/

# Buscar condiciones por isVercel
grep -r "isVercel" lib/ app/

# Buscar condiciones por isProd
grep -r "isProd\|isProduction" lib/ app/
```

---

## ✅ Checklist Final

- [ ] Logs de `getUnifiedDB()` en Vercel muestran la misma URL que local
- [ ] `tokenLength` es igual en ambos
- [ ] `isTurso` es `true` en ambos
- [ ] `/api/debug/macro-indicador` en local muestra datos
- [ ] `/api/debug/macro-indicador` en Vercel muestra datos
- [ ] `raw.observations` es igual en ambos (mismas fechas y valores)
- [ ] `processed.gdp_yoy` es igual en ambos (mismo value, previous, dates)
- [ ] Logs de `buildIndicatorRows()` muestran los mismos datos en ambos
- [ ] No hay lógica condicional que cambie el comportamiento por entorno
- [ ] La UI muestra los mismos datos en ambos entornos

---

## 📝 Notas

- El endpoint `/api/debug/macro-indicador` usa el indicador `GDPC1` (GDP) como ejemplo
- Puedes modificar el endpoint para probar otros indicadores cambiando `seriesId`
- Los logs de debug solo aparecen en desarrollo o con `DEBUG_DASHBOARD=true`
- Si encuentras diferencias, documenta exactamente qué campo difiere y en qué valor













