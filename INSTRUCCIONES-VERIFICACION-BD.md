# 🔍 Instrucciones: Verificación 100% de Base de Datos Turso

## Objetivo
Confirmar al 100% que local y Vercel usan **EXACTAMENTE** la misma BD Turso y ejecutan las mismas consultas.

---

## 📋 Paso 1: Ver Logs Reales de getUnifiedDB en Vercel

### 1.1. Verificar que los logs están actualizados
Los logs ahora incluyen:
```typescript
{
  env: process.env.NODE_ENV,
  url: process.env.TURSO_DATABASE_URL || 'NO_TURSO_URL',
  tokenLength: process.env.TURSO_AUTH_TOKEN?.length || 0,
  isTurso: USE_TURSO,
  isVercel: isVercel,
}
```

### 1.2. Ver logs en Vercel
1. Ve a: https://vercel.com/dashboard
2. Selecciona tu proyecto `macro-dashboard`
3. **Logs** → **Function** → Busca rutas que usen `/dashboard`
4. Busca el log: `[db] getUnifiedDB() - Using DB`
5. **Copia y pega aquí el objeto completo** `{ env, url, tokenLength, isTurso }`

### 1.3. Ver el mismo log en local (modo producción)
En local, con `.env.local` cargado:
```bash
pnpm build
pnpm start
```

Abre `http://localhost:3000/dashboard` y mira en la **consola del servidor** (no la del navegador) el mismo log:
```
[db] getUnifiedDB() - Using DB { ... }
```

### 1.4. Comparar
- ✅ `url` debe ser **exactamente igual** (mismo host, mismo nombre de BD)
- ✅ `tokenLength` debe ser igual
- ✅ `isTurso` debe ser `true` en ambos

**Si cualquiera de esos campos no coincide**, entonces local y Vercel **NO** están usando la misma BD, y hay que corregir las env vars que toque.

---

## 📊 Paso 2: Comparar Datos "En Crudo" con Endpoint de Debug

### 2.1. Endpoint de Debug Creado
Se ha creado `/api/debug/macro-indicador` que muestra:
- Datos raw de la BD (series metadata + últimas 10 observaciones)
- Datos procesados (usando la misma función que el dashboard)
- Información del entorno (env, url, isTurso)

### 2.2. Probar en Local
```bash
pnpm build
pnpm start
```

Abre: `http://localhost:3000/api/debug/macro-indicador`

**Copia el JSON completo** que devuelve (especialmente `row`, `env`, `url`, `processed`).

### 2.3. Probar en Vercel
Abre: `https://macro-dashboard-seven.vercel.app/api/debug/macro-indicador`

**Copia el JSON completo** que devuelve.

### 2.4. Comparar los Resultados

#### Si `raw.observations` es distinto entre local y Vercel:
→ **No están leyendo los mismos datos de la BD**

**Solución**:
1. Verifica que la URL de Turso coincide exactamente
2. Revisa si alguna función de lectura usa otra tabla/esquema en prod
3. Verifica que no hay caché o datos stale

#### Si `raw.observations` es igual, pero `processed` es distinto:
→ **El problema está en la lógica de procesamiento**

**Solución**:
1. Revisa los logs de `buildIndicatorRows()` en ambos entornos
2. Compara las transformaciones (YoY, QoQ, etc.)
3. Verifica que `computePrevCurr()` recibe los mismos datos

#### Si `processed` es igual en ambos:
→ **El problema está en la UI o en cómo se renderizan los datos**

**Solución**:
1. Revisa el componente del dashboard
2. Verifica que los datos se pasan correctamente al frontend
3. Compara los logs del navegador en ambos entornos

---

## 🔍 Paso 3: Logs de Transformación de Datos

### 3.1. Habilitar Logs de Debug
En `lib/dashboard-data.ts`, la función `buildIndicatorRows()` ahora loguea el primer row cuando:
- `NODE_ENV === 'development'` O
- `DEBUG_DASHBOARD=true` está configurado

### 3.2. Ver Logs en Local
```bash
# En .env.local, añade:
DEBUG_DASHBOARD=true

pnpm build
pnpm start
```

Abre `http://localhost:3000/dashboard` y busca en los logs del servidor:
```
[dashboard-data] buildIndicatorRows - First row sample: { ... }
```

### 3.3. Ver Logs en Vercel
1. Ve a Vercel → Settings → Environment Variables
2. Añade: `DEBUG_DASHBOARD=true`
3. Haz redeploy
4. Ve a Logs → Function → `/dashboard`
5. Busca el mismo log

### 3.4. Comparar
Compara:
- `rawInput` (lo que viene de la BD)
- `value`, `previous`, `date`, `isStale` (lo que se muestra en la UI)

Si `rawInput` es igual pero `value`/`previous` es distinto → problema en la transformación.

---

## ✅ Checklist de Verificación

- [ ] Logs de `getUnifiedDB()` en Vercel muestran la misma URL que local
- [ ] `tokenLength` es igual en ambos entornos
- [ ] `isTurso` es `true` en ambos
- [ ] `/api/debug/macro-indicador` en local muestra datos
- [ ] `/api/debug/macro-indicador` en Vercel muestra datos
- [ ] `raw.observations` es igual en ambos (mismas fechas y valores)
- [ ] `processed.gdp_yoy` es igual en ambos (mismo value, previous, dates)
- [ ] Logs de `buildIndicatorRows()` muestran los mismos datos en ambos

---

## 🐛 Troubleshooting

### Si la URL no coincide:
1. Verifica `.env.local` tiene los mismos valores que Vercel
2. Reinicia el servidor local
3. Verifica que Vercel tiene las variables correctas en Settings → Environment Variables

### Si los datos raw son diferentes:
1. Verifica que ambos apuntan a la misma BD Turso
2. Ejecuta los jobs de ingestión en producción
3. Verifica que no hay múltiples BDs Turso creadas

### Si los datos procesados son diferentes:
1. Compara los logs de `buildIndicatorRows()`
2. Verifica que las transformaciones (YoY, QoQ) se aplican igual
3. Revisa que `computePrevCurr()` recibe los mismos datos

---

## 📝 Notas

- El endpoint `/api/debug/macro-indicador` usa el indicador `GDPC1` (GDP) como ejemplo
- Puedes modificar el endpoint para probar otros indicadores cambiando `seriesId`
- Los logs de debug solo aparecen en desarrollo o con `DEBUG_DASHBOARD=true`
























