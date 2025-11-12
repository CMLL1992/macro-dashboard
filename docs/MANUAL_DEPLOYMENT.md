# 🚀 Deployment Manual en Vercel

Este documento explica cómo hacer un deployment manual en Vercel para asegurar que todo se ejecute correctamente.

## 📋 Pre-Deployment Checklist

Antes de hacer el deployment, verifica:

- [ ] Todos los cambios están en GitHub (último commit visible)
- [ ] `vercel.json` está en la raíz del proyecto
- [ ] Las variables de entorno están configuradas en Vercel
- [ ] Los secrets están configurados en GitHub

## 🔄 Opción 1: Redeploy desde Vercel Dashboard (Recomendado)

### Pasos:

1. **Ve a Vercel Dashboard** → Tu proyecto (`macro-dashboard`)

2. **Ve a Deployments** (en el menú superior)

3. **Encuentra el último deployment** (puede ser el que está en "Ready" o uno anterior)

4. **Click en los "..."** (tres puntos) del deployment

5. **Selecciona "Redeploy"**

6. **Configuración del Redeploy:**
   - ✅ **Marca "Use existing Build Cache"** (opcional, pero recomendado para velocidad)
   - O ✅ **Marca "Clear build cache"** si quieres un build completamente limpio
   - **Environment:** Production (asegúrate de que esté seleccionado)

7. **Click en "Redeploy"**

8. **Espera a que termine:**
   - El deployment tomará aproximadamente 2-3 minutos
   - Verás el progreso en tiempo real
   - Estado final: "Ready" (verde) o "Error" (rojo)

## 🔄 Opción 2: Trigger desde GitHub (Push)

Si prefieres que se dispare automáticamente:

1. **Haz un pequeño cambio** (puede ser un comentario en cualquier archivo)

2. **Commit y push:**
   ```bash
   git add .
   git commit -m "chore: trigger deployment"
   git push origin main
   ```

3. **Vercel detectará el push** y creará un nuevo deployment automáticamente

## ✅ Post-Deployment: Verificar Crons

Después de que el deployment termine exitosamente:

### 1. Verificar que los Crons Aparecen

1. Ve a **Settings** → **Cron Jobs** (o busca en el menú lateral)
2. Deberías ver 2 crons:
   - `/api/warmup` - `0 0 * * *`
   - `/api/jobs/weekly` - `0 17 * * 0`

**Si no aparecen:**
- Espera 2-3 minutos más
- Verifica que el deployment fue exitoso
- Verifica que `vercel.json` está en la raíz

### 2. Verificar Endpoints

Prueba los endpoints manualmente:

```bash
# Warmup (debería funcionar)
curl https://macro-dashboard-seven.vercel.app/api/warmup

# Health check
curl https://macro-dashboard-seven.vercel.app/api/health
```

### 3. Verificar Logs

1. Ve a **Deployments** → Último deployment
2. Click en **Runtime Logs**
3. Busca logs con `[warmup]` o `[weekly]` (aparecerán cuando los crons se ejecuten)

## ⚠️ Troubleshooting

### El deployment falla

**Revisa los Build Logs:**
1. Ve a **Deployments** → Último deployment
2. Click en **Build Logs**
3. Busca errores (aparecen en rojo)
4. Los errores más comunes:
   - Errores de sintaxis en `vercel.json` (JSON inválido)
   - Dependencias faltantes
   - Errores de TypeScript

### Los crons no aparecen después del deployment

**Posibles causas:**
1. El deployment aún no se ha completado (espera 2-3 minutos)
2. `vercel.json` tiene errores
3. El plan Hobby tiene limitaciones

**Soluciones:**
1. Verifica que el deployment fue exitoso (status "Ready")
2. Verifica que `vercel.json` es JSON válido
3. Espera unos minutos y verifica de nuevo

### Los crons aparecen pero no se ejecutan

**Revisa:**
1. **Runtime Logs** para ver errores
2. Que las variables de entorno estén configuradas
3. Que los endpoints respondan correctamente

## 📅 Próximas Ejecuciones Automáticas

Una vez que los crons estén activos:

- **`/api/warmup`:** Se ejecutará mañana a las 00:00 UTC (01:00 Madrid)
- **`/api/jobs/weekly`:** Se ejecutará el próximo domingo a las 17:00 UTC (18:00 Madrid)

## 🎯 Resumen

1. ✅ **Haz el deployment manual** desde Vercel Dashboard
2. ✅ **Espera a que termine** (2-3 minutos)
3. ✅ **Verifica los crons** en Settings → Cron Jobs
4. ✅ **Monitorea los logs** después de la primera ejecución automática

¡Todo listo para el deployment manual!

