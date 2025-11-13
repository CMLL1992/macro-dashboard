# 🚀 Deploy a Producción (Funciona con Mac Cerrado)

## ¿Por qué necesitas esto?

- ❌ **Túnel local (Cloudflare/ngrok)**: Solo funciona mientras el Mac esté encendido
- ✅ **Deploy a Vercel**: Funciona 24/7, incluso con el Mac cerrado

---

## 📋 Pasos para Deploy en Vercel

### Paso 1: Verificar que el código está en GitHub

```bash
# Verifica que tienes todos los cambios guardados
git status

# Si hay cambios sin commitear:
git add .
git commit -m "Preparar para deploy"
git push origin main
```

### Paso 2: Conectar proyecto a Vercel

1. **Ve a:** https://vercel.com
2. **Inicia sesión** (o crea cuenta gratis)
3. **Click en "Add New Project"**
4. **Importa tu repositorio de GitHub:**
   - Selecciona `macro-dashboard-with-data`
   - Click en "Import"

### Paso 3: Configuración del Proyecto

Vercel detectará automáticamente:
- ✅ Framework: Next.js
- ✅ Package Manager: pnpm
- ✅ Node.js: 20.x

**Solo verifica:**
- **Root Directory:** (dejar vacío)
- **Build Command:** (dejar vacío - usa el de package.json)
- **Output Directory:** (dejar vacío)

### Paso 4: Variables de Entorno

**IMPORTANTE:** Añade estas variables en Vercel antes del primer deploy:

1. Ve a **Settings** → **Environment Variables**
2. Añade cada una:

#### Variables OBLIGATORIAS:

| Variable | Valor | Entornos |
|----------|-------|----------|
| `FRED_API_KEY` | `ccc90330e6a50afa217fb55ac48c4d28` | ✅ Production, ✅ Preview, ✅ Development |
| `INGEST_KEY` | `cbc3d1139031a75f4721ddb45bf8cca4a79b115d4c15ba83e1a1713898cdbc82` | ✅ Production, ✅ Preview, ✅ Development |
| `CRON_TOKEN` | (genera uno nuevo o usa el mismo que INGEST_KEY) | ✅ Production, ✅ Preview, ✅ Development |
| `APP_URL` | `https://tu-proyecto.vercel.app` | ✅ Production (ajustar después del deploy) |

#### Variables OPCIONALES (solo si usas Telegram):

| Variable | Valor | Entornos |
|----------|-------|----------|
| `TELEGRAM_BOT_TOKEN` | (tu token) | ✅ Production |
| `TELEGRAM_CHAT_ID` | (tu chat ID) | ✅ Production |

### Paso 5: Hacer el Deploy

1. **Click en "Deploy"**
2. **Espera 2-3 minutos** mientras construye
3. **Verás la URL de producción:** `https://tu-proyecto.vercel.app`

### Paso 6: Actualizar APP_URL

Después del deploy:

1. Ve a **Settings** → **Environment Variables**
2. Edita `APP_URL` con la URL real de tu proyecto
3. **Redeploy** para aplicar el cambio

---

## ✅ Verificación Post-Deploy

### 1. Probar la URL

Abre en el navegador:
```
https://tu-proyecto.vercel.app
https://tu-proyecto.vercel.app/dashboard
```

### 2. Verificar que funciona desde cualquier lugar

- ✅ Abre la URL desde otro dispositivo
- ✅ Abre la URL desde otro país
- ✅ Funciona con el Mac cerrado

---

## 🔄 Actualizaciones Futuras

Cada vez que hagas `git push` a `main`, Vercel desplegará automáticamente.

**O manualmente:**
1. Ve a Vercel Dashboard
2. **Deployments** → **"..."** → **Redeploy**

---

## 💰 Costos

**Plan Hobby (Gratis):**
- ✅ 100 GB de ancho de banda/mes
- ✅ Deployments ilimitados
- ✅ SSL automático
- ✅ Dominio personalizado
- ✅ Funciona 24/7

**Suficiente para la mayoría de proyectos personales.**

---

## 🆚 Comparación: Túnel vs Producción

| Característica | Túnel Local | Vercel (Producción) |
|---------------|-------------|---------------------|
| Funciona con Mac cerrado | ❌ No | ✅ Sí |
| URL permanente | ❌ Cambia cada vez | ✅ Siempre la misma |
| Velocidad | Depende de tu internet | ✅ Muy rápida (CDN global) |
| Costo | Gratis | Gratis (plan hobby) |
| Configuración | 2 minutos | 10-15 minutos |
| Mejor para | Desarrollo/Testing | Producción/Uso real |

---

## 🆘 Troubleshooting

### El deploy falla

1. **Revisa Build Logs** en Vercel
2. **Verifica variables de entorno** están todas añadidas
3. **Verifica que el código está en GitHub**

### La app no carga datos

1. **Verifica `APP_URL`** está configurada correctamente
2. **Verifica `FRED_API_KEY`** está añadida
3. **Revisa Runtime Logs** en Vercel para ver errores

### Los crons no funcionan

1. Ve a **Settings** → **Cron Jobs**
2. Verifica que aparecen los crons configurados
3. Espera a que se ejecuten (pueden tardar hasta la próxima hora)

---

## 📚 Documentación Adicional

- `docs/VERCEL_DEPLOY_CHECKLIST.md` - Checklist detallado
- `docs/VERCEL_ENV_VARS.md` - Variables de entorno completas
- `docs/MANUAL_DEPLOYMENT.md` - Deploy manual paso a paso

---

**¡Una vez desplegado, tu dashboard funcionará 24/7 desde cualquier lugar del mundo!** 🌍

