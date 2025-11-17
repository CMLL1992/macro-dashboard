# 🔧 Solución: Errores en GitHub Actions

## ✅ Estado Actual (2025-11-13)

**Problema resuelto:** Todos los workflows funcionan correctamente.

**Última ejecución exitosa:** News & Calendar Ingest #28 (Success - 1m 40s)

---

## ⚠️ Errores Detectados (RESUELTOS)

1. **News & Calendar Ingest #25** - Falló (8 segundos) ✅ RESUELTO
2. **Test Notifications #8** - Falló (9 segundos) ✅ RESUELTO

## 🔍 Causas Probables

### Error 1: News & Calendar Ingest

**Posibles causas:**
- ❌ Secrets faltantes en GitHub
- ❌ Scripts no encontrados
- ❌ Errores en los scripts de ingesta

**Secrets necesarios:**
- `APP_URL` - URL de Vercel
- `INGEST_KEY` - Key para autenticar
- `FRED_API_KEY` - API key de FRED

### Error 2: Test Notifications

**Posibles causas:**
- ❌ Script `test:notifs` no existe en `package.json`
- ❌ Secrets faltantes: `NOTIFICATIONS_TEST_BASE_URL`, `NOTIFICATIONS_TEST_INGEST_KEY`
- ❌ Tests fallando

## ✅ Soluciones

### Solución 1: Verificar Secrets en GitHub

1. **Ve a GitHub:**
   - https://github.com/CMLL1992/macro-dashboard
   - Settings → Secrets and variables → Actions

2. **Verifica que existan estos secrets:**
   - ✅ `APP_URL`
   - ✅ `INGEST_KEY`
   - ✅ `FRED_API_KEY`
   - ✅ `CRON_TOKEN`

3. **Si faltan, agrégalos:**
   - Click en "New repository secret"
   - Agrega cada uno con su valor correspondiente

### Solución 2: Desactivar Test Notifications (Si No Es Necesario)

Si el workflow de "Test Notifications" no es crítico, puedes desactivarlo:

1. **Ve a:** `.github/workflows/test-notifications.yml`
2. **Comenta el job** o elimina el archivo
3. **O agrega el script faltante** en `package.json`

### Solución 3: Verificar Scripts Existen

Los scripts deben existir:
- ✅ `scripts/ingest-news-rss.ts`
- ✅ `scripts/ingest-calendar-fred.ts`

Si no existen, los workflows fallarán.

## 🔍 Cómo Ver el Error Completo

1. **Ve a GitHub:**
   - https://github.com/CMLL1992/macro-dashboard
   - Click en "Actions"
   - Click en el workflow que falló (ej: "News & Calendar Ingest #25")
   - Click en el job que falló (ej: "Ingest News from RSS")
   - Revisa los logs para ver el error exacto

## 📋 Checklist de Verificación

- [ ] Secrets configurados en GitHub:
  - [ ] `APP_URL`
  - [ ] `INGEST_KEY`
  - [ ] `FRED_API_KEY`
  - [ ] `CRON_TOKEN`
- [ ] Scripts existen:
  - [ ] `scripts/ingest-news-rss.ts`
  - [ ] `scripts/ingest-calendar-fred.ts`
- [ ] Scripts tienen permisos de ejecución
- [ ] Dependencias instaladas correctamente

## 🚫 Si No Necesitas Estos Workflows

Si estos workflows no son críticos, puedes:

1. **Desactivarlos temporalmente:**
   - Renombra los archivos `.yml` a `.yml.disabled`
   - O comenta el contenido

2. **O configurar `continue-on-error: true`** para que no marquen el workflow como fallido

---

**Nota:** Los errores en GitHub Actions NO afectan el funcionamiento del dashboard en Vercel. Solo afectan los pipelines automáticos de ingesta de datos.

