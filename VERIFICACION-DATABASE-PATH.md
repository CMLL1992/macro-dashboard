# 🔍 Verificación de DATABASE_PATH y Path Real

## ✅ Verificaciones Realizadas en el Código

### 1. Verificación de Uso de getDB()

**Resultado:** ✅ **TODOS los archivos usan `getDB()`**

- ✅ `app/api/health/route.ts` - Usa `getDB()`
- ✅ `app/api/diag/route.ts` - Usa `getLastIngestAt()` y `getLastWarmupResult()` que usan `getDB()`
- ✅ `lib/db/upsert.ts` - Todas las funciones usan `getDB()`
- ✅ `lib/db/read-macro.ts` - Todas las funciones usan `getDB()`
- ✅ Solo hay **UN** `new Database()` en todo el código: dentro de `getDB()` en `lib/db/schema.ts`

**Conclusión:** No hay rutas alternativas que usen paths diferentes. Todo pasa por `getDB()`.

### 2. Logs de Depuración Añadidos

**Logs detallados añadidos en `getDB()`:**

```typescript
console.log('[db] Opening database at:', DB_PATH)
console.log('[db] DATABASE_PATH env:', process.env.DATABASE_PATH || 'NOT SET')
console.log('[db] isVercel:', isVercel)
console.log('[db] VERCEL:', process.env.VERCEL || 'NOT SET')
console.log('[db] VERCEL_ENV:', process.env.VERCEL_ENV || 'NOT SET')
console.log('[db] VERCEL_URL:', process.env.VERCEL_URL || 'NOT SET')
console.log('[db] process.cwd():', process.cwd())
```

Estos logs aparecerán **antes** de intentar abrir la BD, así que veremos exactamente qué path se está usando.

---

## 🔍 Qué Verificar en Vercel

### Paso 1: Verificar Variable DATABASE_PATH

1. **Ve a Vercel Dashboard:**
   - https://vercel.com → Tu proyecto → **Settings** → **Environment Variables**

2. **Busca la variable `DATABASE_PATH`:**
   - ¿Existe?
   - ¿Está marcada para Production?
   - ¿Qué valor tiene?

3. **Si existe y NO es `/tmp/macro.db`:**
   - **Opción A:** Eliminarla o desactivarla para Production
   - **Opción B:** Cambiarla a exactamente `/tmp/macro.db`

4. **Si NO existe:**
   - ✅ Perfecto, el código usará la lógica automática

### Paso 2: Desplegar y Probar

1. **Hacer push de los cambios:**
   ```bash
   cd /Users/carlosmontagutllarch/Desktop/macro-dashboard-with-data
   git add lib/db/schema.ts
   git commit -m "fix: añadir logs detallados para debug de path de BD"
   git push origin main
   ```

2. **Esperar deployment (2-5 minutos)**

3. **Probar endpoints:**
   ```bash
   curl https://macro-dashboard-seven.vercel.app/api/health
   curl https://macro-dashboard-seven.vercel.app/api/diag
   ```

### Paso 3: Revisar Logs en Vercel

1. **Ve a Vercel → Logs:**
   - Environment: `Production`
   - Type: `Function`
   - Buscar: `/api/health` o `/api/diag`

2. **Busca las líneas que empiezan con `[db]`:**

**Líneas que DEBEN aparecer:**
```
[db] ========================================
[db] Opening database at: [PATH AQUÍ]
[db] DATABASE_PATH env: [valor o NOT SET]
[db] isVercel: [true/false]
[db] VERCEL: [valor o NOT SET]
[db] VERCEL_ENV: [valor o NOT SET]
[db] VERCEL_URL: [valor o NOT SET]
[db] process.cwd(): [path]
[db] ========================================
```

**Si hay error, también verás:**
```
[db] ERROR opening database at: [PATH AQUÍ]
[db] Error message: [mensaje]
[db] Error code: [código]
```

---

## 📋 Información que Necesito

**Copia y pega aquí:**

### 1. Variable DATABASE_PATH en Vercel

- [ ] ¿Existe la variable `DATABASE_PATH` en Vercel?
- [ ] Si existe, ¿qué valor tiene?
- [ ] ¿Está marcada para Production?

### 2. Path que Aparece en los Logs

**Después de llamar a `/api/health` y `/api/diag`, copia todas las líneas que empiezan con `[db]`:**

```
[PEGAR AQUÍ todas las líneas [db]]
```

**Especialmente importante:**
- `[db] Opening database at: [PATH]` - Este es el path que se está intentando usar
- `[db] DATABASE_PATH env: [valor]` - Si está configurada o no
- `[db] isVercel: [true/false]` - Si detecta Vercel correctamente
- `[db] ERROR opening database at: [PATH]` - Si hay error, qué path falló

### 3. Error Específico (si hay)

```
[PEGAR AQUÍ el error completo]
```

---

## 🎯 Interpretación de Resultados

### Escenario 1: DATABASE_PATH está configurada incorrectamente

**Si en los logs ves:**
```
[db] DATABASE_PATH env: data/macro.db
[db] Opening database at: data/macro.db
```

**Problema:** La variable de entorno está sobrescribiendo el path correcto.

**Solución:** Eliminar o cambiar `DATABASE_PATH` en Vercel a `/tmp/macro.db` o eliminarla.

### Escenario 2: isVercel es false

**Si en los logs ves:**
```
[db] isVercel: false
[db] Opening database at: /var/task/macro.db
```

**Problema:** No se está detectando Vercel correctamente.

**Solución:** Verificar que `VERCEL`, `VERCEL_ENV` o `VERCEL_URL` estén disponibles.

### Escenario 3: Path correcto pero error de permisos

**Si en los logs ves:**
```
[db] Opening database at: /tmp/macro.db
[db] ERROR: unable to open database file
```

**Problema:** Permisos en `/tmp` o problema con better-sqlite3.

**Solución:** Necesitaremos revisar permisos o configuración de better-sqlite3.

---

## 🚀 Siguiente Paso

Una vez que tengas:
1. Estado de `DATABASE_PATH` en Vercel
2. Las líneas de log `[db]` completas
3. El error específico (si hay)

Con esa información podremos identificar exactamente qué está pasando y aplicar la solución correcta.

---

**Última actualización:** $(date +"%d/%m/%Y %H:%M")

