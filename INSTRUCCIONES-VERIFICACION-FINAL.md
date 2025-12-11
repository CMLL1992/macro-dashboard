# 🔍 Instrucciones Finales: Verificación 100% de BD Turso

## Objetivo
Confirmar al 100% que local y Vercel usan **EXACTAMENTE** la misma BD Turso y ejecutan las mismas consultas.

---

## 📋 Parte 1: Verificar Logs de getUnifiedDB()

### A. Logs en Vercel (Producción)

**Pasos:**
1. Abre `https://macro-dashboard-seven.vercel.app/dashboard`
2. Ve a **Vercel Dashboard** → Tu Proyecto → **Logs** → **Function** → **Route /dashboard**
3. Busca la línea: `[db] getUnifiedDB() - Using DB`
4. **Copia el objeto completo** que aparece justo después

**Formato esperado:**
```json
{
  "env": "production",
  "url": "libsql://macro-dashboard-cmll1992.aws-eu-west-1.turso.io",
  "tokenLength": 279,
  "isTurso": true,
  "isVercel": true
}
```

**Escribe aquí los valores de Vercel:**
- `env` = ?
- `url` = ?
- `tokenLength` = ?
- `isTurso` = ?
- `isVercel` = ?

### B. Logs en Local (Modo Producción)

**⚠️ IMPORTANTE: Usa `pnpm start`, NO `pnpm dev`**

**Pasos:**
1. Ejecuta:
   ```bash
   pnpm build
   pnpm start
   ```

2. Abre `http://localhost:3000/dashboard`

3. Mira los **logs del servidor local** (no la consola del navegador)

4. Busca la misma línea: `[db] getUnifiedDB() - Using DB`

**Escribe aquí los valores de Local:**
- `env` = ?
- `url` = ?
- `tokenLength` = ?
- `isTurso` = ?
- `isVercel` = ?

### C. Comparación

**Si `url` o `tokenLength` NO coinciden:**
1. Verifica que `.env.local` tiene los mismos valores que Vercel → Settings → Environment Variables
2. Ajusta las variables `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN` (local o Vercel) para que sean **EXACTAMENTE** las mismas
3. Haz un redeploy en Vercel si cambiaste algo allí
4. Reinicia el servidor local si cambiaste `.env.local`

**Repite hasta que los dos logs sean idénticos**, salvo `isVercel` (debe ser `false` en local / `true` en Vercel).

---

## 📊 Parte 2: Comparar Datos con Endpoint de Debug

### A. Local (Modo Producción)

**Con `pnpm build && pnpm start` ya ejecutado:**

**Abre en el navegador:**
```
http://localhost:3000/api/debug/macro-indicador
```

**O con curl:**
```bash
curl http://localhost:3000/api/debug/macro-indicador | jq
```

**Resume el resultado así:**

- **`raw.observations.length`** = ?
- **Últimas 2-3 observaciones** (date y value):
  ```json
  [
    { "date": "...", "value": ... },
    { "date": "...", "value": ... },
    { "date": "...", "value": ... }
  ]
  ```
- **Para `processed.gdp_yoy`**:
  - `processed.gdp_yoy.current.value` = ?
  - `processed.gdp_yoy.previous.value` = ?
  - `processed.gdp_yoy.current.date` = ?
  - `processed.gdp_yoy.previous.date` = ?

### B. Vercel (Producción)

**Abre:**
```
https://macro-dashboard-seven.vercel.app/api/debug/macro-indicador
```

**O con curl:**
```bash
curl https://macro-dashboard-seven.vercel.app/api/debug/macro-indicador | jq
```

**Haz el mismo resumen:**
- **`raw.observations.length`** = ?
- **Últimas 2-3 observaciones**: (mismo formato)
- **Para `processed.gdp_yoy`**: (mismos campos)

### C. Análisis de Resultados

#### ✅ Caso 1: `raw.observations` local ≠ Vercel

**Diagnóstico:**
→ La BD o la consulta **NO son realmente iguales**.

**Qué hacer:**
1. **Explica qué diferencia ves exactamente:**
   - Ejemplo: "Local tiene 30 observaciones de GDPC1 y Vercel solo 1"
   - Ejemplo: "Las fechas no coinciden"
   - Ejemplo: "Los valores son diferentes"

2. **Ajusta lo necesario:**
   - Si la URL de Turso no coincide → corrige la configuración
   - Si la URL coincide pero los datos son diferentes → ejecuta los jobs de ingestión en el entorno que va cojo:
     ```bash
     # En Vercel, ejecuta manualmente:
     curl -X POST https://macro-dashboard-seven.vercel.app/api/jobs/daily-update \
       -H "Authorization: Bearer YOUR_CRON_TOKEN"
     ```

