# 🔄 Actualizar Todos los Datos Ahora

## ✅ Opción 1: Ejecutar Workflow de GitHub Actions (Recomendado)

Esta es la mejor opción porque se ejecuta en el entorno correcto con todas las variables configuradas.

### Pasos:

1. **Ve a GitHub Actions:**
   - https://github.com/CMLL1992/macro-dashboard/actions/workflows/news-calendar-ingest.yml

2. **Ejecuta el workflow:**
   - Click en "Run workflow" (botón azul arriba a la derecha)
   - Selecciona branch: `main`
   - Click en "Run workflow"

3. **Espera 2-3 minutos** mientras se ejecuta

4. **Verifica los resultados:**
   - Click en el workflow que acabas de ejecutar
   - Revisa los logs para ver qué fuentes funcionaron

### Qué actualiza:

- ✅ **Datos FRED** (14 series macroeconómicas)
- ✅ **Correlaciones** (todos los pares)
- ✅ **Bias macro** (todos los símbolos)
- ✅ **Noticias** desde:
  - RSS (Bloomberg, Reuters, Financial Times)
  - Financial Modeling Prep (si tienes API key)
  - Finnhub (si tienes API key)
  - NewsAPI (si tienes API key)
- ✅ **Calendario** desde:
  - FRED
  - Forex Factory
  - Financial Modeling Prep (si tienes API key)
  - Finnhub (si tienes API key)
  - Trading Economics

---

## ✅ Opción 2: Ejecutar Workflow de Daily Jobs (Datos FRED, Correlaciones, Bias)

Para actualizar solo los datos macro, correlaciones y bias:

1. **Ve a:**
   - https://github.com/CMLL1992/macro-dashboard/actions/workflows/daily-jobs.yml

2. **Ejecuta el workflow:**
   - Click en "Run workflow"
   - Selecciona branch: `main`
   - Click en "Run workflow"

---

## ⚠️ Nota sobre el Fix de FRED

El fix para obtener datos más recientes de FRED (removiendo `observation_end`) ya está en GitHub pero puede que aún no esté desplegado en Vercel.

**Solución:** Espera 2-3 minutos después de hacer push, luego ejecuta el workflow. O haz un redeploy manual en Vercel.

---

## 🔍 Verificar Actualización

Después de ejecutar los workflows:

1. **Dashboard:**
   - https://macro-dashboard-seven.vercel.app/dashboard
   - El timestamp "Actualizado" debería mostrar la fecha/hora actual

2. **Noticias:**
   - https://macro-dashboard-seven.vercel.app/noticias
   - Debe mostrar noticias recientes

3. **Admin:**
   - https://macro-dashboard-seven.vercel.app/admin
   - Verifica el estado del sistema

---

## 🚀 Automatización Futura

Una vez actualizado manualmente, el sistema se actualizará automáticamente:

- **Cada 6 horas:** Noticias y calendario (GitHub Actions)
- **Cada día a las 06:00 UTC:** Datos FRED, correlaciones, bias (GitHub Actions)
- **Cada día a las 00:00 UTC:** Warmup y datos FRED (Vercel Cron)

---

**Última actualización:** 13/11/2025



