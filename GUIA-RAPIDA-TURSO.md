# 🚀 Guía Rápida: Configurar Turso para Persistencia de Datos

## ✅ ¿Qué es Turso?

**Turso** es SQLite distribuido que mantiene tus datos **persistentes entre deploys**. 

**Problema actual**: Los datos en Vercel se guardan en `/tmp/macro.db` que es **efímero** y se pierde en cada deploy.

**Solución**: Turso mantiene los datos en la nube, siempre disponibles.

---

## 📋 Pasos Rápidos (5 minutos)

### 1. Crear cuenta y base de datos

```bash
# Instalar CLI (si no lo tienes)
curl -sSfL https://get.tur.so/install.sh | bash

# O con Homebrew
brew install tursodatabase/tap/turso

# Iniciar sesión
turso auth login

# Crear base de datos
turso db create macro-dashboard

# Crear token de autenticación (GUARDA ESTE TOKEN)
turso db tokens create macro-dashboard

# Obtener URL de conexión
turso db show macro-dashboard --url
```

### 2. Configurar en Vercel

1. Ve a https://vercel.com/dashboard
2. Selecciona tu proyecto
3. **Settings** → **Environment Variables**
4. Agrega estas dos variables:

```
TURSO_DATABASE_URL=libsql://macro-dashboard-xxxxx.turso.io
TURSO_AUTH_TOKEN=tu_token_aqui
```

5. Marca ambas como disponibles en:
   - ✅ Production
   - ✅ Preview

6. **Save** y haz **Redeploy**

### 3. Verificar

Después del redeploy, verifica que funciona:

```bash
curl https://macro-dashboard-seven.vercel.app/api/health
```

Deberías ver `"hasData": true` y `"observationCount": 10000+`

---

## ✅ ¡Listo!

**Ahora tus datos:**
- ✅ Se mantienen entre deploys
- ✅ Se actualizan automáticamente cada día (cron job)
- ✅ Nunca desaparecen
- ✅ Solo se actualizan (no se borran)

---

## 🔍 Troubleshooting

### Error: "TURSO_DATABASE_URL not set"
→ Verifica que las variables estén configuradas en Vercel y haz redeploy

### Error: "Unauthorized"
→ Genera un nuevo token: `turso db tokens create macro-dashboard`

### Los datos siguen vacíos
→ Ejecuta manualmente el update:
```bash
bash scripts/force-update-now.sh
```

---

## 📚 Más Información

Ver `CONFIGURAR-TURSO.md` para documentación completa.













