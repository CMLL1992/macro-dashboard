# 🔧 Configurar Turso en Vercel

## 📋 Valores que necesitas

**TURSO_DATABASE_URL:**
```
libsql://macro-dashboard-cmll1992.aws-eu-west-1.turso.io
```

**TURSO_AUTH_TOKEN:**
```
eyJhbGciOiJFZERTQSIsInR5cCl6lkpXVCJ9.eyJhljoicnciLCJ
```

⚠️ **IMPORTANTE**: El token que viste en el pop-up está truncado. Necesitas copiar el token COMPLETO desde el dashboard.

---

## 🚀 Pasos para Configurar en Vercel

### 1. Ir a Vercel Dashboard

1. Ve a https://vercel.com/dashboard
2. Selecciona tu proyecto `macro-dashboard` (o el nombre que tenga)

### 2. Agregar Variables de Entorno

1. Ve a **Settings** → **Environment Variables**
2. Haz clic en **"Add New"** o **"Add"**

#### Variable 1: TURSO_DATABASE_URL

- **Key**: `TURSO_DATABASE_URL`
- **Value**: `libsql://macro-dashboard-cmll1992.aws-eu-west-1.turso.io`
- **Environments**: Marca todas:
  - ✅ Production
  - ✅ Preview
  - ✅ Development (opcional)

Haz clic en **"Save"**

#### Variable 2: TURSO_AUTH_TOKEN

- **Key**: `TURSO_AUTH_TOKEN`
- **Value**: `[PEGA EL TOKEN COMPLETO AQUÍ]`
- **Environments**: Marca todas:
  - ✅ Production
  - ✅ Preview
  - ✅ Development (opcional)

Haz clic en **"Save"**

### 3. Redeploy

1. Ve a **Deployments**
2. Haz clic en los **3 puntos** (⋯) del último deployment
3. Selecciona **"Redeploy"**
4. Confirma el redeploy

### 4. Verificar

Después del redeploy (2-3 minutos), verifica:

```bash
curl https://macro-dashboard-seven.vercel.app/api/health
```

Deberías ver:
```json
{
  "hasData": true,
  "observationCount": 10000+,
  ...
}
```

---

## ⚠️ Nota sobre el Token

El token que viste en el pop-up puede estar truncado. Para obtener el token completo:

1. Ve al dashboard de Turso
2. Ve a tu base de datos `macro-dashboard-cmll1992`
3. Haz clic en **"Create Token"** de nuevo (o ve a la sección de tokens)
4. Copia el token COMPLETO (debe ser mucho más largo)

O desde la terminal (si estás autenticado):
```bash
turso db tokens create macro-dashboard-cmll1992
```

---

## ✅ Checklist

- [ ] Variable `TURSO_DATABASE_URL` agregada en Vercel
- [ ] Variable `TURSO_AUTH_TOKEN` agregada en Vercel (token completo)
- [ ] Ambas variables marcadas para Production y Preview
- [ ] Redeploy realizado
- [ ] Verificado que `/api/health` muestra datos

---

**¿Necesitas ayuda?** Si tienes problemas, verifica que el token esté completo y que las variables estén correctamente escritas (sin espacios extra).

