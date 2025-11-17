# 🚀 Deploy Manual - Instrucciones para Ti

## ✅ Estado Actual

**Código en GitHub:** ✅ Actualizado  
**Último commit:** `4ef7bad` - "fix: eliminar referencia Macro Dashboard y simplificar config - CM11 Trading"

**Cambios incluidos:**
- ✅ NavBar: "CM11 Trading" (sin iconos)
- ✅ Página principal: redirect a `/dashboard`
- ✅ Metadata: "CM11 Trading"
- ✅ Páginas nuevas: Noticias, Notificaciones
- ✅ Admin con contraseña
- ✅ Narrativas y correlaciones expandidas

---

## 📋 Pasos para Deploy Manual en Vercel

### 1. Ir a Vercel Dashboard
1. Ve a: https://vercel.com/dashboard
2. Inicia sesión
3. Selecciona tu proyecto

### 2. Crear Nuevo Deployment
1. Ve a la pestaña **"Deployments"**
2. Click en **"..."** (menú) o busca **"Redeploy"** / **"Create Deployment"**
3. **Configuración:**
   - **Branch:** `main`
   - **Environment:** Production
   - ✅ **Marca "Clear build cache"** (MUY IMPORTANTE)
   - ❌ **Si hay "Use existing Build Cache", DESMÁRCALA**
4. Click en **"Deploy"** o **"Redeploy"**

### 3. Esperar el Build
- Estado: 🟡 **Building...** → Espera 2-3 minutos
- Estado: 🟢 **Ready** → ¡Listo!
- Estado: 🔴 **Error** → Revisa Build Logs

### 4. Obtener la URL
1. **Click en el deployment** (cuando esté "Ready")
2. **En la parte superior** verás:
   - Botón **"Visit"** → Click para abrir
   - O la URL escrita directamente
3. **Copia la URL**

### 5. Verificar
1. **Abre la URL en modo incógnito** (para evitar cache del navegador)
2. **Verifica:**
   - ✅ NavBar muestra "CM11 Trading" (sin iconos)
   - ✅ Redirige a `/dashboard` automáticamente
   - ✅ No aparece página de bienvenida antigua

---

## 🔍 Si Hay Errores en el Build

1. **Click en el deployment**
2. **Click en "Build Logs"**
3. **Busca líneas en rojo** (errores)
4. **Comparte los errores** si necesitas ayuda

---

## 📝 Notas Importantes

- ✅ **Siempre marca "Clear build cache"** al hacer redeploy
- ✅ **Usa modo incógnito** para verificar (evita cache del navegador)
- ✅ **Espera a que el deployment esté "Ready"** antes de verificar
- ✅ El código está actualizado en GitHub, solo necesitas hacer el deploy

---

**Última actualización:** 2025-11-13  
**Código listo en GitHub:** ✅ Sí

