# Paso 1: Verificar DATABASE_PATH en Vercel

## Instrucciones

1. **Ve a Vercel Dashboard:**
   - https://vercel.com → Tu proyecto `macro-dashboard`
   - Click en **Settings** → **Environment Variables**

2. **Busca la variable `DATABASE_PATH`:**
   - ¿Existe?
   - ¿Está marcada para **Production**?

3. **Si existe:**
   - **Opción A:** Elimínala completamente
   - **Opción B:** Desactívala para Production (uncheck Production)
   - **Opción C:** Cámbiala a exactamente `/tmp/macro.db`

4. **Guarda los cambios**

5. **Lanza un nuevo deployment:**
   - Ve a **Deployments**
   - Click en el último deployment
   - Click en **"Redeploy"** (o espera a que se despliegue automáticamente)

## Resultado esperado

✅ Ninguna variable `DATABASE_PATH` debe estar forzando una ruta distinta de `/tmp/macro.db` en Production.

---

**Después de hacer esto, indica:**
- ¿Existía `DATABASE_PATH`?
- ¿Qué acción tomaste? (Eliminada / Desactivada / Cambiada a `/tmp/macro.db`)

