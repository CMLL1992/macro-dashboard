# ✅ Verificación de Deploy en Vercel

**Fecha:** 2025-01-XX  
**Problema:** En producción se muestra la versión antigua del dashboard (cabecera blanca)  
**Solución:** Verificar y forzar redeploy del código nuevo

---

## ✅ Paso 1: Verificar que el código nuevo está en GitHub

**Repo:** https://github.com/CMLL1992/macro-dashboard

### Verificar NavBar nuevo:

1. Abre: https://github.com/CMLL1992/macro-dashboard/blob/main/components/NavBar.tsx
2. Verifica que tiene estos menús en `baseNavItems`:
   ```typescript
   const baseNavItems = [
     { href: '/dashboard', label: 'Dashboard' },
     { href: '/calendario', label: 'Calendario' },
     { href: '/correlations', label: 'Correlaciones' },
     { href: '/narrativas', label: 'Narrativas' },
     { href: '/sesgos', label: 'Sesgos' },
     { href: '/analisis', label: 'Análisis diario' },
     { href: '/notificaciones', label: 'Notificaciones' },
     { href: '/ayuda', label: 'Ayuda' },
   ]
   ```

3. Verifica que el título es "CM11 Trading" (no "🦅 Macro Dashboard")

### Verificar dashboard page:

1. Abre: https://github.com/CMLL1992/macro-dashboard/blob/main/app/dashboard/page.tsx
2. Verifica que NO tiene el mensaje "Inicializando datos…"
3. Verifica que usa componentes modernos como `TacticalTablesClient`

---

## ✅ Paso 2: Verificar configuración de Vercel

### 2.1. Verificar repo conectado

1. Ve a: https://vercel.com/dashboard
2. Selecciona proyecto: **macro-dashboard** (o el nombre correcto)
3. Ve a: **Settings** → **Git**
4. Verifica:
   - **Connected Git Repository** = `CMLL1992/macro-dashboard`
   - **Production Branch** = `main`

Si no es `main`, cámbialo:
- Clic en "Edit"
- Cambia "Production Branch" a `main`
- Guarda

### 2.2. Verificar último deployment

1. Ve a: **Deployments**
2. Busca el deployment más reciente cuyo:
   - **Source** = `main`
   - **Commit Message** = Contiene "nuevo dashboard" o "feat: actualizar dashboard"
3. Verifica la **mini-captura de pantalla**:
   - ✅ Debe mostrar cabecera oscura (no blanca)
   - ✅ Debe mostrar menú completo

Si la captura muestra cabecera blanca, ese deployment es la versión antigua.

---

## ✅ Paso 3: Forzar redeploy del código nuevo

### Opción A: Redeploy del último commit

1. Ve a: **Deployments**
2. Busca el deployment cuyo commit es el más reciente de `main`
3. Clic en **"..."** (tres puntos) → **"Redeploy"**
4. Espera a que termine el deploy (2-5 minutos)

### Opción B: Crear commit vacío para forzar deploy

Si el último deployment sigue siendo la versión antigua:

```bash
# En tu proyecto local
git commit --allow-empty -m "chore: forzar redeploy con nuevo dashboard"
git push origin main
```

Esto creará un nuevo commit que forzará a Vercel a hacer un nuevo deploy.

### Opción C: Redeploy desde Vercel Dashboard

1. Ve a: **Deployments**
2. Clic en **"..."** del deployment más reciente
3. Selecciona **"Redeploy"**
4. En el modal, verifica:
   - **Branch** = `main`
   - **Commit** = El más reciente
5. Clic en **"Redeploy"**

---

## ✅ Paso 4: Verificar que funciona

### 4.1. Verificar en producción

1. Abre: https://macro-dashboard-seven.vercel.app/dashboard
2. Verifica:
   - ✅ **Cabecera oscura** (no blanca)
   - ✅ **Menú completo**: Calendario, Correlaciones, Narrativas, Sesgos, Análisis diario, Notificaciones, Ayuda
   - ✅ **Título**: "CM11 Trading" (no "🦅 Macro Dashboard")
   - ✅ **NO aparece** "Inicializando datos…"

### 4.2. Verificar en diferentes rutas

- `/dashboard` - Debe mostrar dashboard completo
- `/calendario` - Debe cargar correctamente
- `/correlations` - Debe cargar correctamente
- `/narrativas` - Debe cargar correctamente
- `/sesgos` - Debe cargar correctamente

### 4.3. Verificar en móvil

Abre la URL en un dispositivo móvil y verifica que:
- La cabecera se ve correctamente
- El menú funciona (puede estar en hamburger menu en móvil)

---

## 🔍 Troubleshooting

### Problema: Sigue mostrando la versión antigua

**Posibles causas:**

1. **Vercel está cacheando la versión antigua**
   - Solución: Espera 5-10 minutos y recarga con Ctrl+Shift+R (hard refresh)
   - O borra la caché del navegador

2. **Hay otro proyecto en Vercel usando el mismo dominio**
   - Solución: Verifica en Vercel Dashboard que solo hay UN proyecto con ese dominio

3. **El deployment no se completó correctamente**
   - Solución: Revisa los logs del deployment en Vercel
   - Ve a: Deployments → [Último deployment] → Functions → Ver logs

4. **El código nuevo no está en main**
   - Solución: Verifica en GitHub que `components/NavBar.tsx` tiene la versión nueva

### Problema: Error 404 o 500

1. Revisa los logs del deployment en Vercel
2. Verifica que todas las variables de entorno están configuradas
3. Verifica que el build se completó sin errores

### Problema: Build falla

1. Revisa los logs del build en Vercel
2. Verifica que todas las dependencias están en `package.json`
3. Verifica que no hay errores de TypeScript

---

## ✅ Checklist Final

Antes de considerar resuelto:

- [ ] ✅ Código nuevo está en GitHub (repo CMLL1992/macro-dashboard, rama main)
- [ ] ✅ NavBar.tsx tiene todos los menús nuevos
- [ ] ✅ Vercel está conectado al repo correcto (CMLL1992/macro-dashboard)
- [ ] ✅ Production Branch en Vercel es `main`
- [ ] ✅ Último deployment es de la rama `main` con código nuevo
- [ ] ✅ Mini-captura del deployment muestra cabecera oscura
- [ ] ✅ Dashboard en producción muestra cabecera oscura
- [ ] ✅ Menú completo visible en producción
- [ ] ✅ No aparece "Inicializando datos…"
- [ ] ✅ Todas las rutas funcionan correctamente

---

## 📝 Notas

- Los deploys en Vercel suelen tardar 2-5 minutos
- Después del deploy, puede tardar 1-2 minutos en propagarse
- Si haces cambios, siempre haz push a `main` para que Vercel los detecte automáticamente
- Vercel hace deploy automático de cada push a `main` (si está configurado así)

---

## 🎯 Resultado Esperado

Una vez completado todo:

✅ **Dashboard en producción** (`https://macro-dashboard-seven.vercel.app/dashboard`):
- Cabecera oscura con menú completo
- Título "CM11 Trading"
- Todos los menús funcionando
- Sin mensaje "Inicializando datos…"
- Misma apariencia que en localhost:3000











