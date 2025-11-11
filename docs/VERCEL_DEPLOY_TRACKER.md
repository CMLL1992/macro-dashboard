# 📊 Vercel Deploy Tracker

**Fecha:** 2025-11-11  
**Commit:** `1787364` - "fix: configure Vercel deployment (pnpm, Node 20, dynamic dashboard)"

---

## ✅ Pre-Deploy Checklist

- [x] `package.json` con `packageManager: "pnpm@10.20.0"`
- [x] `package.json` con `engines.node: ">=18.17.0"`
- [x] `.nvmrc` creado con `20`
- [x] `vercel.json` optimizado
- [x] Rutas dinámicas marcadas
- [x] Push a `main` completado

---

## 🚀 Deploy Status

### Paso 1: Redeploy con Cache Limpia

**Acción realizada:** [ ] Sí / [ ] No  
**Timestamp:** _______________

---

## 📋 Verificación en Build Logs

### Detecciones Esperadas

**pnpm:**
- [ ] ✓ Detected pnpm (packageManager field)
- [ ] Versión detectada: `10.20.0` (o similar)

**Node.js:**
- [ ] ✓ Node.js version: `20.x` (from .nvmrc)
- [ ] O: `18.17.0+` (from engines)

**Next.js:**
- [ ] ✓ Detected Next.js version: `14.2.5`
- [ ] ❌ NO debe aparecer: "No Next.js version detected"

**Comandos ejecutados:**
- [ ] ✓ Running "pnpm install --frozen-lockfile"
- [ ] ✓ Running "pnpm run build"

---

## 🔍 Errores Encontrados (si aplica)

### Error 1: [Tipo de error]
```
[Pegar primer bloque de logs aquí]
```

**Ruta afectada:** _______________  
**Solución aplicada:** _______________  
**Redeploy:** [ ] Sí / [ ] No

---

## ✅ Rutas Marcadas como Dinámicas

- [x] `/dashboard` - `app/dashboard/page.tsx`
- [x] `/narrativas` - `app/narrativas/page.tsx`
- [x] `/narrativas/[symbol]` - `app/narrativas/[symbol]/page.tsx`

**Rutas adicionales añadidas durante deploy:**
- _______________

---

## 🔐 Variables de Entorno Verificadas

**En Vercel → Settings → Environment Variables:**

- [ ] `CRON_TOKEN` - Entornos: [ ] Production [ ] Preview [ ] Development
- [ ] `APP_URL` - Entornos: [ ] Production [ ] Preview [ ] Development
- [ ] `FRED_API_KEY` - Entornos: [ ] Production [ ] Preview [ ] Development
- [ ] `TELEGRAM_BOT_TOKEN` - Entornos: [ ] Production [ ] Preview [ ] Development
- [ ] `TELEGRAM_CHAT_ID` - Entornos: [ ] Production [ ] Preview [ ] Development

**Variables faltantes detectadas:**
- _______________

---

## 🧪 Smoke Tests Post-Deploy

**URL Base:** `https://_______________.vercel.app`

### Tests Básicos

- [ ] `/` - Página principal carga OK
- [ ] `/dashboard` - Dashboard responde (dinámica, usa no-store)
- [ ] `/narrativas` - Narrativas carga OK
- [ ] `/api/health` - Route handler responde 200
- [ ] `/api/bias` - API bias responde 200

### Tests Visuales

- [ ] Imágenes cargan sin errores de dominio
- [ ] Estilos CSS cargan correctamente
- [ ] No hay errores en consola del navegador

### Tests de Configuración

- [ ] Vercel → Settings → Cron Jobs muestra `/api/warmup` con schedule `0 */3 * * *`

---

## 📊 Estado Final del Deploy

**Estado:** [ ] ✅ Ready / [ ] ❌ Error

**Si Error:**
- **Causa:** _______________
- **Primer bloque de logs:**
```
[Pegar aquí]
```

**Si Ready:**
- **URL de producción:** _______________
- **Tiempo de build:** _______________
- **Tamaño del bundle:** _______________

---

## 📝 Confirmaciones Finales

### Versiones Detectadas

- **Node.js:** `_______________`
- **pnpm:** `_______________`
- **Next.js:** `_______________`

### Resumen de Cambios Aplicados

1. _______________
2. _______________
3. _______________

---

## 🎯 Próximos Pasos (si aplica)

- [ ] _______________
- [ ] _______________

---

**Última actualización:** _______________

