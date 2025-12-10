# 👨‍💻 Instrucciones para el Programador - Reemplazar Dashboard Viejo

## 🎯 Objetivo

Reemplazar el dashboard viejo (fondo blanco) que está en producción por el nuevo dashboard (fondo oscuro), manteniendo:
- ✅ Mismo proyecto Vercel
- ✅ Misma base de datos Turso
- ✅ Mismos cron jobs (actualizados)
- ✅ Mismo dominio

---

## 📋 Checklist de Tareas

### 1️⃣ Conectar el Nuevo Código al Repositorio GitHub

**Opción A: Usar el mismo repositorio (Recomendado)**
```bash
# 1. Asegúrate de estar en el directorio del nuevo proyecto
cd "/Users/carlosmontagutllarch/Desktop/macro-dashboard-with-data 2"

# 2. Verifica el estado de git
git status

# 3. Añade todos los cambios
git add .

# 4. Commit con mensaje descriptivo
git commit -m "feat: nuevo dashboard con fondo oscuro y mejoras completas"

# 5. Push a main (o la rama que uses en producción)
git push origin main
```

**Opción B: Crear nuevo repositorio y cambiar en Vercel**
1. Crear nuevo repo en GitHub
2. Push del nuevo código
3. En Vercel → Settings → Git → Change Repository
4. Seleccionar el nuevo repo

**⚠️ IMPORTANTE:** Si usas Opción B, asegúrate de que el nuevo repo tenga el mismo nombre o actualiza la configuración.

---

### 2️⃣ Verificar Build en Vercel

1. **Esperar el deployment automático**
   - Vercel detectará el push y empezará a construir
   - Ve a Vercel → Deployments → Último deployment

2. **Revisar Build Logs**
   - Haz clic en el último deployment
   - Revisa "Build Logs"
   - **Verifica que no hay errores críticos**
   - Advertencias menores están OK

3. **Verificar que detecta Turso**
   - En los logs, busca: `[db] Using Turso database`
   - O verifica en producción: `https://tu-dominio.com/api/diag`
   - Debe mostrar: `"database": { "type": "Turso" }`

4. **Verificar migraciones automáticas**
   - Revisa logs para errores de migración
   - Si hay errores, revisa `lib/db/unified-db.ts`
   - Las migraciones deberían ejecutarse automáticamente

---

### 3️⃣ Verificar Variables de Entorno en Vercel

**Ya están configuradas, solo verificar:**

1. Ve a Vercel → Settings → Environment Variables
2. Verifica que estas variables existen y están marcadas para **Production**:
   - ✅ `TURSO_DATABASE_URL`
   - ✅ `TURSO_AUTH_TOKEN`
   - ✅ `FRED_API_KEY`
   - ✅ `CRON_TOKEN`
   - ✅ `APP_URL`
   - ✅ `TELEGRAM_BOT_TOKEN` (opcional)
   - ✅ `TELEGRAM_CHAT_ID` (opcional)
   - ✅ `ENABLE_TELEGRAM_NOTIFICATIONS` (opcional)

3. **Si falta alguna:** Añádela con el mismo valor que tenía antes

---

### 4️⃣ Actualizar Cron Jobs en Vercel

**Problema detectado:** Solo aparecen 2 cron jobs antiguos en Vercel, pero `vercel.json` tiene 9 jobs nuevos.

**Solución:**

1. **Verifica que `vercel.json` está commiteado**
   ```bash
   git log --oneline vercel.json
   ```

2. **Verifica el contenido de `vercel.json`**
   - Debe tener los 9 cron jobs nuevos
   - No debe tener `/api/jobs/daily-update` (es el viejo)

3. **Después del deployment, verifica en Vercel:**
   - Ve a Vercel → Settings → Cron Jobs
   - Deberías ver los nuevos jobs automáticamente
   - Si no aparecen después de 5-10 minutos:
     - Haz un nuevo deployment (Redeploy)
     - O espera hasta que Vercel los detecte

4. **Cron jobs esperados:**
   - `/api/jobs/ingest/fred` → 06:00 UTC
   - `/api/jobs/ingest/european` → 07:00 UTC
   - `/api/jobs/ingest/calendar` → 08:00 UTC
   - `/api/jobs/correlations` → 09:00 UTC
   - `/api/jobs/compute/bias` → 10:00 UTC
   - `/api/jobs/notify/calendar` → Cada 5 minutos
   - `/api/jobs/daily/calendar` → 08:00 UTC
   - `/api/jobs/weekly` → 18:00 UTC domingos
   - `/api/jobs/ingest/releases` → Cada 5 minutos (8-20 UTC)

5. **Si los jobs antiguos siguen apareciendo:**
   - Puedes eliminarlos manualmente en Vercel → Settings → Cron Jobs
   - O dejarlos, no harán daño (los endpoints nuevos están protegidos)

---

### 5️⃣ Probar el Nuevo Dashboard en Producción

**Espera a que el deployment termine (estado "Ready")**

1. **Verificar dashboard principal:**
   - Abre: `https://tu-dominio.com/dashboard`
   - ✅ Debe verse el fondo oscuro
   - ✅ Debe mostrar datos macro recientes
   - ✅ No debe mostrar datos de "diciembre 2025" (datos antiguos)

2. **Verificar páginas principales:**
   - `/correlaciones` → Tabla de correlaciones funcionando
   - `/sesgos` → Tabla de sesgos funcionando
   - `/calendario` → Calendario de eventos funcionando

