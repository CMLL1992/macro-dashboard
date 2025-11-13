# ⚡ Verificación Rápida - Paso a Paso

## 🚨 IMPORTANTE: Ejecutar desde la carpeta del proyecto

**NUNCA ejecutes los comandos desde `~` (carpeta personal)**

**SIEMPRE ejecuta desde la carpeta del proyecto:**

```bash
cd /Users/carlosmontagutllarch/Desktop/macro-dashboard-with-data
```

Verifica que estás en la carpeta correcta:
```bash
pwd
# Debe mostrar: /Users/carlosmontagutllarch/Desktop/macro-dashboard-with-data

ls package.json
# Debe mostrar: package.json (no "No such file or directory")
```

## ✅ Paso 1: Verificar Estado de los Datos

```bash
cd /Users/carlosmontagutllarch/Desktop/macro-dashboard-with-data
APP_URL="https://macro-dashboard-seven.vercel.app" \
pnpm tsx scripts/check-data-status.ts
```

**Qué esperar:**
- Si muestra `observationCount: 0` → Los datos NO se están ingiriendo
- Si muestra números > 0 → Los datos están presentes

## ✅ Paso 2: Verificar Configuración

```bash
cd /Users/carlosmontagutllarch/Desktop/macro-dashboard-with-data
APP_URL="https://macro-dashboard-seven.vercel.app" \
CRON_TOKEN="cbc3d1139031a75f4721ddb45bf8cca4a79b115d4c15ba83e1a1713898cdbc82" \
INGEST_KEY="cbc3d1139031a75f4721ddb45bf8cca4a79b115d4c15ba83e1a1713898cdbc82" \
FRED_API_KEY="ccc90330e6a50afa217fb55ac48c4d28" \
pnpm tsx scripts/verify-config.ts
```

**Qué esperar:**
- ✅ Todas las variables muestran "OK"
- ✅ Los endpoints responden correctamente
- ❌ Si alguna muestra error → Corregir esa variable

## ✅ Paso 3: Verificar en el Navegador

Abre en tu navegador:
```
https://macro-dashboard-seven.vercel.app/api/health
```

**Qué esperar:**
- Debe mostrar un JSON con:
  - `observationCount`: número > 0
  - `biasCount`: número > 0
  - `correlationCount`: número > 0
  - `latestDate`: fecha reciente

## ✅ Paso 4: Revisar Logs de Workflows

1. Ve a: https://github.com/CMLL1992/macro-dashboard/actions
2. Click en el workflow más reciente
3. Click en el job (ej: "bootstrap")
4. **Expande TODOS los pasos**
5. Busca en los logs:
   - `{"success":true}` → ✅ Funcionó
   - `401 Unauthorized` → ❌ Token incorrecto
   - `404 Not Found` → ❌ URL incorrecta
   - `0 inserted` → ❌ No se insertaron datos

## 📋 Checklist Final

- [ ] Estoy en la carpeta correcta del proyecto
- [ ] `/api/health` muestra datos > 0
- [ ] Los workflows muestran `{"success":true}` en los logs
- [ ] No hay errores 401, 404, 500 en los logs
- [ ] Los contadores en los logs muestran números > 0

**Si todos están marcados:** ✅ Todo funciona correctamente

**Si falta alguno:** ❌ Revisa la guía de debugging completa

---

**Ver también:**
- `GUIA-DEBUGGING-COMPLETA.md` - Guía detallada
- `COMO-REVISAR-LOGS-WORKFLOWS.md` - Cómo interpretar los logs