#### ✅ Caso 2: `raw.observations` son iguales, pero `processed` difiere

**Diagnóstico:**
→ El problema está en la función de transformación (`buildIndicatorRows` / `computePrevCurr`).

**Qué hacer:**
1. **Habilita logs de debug:**
   - En `.env.local` (local): `DEBUG_DASHBOARD=true`
   - En Vercel → Settings → Environment Variables: `DEBUG_DASHBOARD=true`
   - Haz redeploy en Vercel

2. **Compara logs de `computePrevCurr()`:**
   - Local: busca `[debug-indicator] computePrevCurr` en los logs del servidor
   - Vercel: busca el mismo log en Logs → Function → `/dashboard`

3. **Busca diferencias:**
   - Compara `latestDates`, `latestValues`, `prev`, `curr` entre local y Vercel
   - Si son diferentes, revisa la lógica de `computePrevCurr()`

4. **Asegúrate de que:**
   - La lógica **NO depende del entorno** (nada de `if (process.env.NODE_ENV === 'development')` que cambie el comportamiento)
   - `computePrevCurr()` siempre calcula igual, independientemente del entorno

#### ✅ Caso 3: `processed` también es igual, pero la UI de Vercel sigue mostrando "—"

**Diagnóstico:**
→ El problema está en el componente React que pinta la tabla.

**Qué hacer:**
1. **Habilita logs de debug UI:**
   - En `.env.local` (local): `DEBUG_DASHBOARD=true`
   - En Vercel → Settings → Environment Variables: `DEBUG_DASHBOARD=true`
   - Haz redeploy en Vercel

2. **Compara logs de renderizado:**
   - Local: busca `[debug-ui] macroIndicators row gdp_yoy` en los logs del servidor
   - Vercel: busca el mismo log en Logs → Function → `/dashboard`

3. **Verifica que el componente recibe los mismos datos:**
   - Si los logs muestran datos diferentes → problema en cómo se pasan los datos al componente
   - Si los logs muestran los mismos datos pero la UI muestra "—" → problema en el renderizado

4. **Revisa las condiciones de render:**
   - Busca en `app/dashboard/page.tsx`:
     ```typescript
     {row.previous ?? '—'}
     ```
   - Verifica que no hay lógica condicional que cambie el comportamiento en producción:
     ```typescript
     // ❌ MALO
     if (process.env.NODE_ENV === 'development') { ... }
     if (isVercel) { ... }
     ```

---

## 🔍 Logs de Debug Disponibles

### 1. Logs de Base de Datos
- `[db] getUnifiedDB() - Using DB` - Muestra qué BD se está usando

### 2. Logs de Transformación
- `[debug-indicator] computePrevCurr` - Muestra cómo se calcula previous/current (solo con `DEBUG_DASHBOARD=true`)
- `[dashboard-data] buildIndicatorRows - First row sample` - Muestra el primer row procesado (solo con `DEBUG_DASHBOARD=true`)

### 3. Logs de UI
- `[debug-ui] macroIndicators row gdp_yoy` - Muestra qué datos recibe el componente (solo con `DEBUG_DASHBOARD=true`)

---

## ✅ Checklist Final

- [ ] Logs de `getUnifiedDB()` en Vercel muestran la misma URL que local
- [ ] `tokenLength` es igual en ambos
- [ ] `isTurso` es `true` en ambos
- [ ] `/api/debug/macro-indicador` en local muestra datos
- [ ] `/api/debug/macro-indicador` en Vercel muestra datos
- [ ] `raw.observations.length` es igual en ambos
- [ ] `raw.observations` (últimas 2-3) son iguales en ambos
- [ ] `processed.gdp_yoy.current.value` es igual en ambos
- [ ] `processed.gdp_yoy.previous.value` es igual en ambos
- [ ] Logs de `computePrevCurr()` muestran los mismos datos en ambos (si `DEBUG_DASHBOARD=true`)
- [ ] Logs de `[debug-ui]` muestran los mismos datos en ambos (si `DEBUG_DASHBOARD=true`)
- [ ] La UI muestra los mismos datos en ambos entornos

---

## 📝 Notas

- El endpoint `/api/debug/macro-indicador` usa el indicador `GDPC1` (GDP) como ejemplo
- Los logs de debug solo aparecen cuando `DEBUG_DASHBOARD=true` está configurado
- Si encuentras diferencias, documenta exactamente qué campo difiere y en qué valor
- Una vez identificado el problema, aplica la solución correspondiente según el caso















