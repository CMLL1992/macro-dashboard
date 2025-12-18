# 🔍 Verificación: Base de Datos Turso Local vs Vercel

## Objetivo
Asegurar que localhost y Vercel usan la **MISMA** base de datos Turso para tener datos consistentes.

---

## 📋 Paso 1: Verificar Configuración Actual

### En Vercel:
1. Ve a: https://vercel.com/dashboard
2. Selecciona tu proyecto `macro-dashboard`
3. **Settings** → **Environment Variables**
4. Anota los valores de:
   - `TURSO_DATABASE_URL`
   - `TURSO_AUTH_TOKEN`

### En Local:
Los valores deberían estar en `VALORES-TURSO.md`:
- `TURSO_DATABASE_URL`: `libsql://macro-dashboard-cmll1992.aws-eu-west-1.turso.io`
- `TURSO_AUTH_TOKEN`: (ver `VALORES-TURSO.md`)

---

## 🔧 Paso 2: Configurar .env.local

Crea o edita `.env.local` en la raíz del proyecto con los **mismos valores** que Vercel:

```bash
# Copia estos valores de Vercel → Settings → Environment Variables
TURSO_DATABASE_URL=libsql://macro-dashboard-cmll1992.aws-eu-west-1.turso.io
TURSO_AUTH_TOKEN=eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NjQyMzQxNTQsImlkIjoiMTUzZDEwOTAtNzE2ZS00NmZkLWEwYmEtOGFhZjUyNjVmZTI5IiwicmlkIjoiNjdjYmYzN2MtOTI2Zi00M2Y2LTk3OGEtYWEyMDVhMWI4N2U2In0.egH-WFdrxpUq-Wt1bTpdRVV7dfZ2DAIgrgdNFy6QQbzuWQ74wowHwsyaXXp1ja5Wt3hDNHiVu12pSm7M0VwbDw
```

**⚠️ IMPORTANTE**: Usa los valores **exactos** de Vercel, no los de `VALORES-TURSO.md` si son diferentes.

---

## ✅ Paso 3: Verificar que se Usa Turso

### En Local:
```bash
pnpm build
pnpm start
```

Abre `http://localhost:3000/dashboard` y revisa los logs del servidor. Deberías ver:

```
[db] getUnifiedDB() - Using Turso database: {
  env: 'production',
  url: 'libsql://macro-dashboard-cmll1992.aws-eu-west-1.turso.io',
  isVercel: false,
  hasToken: true,
  tokenLength: 200
}
```

### En Vercel:
Ve a **Logs** → **Function** → `/dashboard` y busca el mismo log. La URL debe ser **exactamente la misma**.

---

## 🔄 Paso 4: Comparar Datos

### Si los datos son diferentes:

#### Caso A: Vercel usa otra BD distinta
**Solución**: Apuntar Vercel a la BD que tiene todos los datos

1. Identifica qué BD tiene los datos correctos (probablemente la de local)
2. En Vercel → Settings → Environment Variables:
   - Actualiza `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN` para que apunten a la BD correcta
3. Haz un **Redeploy**
4. Verifica que el dashboard de producción muestra los mismos datos que localhost

#### Caso B: Misma BD pero datos diferentes
**Solución**: Ejecutar jobs de ingestión en producción

Los datos pueden ser diferentes porque:
- Local ha corrido jobs que no se han corrido en producción
- O viceversa

**Ejecutar jobs en producción**:

1. **Ingestión de datos FRED**:
   ```bash
   curl -X POST https://macro-dashboard-seven.vercel.app/api/jobs/ingest/fred \
     -H "Authorization: Bearer YOUR_CRON_TOKEN"
   ```

2. **Cálculo de correlaciones**:
   ```bash
   curl -X POST https://macro-dashboard-seven.vercel.app/api/jobs/correlations \
     -H "Authorization: Bearer YOUR_CRON_TOKEN"
   ```

3. **Cálculo de bias**:
   ```bash
   curl -X POST https://macro-dashboard-seven.vercel.app/api/jobs/compute/bias \
     -H "Authorization: Bearer YOUR_CRON_TOKEN"
   ```

   O ejecutar el job diario completo:
   ```bash
   curl -X POST https://macro-dashboard-seven.vercel.app/api/jobs/daily-update \
     -H "Authorization: Bearer YOUR_CRON_TOKEN"
   ```

4. **Verificar**:
   - Abre `https://macro-dashboard-seven.vercel.app/api/health`
   - Debe mostrar `hasData: true` y `observationCount > 0`
   - Abre `https://macro-dashboard-seven.vercel.app/dashboard`
   - Debe mostrar datos con "Dato anterior", "Evolución", etc.

---

## 🔍 Paso 5: Verificar Variables de Entorno

Compara las variables de entorno de `.env.local` con las de Vercel:

**Variables que afectan a los datos**:
- `USE_LIVE_SOURCES` - Si está en `true`, usa APIs en vivo en lugar de BD
- `ENABLE_QA` - Flags de QA/testing
- Cualquier otra flag que afecte a ingestión o cálculo

**Asegúrate de que estén iguales** en ambos entornos si quieres los mismos datos.

---

## 📊 Verificación Final

Después de alinear las configuraciones:

1. **Local**: `http://localhost:3000/dashboard`
   - Debe mostrar datos con "Dato anterior", "Evolución", etc.

2. **Vercel**: `https://macro-dashboard-seven.vercel.app/dashboard`
   - Debe mostrar los **mismos datos** que local
   - El bloque de resumen y diagnosis debe ser igual
   - La tabla de indicadores macro debe tener "Dato anterior", "Evolución", etc.

---

## 🐛 Troubleshooting

### Si local sigue usando SQLite:
- Verifica que `.env.local` existe y tiene las variables correctas
- Reinicia el servidor (`pnpm start`)
- Revisa los logs para ver qué BD se está usando

### Si Vercel no muestra datos:
- Verifica que las variables de entorno están configuradas en Vercel
- Verifica que el cron job diario se ha ejecutado al menos una vez
- Ejecuta manualmente los jobs de ingestión (ver Paso 4, Caso B)

### Si los datos son diferentes:
- Compara los logs de local y Vercel para ver qué BD se está usando
- Verifica que las URLs de Turso son exactamente iguales
- Ejecuta los jobs de ingestión en producción
