3. **Verificar endpoints de diagnóstico:**
   ```bash
   curl https://tu-dominio.com/api/health
   curl https://tu-dominio.com/api/diag
   ```
   - `/api/health` debe responder con `"ready": true`
   - `/api/diag` debe mostrar `"database": { "type": "Turso" }`

4. **Verificar fechas de datos:**
   - Los datos deben ser recientes (últimos días/semanas)
   - No deben ser de "diciembre 2025" o fechas futuras

---

### 6️⃣ Verificar Dominio (No Tocar)

**El dominio ya está configurado, solo verificar:**

1. Ve a Vercel → Settings → Domains
2. Verifica que tu dominio personalizado aparece listado
3. Verifica que el estado es "Valid" (verde)
4. **No cambies nada** del dominio
5. Solo verifica que apunta al mismo proyecto Vercel

**Si el dominio cambió:**
- Actualiza `APP_URL` en Vercel → Settings → Environment Variables
- Haz Redeploy

---

## ✅ Checklist de Validación Final

Marca cada punto cuando esté completado:

- [ ] **Dashboard oscuro visible en producción**
  - Abre `https://tu-dominio.com/dashboard`
  - Se ve el fondo oscuro (no blanco)
  - La interfaz es la nueva

- [ ] **Datos macro recientes**
  - Las fechas son actuales (no "diciembre 2025")
  - Los datos se ven actualizados

- [ ] **Base de datos Turso funcionando**
  - `/api/diag` muestra `"database": { "type": "Turso" }`
  - No hay errores de conexión en logs

- [ ] **Cron jobs ejecutándose**
  - Vercel → Settings → Cron Jobs muestra los nuevos jobs
  - Los jobs se ejecutan sin errores (revisa logs)

- [ ] **Endpoints funcionando**
  - `/api/health` → `"ready": true`
  - `/api/diag` → Respuesta correcta
  - `/dashboard`, `/correlaciones`, `/sesgos`, `/calendario` → Cargando correctamente

- [ ] **Sin errores en logs**
  - Vercel → Deployments → Último → Logs
  - No hay errores críticos
  - Las migraciones se ejecutaron correctamente

- [ ] **Dominio funcionando**
  - El dominio personalizado carga el nuevo dashboard
  - HTTPS funciona correctamente

---

## 🐛 Solución de Problemas

### Problema: Build falla en Vercel

**Causas comunes:**
- Dependencias faltantes
- Errores de TypeScript
- Variables de entorno faltantes

**Solución:**
1. Revisa Build Logs en Vercel
2. Busca el error específico
3. Corrige el código localmente
4. Haz push y espera nuevo deployment

### Problema: Dashboard sigue siendo el viejo

**Causas:**
- Cache del navegador
- Deployment no completado
- Dominio apuntando a deployment antiguo

**Solución:**
1. Espera a que el deployment termine (estado "Ready")
2. Limpia cache del navegador (Ctrl+Shift+R o Cmd+Shift+R)
3. Verifica que el último deployment es el nuevo
4. Si sigue igual, haz Redeploy manual

### Problema: Cron jobs no aparecen en Vercel

**Causas:**
- `vercel.json` no está commiteado
- Vercel no ha detectado los cambios aún

**Solución:**
1. Verifica que `vercel.json` está en la raíz y commiteado
2. Espera 5-10 minutos después del deployment
3. Haz Redeploy si no aparecen
4. Si sigue sin aparecer, puedes añadirlos manualmente en Vercel

### Problema: Base de datos muestra "SQLite"

**Causa:** Variables de entorno `TURSO_DATABASE_URL` o `TURSO_AUTH_TOKEN` no configuradas

**Solución:**
1. Ve a Vercel → Settings → Environment Variables
2. Verifica que `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN` existen
3. Verifica que están marcadas para **Production**
4. Haz Redeploy después de verificar

### Problema: Datos antiguos en el dashboard

**Causa:** Los cron jobs no se han ejecutado aún o fallaron

**Solución:**
1. Revisa logs de los cron jobs en Vercel
2. Ejecuta manualmente: `curl -X POST https://tu-dominio.com/api/jobs/ingest/fred?token=TU_CRON_TOKEN`
3. Espera a que los cron jobs se ejecuten automáticamente (mañana a las 06:00 UTC)

---

## 🔄 Plan de Rollback (Si Algo Falla)

Si el nuevo dashboard tiene problemas críticos:

1. **Opción A: Revertir el último commit**
   ```bash
   git revert HEAD
   git push origin main
   ```

2. **Opción B: Volver a un deployment anterior**
   - Ve a Vercel → Deployments
   - Encuentra el deployment del dashboard viejo
   - Haz clic en "..." → "Promote to Production"

3. **Opción C: Cambiar repositorio en Vercel**
   - Ve a Vercel → Settings → Git
   - Cambia temporalmente al repo viejo
   - O crea una rama de rollback

---

## 📞 Contacto

Si encuentras problemas no cubiertos aquí:
1. Revisa los logs de Vercel
2. Revisa la documentación en `docs/`
3. Verifica que todas las variables de entorno están configuradas

---

## ✅ Resultado Esperado

Cuando el usuario escriba su dominio en el navegador:
- ✅ Verá el nuevo dashboard oscuro
- ✅ Los datos serán recientes y correctos
- ✅ Los cron jobs se ejecutarán automáticamente
- ✅ Todo funcionará sin necesidad de ordenador local encendido

---

**¡Buena suerte con el deployment! 🚀**
