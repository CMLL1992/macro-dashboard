# 🔐 Valores de Secrets para GitHub Actions

## 📋 Secrets OBLIGATORIOS

### 1. APP_URL
**Valor:**
```
https://macro-dashboard-seven.vercel.app
```

**Descripción:** URL pública de tu aplicación en Vercel.

**Cómo obtenerlo:**
- Ve a Vercel Dashboard → Tu proyecto
- En la página principal verás la URL
- O en Settings → Domains

---

### 2. INGEST_KEY
**Valor:**
```
cbc3d1139031a75f4721ddb45bf8cca4a79b115d4c15ba83e1a1713898cdbc82
```

**Descripción:** Clave secreta para autenticar endpoints de ingesta (noticias, calendario).

**Nota:** Este es el mismo valor que usas en Vercel.

---

### 3. FRED_API_KEY
**Valor:**
```
ccc90330e6a50afa217fb55ac48c4d28
```

**Descripción:** API key de FRED (Federal Reserve Economic Data) para obtener datos macroeconómicos.

**Nota:** Este es el mismo valor que usas en Vercel.

---

### 4. CRON_TOKEN
**Valor:**
```
cbc3d1139031a75f4721ddb45bf8cca4a79b115d4c15ba83e1a1713898cdbc82
```

**Descripción:** Token para autenticar endpoints de jobs (`/api/jobs/*`).

**Nota:** Puedes usar el mismo valor que `INGEST_KEY` o generar uno diferente. Si ya tienes uno en Vercel, usa ese mismo.

---

## 📋 Secrets OPCIONALES (Solo para Test Notifications)

### 5. NOTIFICATIONS_TEST_BASE_URL
**Valor:**
```
https://macro-dashboard-seven.vercel.app
```

**Descripción:** URL base para tests de notificaciones (opcional, por defecto usa localhost).

**Nota:** Solo necesario si ejecutas el workflow "Test Notifications".

---

### 6. NOTIFICATIONS_TEST_INGEST_KEY
**Valor:**
```
cbc3d1139031a75f4721ddb45bf8cca4a79b115d4c15ba83e1a1713898cdbc82
```

**Descripción:** Key para autenticar tests de notificaciones (opcional).

**Nota:** Puedes usar el mismo valor que `INGEST_KEY`. Solo necesario si ejecutas el workflow "Test Notifications".

---

## 📝 Cómo Añadir en GitHub

1. **Ve a GitHub:**
   - https://github.com/CMLL1992/macro-dashboard
   - Settings → Secrets and variables → Actions

2. **Para cada secret:**
   - Click en "New repository secret"
   - **Name:** Escribe el nombre (ej: `APP_URL`)
   - **Secret:** Pega el valor correspondiente
   - Click en "Add secret"

3. **Repite para cada secret obligatorio:**
   - `APP_URL`
   - `INGEST_KEY`
   - `FRED_API_KEY`
   - `CRON_TOKEN`

4. **Opcionales (solo si usas Test Notifications):**
   - `NOTIFICATIONS_TEST_BASE_URL`
   - `NOTIFICATIONS_TEST_INGEST_KEY`

---

## ✅ Checklist de Secrets

Verifica que tengas estos secrets en GitHub:

- [ ] `APP_URL` = `https://macro-dashboard-seven.vercel.app`
- [ ] `INGEST_KEY` = `cbc3d1139031a75f4721ddb45bf8cca4a79b115d4c15ba83e1a1713898cdbc82`
- [ ] `FRED_API_KEY` = `ccc90330e6a50afa217fb55ac48c4d28`
- [ ] `CRON_TOKEN` = `cbc3d1139031a75f4721ddb45bf8cca4a79b115d4c15ba83e1a1713898cdbc82` (o el que tengas en Vercel)

---

## 🔍 Cómo Verificar que Están Configurados

1. **Ve a GitHub:**
   - https://github.com/CMLL1992/macro-dashboard
   - Settings → Secrets and variables → Actions

2. **Verifica la lista:**
   - Deberías ver todos los secrets listados
   - NO puedes ver los valores (están ocultos por seguridad)
   - Solo puedes ver cuándo fueron actualizados

3. **Si falta alguno:**
   - Click en "New repository secret"
   - Añádelo con el valor correspondiente

---

## ⚠️ Importante

- ✅ **NO compartas estos valores públicamente**
- ✅ **NO los subas a Git** (ya están en `.gitignore`)
- ✅ **Usa los mismos valores que en Vercel** (excepto APP_URL que debe ser la URL de Vercel)
- ✅ **Si cambias un valor en Vercel, cámbialo también en GitHub**

---

**Última actualización:** 2025-11-13



