# 🚀 Guía Paso a Paso: Verificar Variables y Redeploy en Vercel

## 📋 Variables de Entorno Requeridas

### Variables OBLIGATORIAS (deben estar todas):

1. **FRED_API_KEY**
   - Valor: `ccc90330e6a50afa217fb55ac48c4d28`
   - Entornos: ✅ Production, ✅ Preview, ✅ Development

2. **INGEST_KEY**
   - Valor: `cbc3d1139031a75f4721ddb45bf8cca4a79b115d4c15ba83e1a1713898cdbc82`
   - Entornos: ✅ Production, ✅ Preview, ✅ Development

3. **CRON_TOKEN**
   - Valor: (puede ser el mismo que INGEST_KEY o uno diferente)
   - Entornos: ✅ Production, ✅ Preview, ✅ Development

4. **APP_URL**
   - Valor: `https://tu-proyecto.vercel.app` (reemplazar con tu URL real)
   - Entornos: ✅ Production (obligatorio), Preview y Development (opcional)

### Variables OPCIONALES (solo si usas Telegram):

5. **TELEGRAM_BOT_TOKEN** (opcional)
6. **TELEGRAM_CHAT_ID** o **TELEGRAM_TEST_CHAT_ID** (opcional)

---

## ✅ PASO 1: Verificar Variables de Entorno

1. **Abre tu navegador** y ve a: https://vercel.com
2. **Inicia sesión** en tu cuenta
3. **Selecciona tu proyecto** (`macro-dashboard` o el nombre que tenga)
4. **Ve a Settings** (en el menú superior)
5. **Click en "Environment Variables"** (en el menú lateral izquierdo)

### Verificar cada variable:

Para cada variable obligatoria, verifica:

- ✅ **¿Existe la variable?** (debe aparecer en la lista)
- ✅ **¿Tiene el valor correcto?** (click en el ojo 👁️ para ver el valor)
- ✅ **¿Está marcada para Production?** (debe tener ✅ en la columna Production)

### Si falta alguna variable:

1. **Click en "Add New"**
2. **Name:** Escribe el nombre de la variable (ej: `FRED_API_KEY`)
3. **Value:** Pega el valor correspondiente
4. **Environments:** Marca ✅ Production, ✅ Preview, ✅ Development
5. **Click en "Save"**

### Si el valor está incorrecto:

1. **Click en los "..."** (tres puntos) a la derecha de la variable
2. **Click en "Edit"**
3. **Corrige el valor**
4. **Click en "Save"**

---

## ✅ PASO 2: Verificar APP_URL

**IMPORTANTE:** La variable `APP_URL` debe tener la URL real de tu proyecto.

1. **Ve a la pestaña "Deployments"** (en el menú superior)
2. **Mira la URL del último deployment** (algo como: `https://macro-dashboard-xxxxx.vercel.app`)
3. **Vuelve a Settings → Environment Variables**
4. **Verifica que `APP_URL` tiene esa URL exacta** (con `https://`)

Si no coincide:
- **Edita `APP_URL`** y pon la URL correcta
- **Guarda los cambios**

---

## ✅ PASO 3: Hacer el Redeploy

Después de verificar/actualizar las variables:

1. **Ve a la pestaña "Deployments"** (en el menú superior)
2. **Encuentra el último deployment** (el más reciente en la lista)
3. **Click en los "..."** (tres puntos) a la derecha del deployment
4. **Selecciona "Redeploy"**
5. **En el diálogo que aparece:**
   - ✅ **Marca "Clear build cache"** (recomendado para asegurar un build limpio)
   - **Environment:** Debe estar en "Production"
6. **Click en "Redeploy"**

---

## ⏳ PASO 4: Esperar el Build

1. **Verás el progreso en tiempo real**
2. **El build tomará aproximadamente 2-3 minutos**
3. **Estados posibles:**
   - 🟡 **Building...** → En proceso
   - 🟢 **Ready** → ¡Listo! Funciona
   - 🔴 **Error** → Hay un problema (ver logs)

---

## ✅ PASO 5: Verificar que Funciona

Una vez que el deployment esté en estado "Ready":

1. **Click en la URL del deployment** (o copia la URL)
2. **Abre la URL en el navegador**
3. **Verifica que carga correctamente:**
   - ✅ Página principal carga
   - ✅ Dashboard funciona (`/dashboard`)
   - ✅ No hay errores en la consola del navegador

---

## 🆘 Si hay Errores

### Error en Build Logs:

1. **Click en el deployment que falló**
2. **Click en "Build Logs"**
3. **Busca líneas en rojo** (errores)
4. **Los errores más comunes:**
   - Variables de entorno faltantes → Añádelas en Settings
   - Errores de TypeScript → Revisa el código
   - Dependencias faltantes → Verifica `package.json`

### La app carga pero no muestra datos:

1. **Verifica que `FRED_API_KEY` está configurada**
2. **Verifica que `APP_URL` tiene la URL correcta**
3. **Revisa "Runtime Logs"** en Vercel para ver errores en tiempo de ejecución

---

## 📝 Checklist Final

Antes de considerar que está listo:

- [ ] Todas las variables obligatorias están configuradas
- [ ] `APP_URL` tiene la URL correcta de tu proyecto
- [ ] El redeploy se completó exitosamente (estado "Ready")
- [ ] La URL pública funciona en el navegador
- [ ] El dashboard carga y muestra datos
- [ ] Funciona desde otro dispositivo/país

---

**¡Una vez completado, tu dashboard funcionará 24/7 desde cualquier lugar!** 🌍

