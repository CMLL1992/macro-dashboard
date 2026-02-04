# Diagnóstico: rutas nuevas en producción

## 1) Estado en el repo (todo en Git)

| Ruta producción        | Archivo en app/              | En Git |
|------------------------|------------------------------|--------|
| `/liquidez`            | `app/liquidez/page.tsx`      | ✅     |
| `/pre-market`          | `app/pre-market/page.tsx`    | ✅     |
| `/programacion`        | `app/programacion/page.tsx`  | ✅     |
| `/settings/telegram`   | `app/settings/telegram/page.tsx` | ✅ |
| `/correlations`        | `app/correlations/page.tsx`  | ✅     |

**Conclusión:** Las rutas nuevas están versionadas. Si el deploy está READY, deberían existir en producción.

---

## 2) Home y entrada

- **`app/page.tsx`**: hace `redirect('/dashboard')` → correcto.
- **Dashboard**: `app/dashboard/page.tsx` (nuevo dashboard).

No hay redirect al dashboard viejo.

---

## 3) Navegación (NavBar) – problema detectado

**`components/NavBar.tsx`** actualmente enlaza a:

- `/dashboard`, `/calendario`, `/correlations`, `/narrativas`, `/sesgos`, `/analisis`, `/notificaciones`, `/ayuda`

**No aparecen en el menú:**

- `/liquidez`
- `/pre-market`
- `/programacion`
- `/settings/telegram` (o un link “Telegram” a settings)

Aunque las páginas existan, si no están en el menú es fácil que parezca que “no están”.  
**Acción:** Se han añadido estos enlaces al NavBar (ver cambios en `components/NavBar.tsx`).

---

## 4) Middleware y config

- **`middleware.ts`**: solo aplica a `/admin/*` (auth). No toca `/liquidez`, `/pre-market`, etc.
- **`next.config.mjs`**: sin rewrites ni redirects que pisen esas rutas.

No hay nada que bloquee las rutas nuevas.

---

## 5) Prueba en producción (qué hacer tú)

Abre en el navegador (sustituye `TU_DOMINIO` por tu dominio real):

1. `https://TU_DOMINIO/liquidez`
2. `https://TU_DOMINIO/pre-market`
3. `https://TU_DOMINIO/programacion`
4. `https://TU_DOMINIO/settings/telegram`
5. `https://TU_DOMINIO/correlations`

**Interpretación:**

- **404** → Esas rutas no están en el build que estás viendo (revisar deploy/Vercel, branch, caché).
- **Carga pero se ve viejo** → Rutas existen; el problema es layout/nav/redirect.
- **Carga y se ve bien** → El problema era solo navegación (menú); con los nuevos links en NavBar debería quedar resuelto.

---

## 6) Resumen

| Pregunta                         | Respuesta en repo |
|----------------------------------|-------------------|
| ¿Rutas nuevas en Git?            | Sí (liquidez, pre-market, programacion, settings/telegram, correlations). |
| ¿Home redirige al dashboard nuevo? | Sí (`/` → `/dashboard`). |
| ¿Menú enlaza a rutas nuevas?     | **No** (falta liquidez, pre-market, programacion, telegram). Corregido en NavBar. |
| ¿Middleware/rewrites las pisan?  | No. |

Si en producción sigues viendo 404 en esas URLs, revisar: deployment correcto en Vercel, dominio (preview vs production, custom vs *.vercel.app) y caché (probar incógnito o `?v=1`).
