# 🔐 Valores de Turso para Vercel

## ✅ Valores que debes copiar en Vercel

### Variable 1: TURSO_DATABASE_URL
```
libsql://macro-dashboard-cmll1992.aws-eu-west-1.turso.io
```

### Variable 2: TURSO_AUTH_TOKEN
```
eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NjQyMzQxNTQsImlkIjoiMTUzZDEwOTAtNzE2ZS00NmZkLWEwYmEtOGFhZjUyNjVmZTI5IiwicmlkIjoiNjdjYmYzN2MtOTI2Zi00M2Y2LTk3OGEtYWEyMDVhMWI4N2U2In0.egH-WFdrxpUq-Wt1bTpdRVV7dfZ2DAIgrgdNFy6QQbzuWQ74wowHwsyaXXp1ja5Wt3hDNHiVu12pSm7M0VwbDw
```

---

## 🚀 Pasos en Vercel

1. Ve a: https://vercel.com/dashboard
2. Selecciona tu proyecto `macro-dashboard`
3. **Settings** → **Environment Variables**
4. Haz clic en **"Add New"**

### Agregar TURSO_DATABASE_URL:
- **Key**: `TURSO_DATABASE_URL`
- **Value**: `libsql://macro-dashboard-cmll1992.aws-eu-west-1.turso.io`
- **Environments**: ✅ Production, ✅ Preview
- **Save**

### Agregar TURSO_AUTH_TOKEN:
- **Key**: `TURSO_AUTH_TOKEN`
- **Value**: `eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NjQyMzQxNTQsImlkIjoiMTUzZDEwOTAtNzE2ZS00NmZkLWEwYmEtOGFhZjUyNjVmZTI5IiwicmlkIjoiNjdjYmYzN2MtOTI2Zi00M2Y2LTk3OGEtYWEyMDVhMWI4N2U2In0.egH-WFdrxpUq-Wt1bTpdRVV7dfZ2DAIgrgdNFy6QQbzuWQ74wowHwsyaXXp1ja5Wt3hDNHiVu12pSm7M0VwbDw`
- **Environments**: ✅ Production, ✅ Preview
- **Save**

5. Ve a **Deployments** → Haz clic en los **3 puntos** (⋯) del último deployment → **"Redeploy"**

---

## ✅ Después del Redeploy

Espera 2-3 minutos y verifica:

```bash
curl https://macro-dashboard-seven.vercel.app/api/health
```

Deberías ver `"hasData": true` y datos en `observationCount`.















