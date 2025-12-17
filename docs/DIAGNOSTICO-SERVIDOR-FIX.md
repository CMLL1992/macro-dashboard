# Diagnóstico y Fix del Servidor

**Fecha**: 2025-12-17  
**Estado**: ✅ Problema identificado y solución aplicada

---

## 🔍 Diagnóstico

### Información del sistema
- **OS**: macOS (Darwin 24.6.0, ARM64 - Apple Silicon)
- **Node**: v20.19.6 (LTS, compatible)
- **Package Manager**: pnpm 10.20.0
- **Puerto**: 3001 (servidor corriendo pero con error)

### Error real encontrado

**NO es un problema de `better-sqlite3` ni `detect-libc`.**

El error real es:
```
Error: Cannot find module '/Users/.../node_modules/.pnpm/postcss@8.4.31/node_modules/nanoid/non-secure/index.cjs'
```

**Causa**: Dependencias rotas en `node_modules`, específicamente `nanoid` (dependencia de `postcss`) no está correctamente instalada o está corrupta.

### Verificaciones realizadas
- ✅ `better-sqlite3` está compilado correctamente (`.node` existe)
- ✅ Node v20.19.6 es compatible
- ✅ `node_modules` existe
- ❌ `nanoid` (dependencia de `postcss`) está rota o faltante

---

## ✅ Solución aplicada

### Paso 1: Limpiar instalación previa

```bash
cd ~/Desktop/"macro-dashboard-with-data 2"

# Matar procesos existentes
lsof -nP -iTCP:3000 -sTCP:LISTEN | awk 'NR>1 {print $2}' | xargs kill -9 2>/dev/null || true
lsof -nP -iTCP:3001 -sTCP:LISTEN | awk 'NR>1 {print $2}' | xargs kill -9 2>/dev/null || true

# Limpiar node_modules
rm -rf node_modules
```

### Paso 2: Reinstalar dependencias

```bash
# Reinstalar limpio
pnpm install
```

**Nota**: No borramos `pnpm-lock.yaml` porque está bien y mantiene versiones consistentes.

### Paso 3: Verificar instalación

```bash
# Verificar que nanoid existe
ls -la node_modules/.pnpm/nanoid*/node_modules/nanoid/non-secure/index.cjs 2>/dev/null | head -1

# Verificar que postcss está bien
ls -la node_modules/.pnpm/postcss@*/node_modules/postcss 2>/dev/null | head -1
```

### Paso 4: Reiniciar servidor

```bash
# Arrancar servidor limpio
./node_modules/.bin/next dev -p 3001
```

**Esperado**: Servidor arranca sin errores de módulos faltantes.

---

## 🔧 Solución alternativa (si persiste)

Si después de `pnpm install` sigue fallando:

### Opción A: Limpiar cache de pnpm

```bash
pnpm store prune
rm -rf node_modules
pnpm install
```

### Opción B: Forzar reinstalación de postcss/nanoid

```bash
pnpm remove postcss
pnpm add -D postcss
pnpm install
```

### Opción C: Verificar integridad de pnpm-lock.yaml

```bash
# Si hay conflictos serios, regenerar lockfile (último recurso)
rm pnpm-lock.yaml
pnpm install
```

---

## ✅ Checklist de validación

Después de aplicar la solución, verificar:

- [ ] `pnpm install` termina sin errores
- [ ] `./node_modules/.bin/next dev -p 3001` arranca sin stacktraces
- [ ] En consola aparece el log `ENV CHECK` (para la key de Alpha Vantage)
- [ ] La llamada `curl -X POST "http://localhost:3001/api/jobs/ingest/fred?reset=true&batch=1&only=USPMI"` devuelve 200/OK
- [ ] Logs de Alpha Vantage aparecen correctamente en consola

---

## 📝 Notas técnicas

### Por qué no es better-sqlite3
- `better-sqlite3` está compilado correctamente (`.node` existe)
- El error ocurre ANTES de que se cargue cualquier módulo de BD
- El error es en el loader de PostCSS, no en runtime de Node

### Por qué es nanoid/postcss
- Next.js usa PostCSS para procesar CSS
- PostCSS depende de `nanoid` para generar IDs únicos
- Si `nanoid` no está instalado correctamente, PostCSS falla al cargar
- Esto impide que Next.js compile cualquier página que use CSS

### Por qué pnpm puede causar esto
- pnpm usa symlinks y estructura de carpetas diferente a npm/yarn
- Si hay un problema durante la instalación, algunas dependencias pueden quedar "huérfanas"
- La limpieza y reinstalación resuelve la mayoría de estos casos

---

**Resultado esperado**: Servidor funcionando correctamente, listo para probar ingesta de USPMI.

---

## ✅ Estado final (2025-12-17)

### Problema resuelto
- ✅ `nanoid` instalado correctamente
- ✅ `postcss` funcionando
- ✅ Servidor arranca sin errores de módulos faltantes
- ✅ Servidor responde en puerto 3001

### Verificación realizada
```bash
# Servidor responde
curl http://localhost:3001
# → Respuesta HTML (redirect a /dashboard, normal)

# Endpoints funcionan
curl http://localhost:3001/api/debug/usa-indicators
# → JSON con datos (si hay datos en BD)
```

### Próximos pasos
1. Verificar que el log "ENV CHECK" aparece en consola del servidor
2. Probar ingesta de USPMI: `curl -X POST "http://localhost:3001/api/jobs/ingest/fred?reset=true&batch=1&only=USPMI"`
3. Validar que USPMI aparece en dashboard

**Nota sobre better-sqlite3**: Aunque pnpm muestra warning sobre build scripts, esto no impide que el servidor funcione si se usa Turso (que es el caso en producción). Si se necesita better-sqlite3 localmente, ejecutar `pnpm approve-builds` y seleccionar `better-sqlite3`.
