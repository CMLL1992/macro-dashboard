# 🎯 Instrucciones: Verificación Local al 100%

Este documento contiene las instrucciones paso a paso para dejar el dashboard funcionando perfectamente en local antes de desplegar a Vercel.

---

## 🚀 Inicio Rápido

### Paso 1: Preparar el entorno

```bash
# 1. Asegúrate de estar en el branch principal
git checkout main
git pull

# 2. Instalar dependencias
pnpm install

# 3. Verificar versión de Node (debe ser 20.x)
node --version
```

### Paso 2: Configurar variables de entorno

**Crea `.env.local` en la raíz del proyecto** con estas variables mínimas:

```bash
# Base de datos (opcional - si no configuras Turso, se usará SQLite local)
TURSO_DATABASE_URL=libsql://tu-db-xxxxx.turso.io
TURSO_AUTH_TOKEN=tu_token_aqui

# API Keys (obligatorio)
FRED_API_KEY=tu_fred_api_key_aqui

# Seguridad (obligatorio)
CRON_TOKEN=tu_cron_token_secreto_aqui
INGEST_KEY=tu_ingest_key_secreto_aqui

# Configuración
APP_URL=http://localhost:3000
```

**📝 Nota:** Si tienes acceso a Vercel, puedes copiar las variables desde:
- Vercel Dashboard → Settings → Environment Variables

### Paso 3: Verificar conexión a base de datos

```bash
# Probar conexión a la base de datos
pnpm test:db
```

**Resultado esperado:**
- ✅ Conexión exitosa
- ✅ Esquema inicializado
- ✅ Tablas listadas

### Paso 4: Levantar el servidor

```bash
# En una terminal, levanta el servidor
pnpm dev
```

**Verifica que:**
- ✅ Servidor inicia sin errores
- ✅ Escucha en `http://localhost:3000`

### Paso 5: Verificación completa automática

**En otra terminal** (con el servidor corriendo):

```bash
# Ejecutar verificación completa
pnpm verify:local
```

Este script verifica:
- ✅ Variables de entorno
- ✅ Conexión a base de datos
- ✅ Endpoints funcionando
- ✅ Scripts disponibles

---

## 📋 Verificación Manual Detallada

Si prefieres verificar paso a paso manualmente, sigue el checklist completo en:

**`CHECKLIST-LOCAL.md`**

---

## 🔧 Comandos Útiles

### Verificar base de datos
```bash
pnpm test:db
```

### Verificar endpoints (con servidor corriendo)
```bash
# Health check general
curl http://localhost:3000/api/health | jq

# Health check de base de datos
curl http://localhost:3000/api/health/db | jq

# Dashboard
curl http://localhost:3000/api/dashboard | jq

# Bias
curl http://localhost:3000/api/bias | jq

# Correlaciones
curl http://localhost:3000/api/correlations | jq
```

### Actualizar datos (ejecutar jobs)

```bash
# Bootstrap completo (fred + correlations + bias)
pnpm job:bootstrap

# O individualmente:
pnpm job:ingest:fred      # Actualizar datos FRED
pnpm job:correlations     # Calcular correlaciones
pnpm job:bias            # Calcular sesgos
```

---

## ✅ Checklist Final

Considera que local está al 100% cuando:

- [ ] ✅ `pnpm dev` arranca sin errores
- [ ] ✅ `pnpm test:db` pasa todas las pruebas
- [ ] ✅ `pnpm verify:local` muestra todas las verificaciones en verde
- [ ] ✅ Endpoint `/api/health` responde con `ready: true` o datos válidos
- [ ] ✅ Endpoint `/api/health/db` responde con `ok: true`
- [ ] ✅ Endpoints `/api/dashboard`, `/api/bias`, `/api/correlations` devuelven datos reales
- [ ] ✅ Dashboard en navegador (`http://localhost:3000/dashboard`) carga sin errores
- [ ] ✅ No hay errores en consola del navegador
- [ ] ✅ No hay errores en consola del servidor
- [ ] ✅ Los jobs (`pnpm job:bootstrap`) se ejecutan correctamente
- [ ] ✅ Los datos se actualizan después de ejecutar los jobs

---

## 🐛 Troubleshooting

### Error: "TURSO_DATABASE_URL not set"
- **Solución:** Si no quieres usar Turso, está bien. Se usará SQLite local automáticamente.
- Si quieres usar Turso, configura las variables en `.env.local`

### Error: "Cannot connect to database"
- **Si usas Turso:** Verifica que `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN` sean correctos
- **Si usas SQLite:** Verifica permisos de escritura en el directorio

### Error: "FRED_API_KEY not found"
- **Solución:** Obtén una API key gratuita en: https://fred.stlouisfed.org/docs/api/api_key.html
- Agrega `FRED_API_KEY=tu_key` en `.env.local`

### Endpoints devuelven datos vacíos
- **Solución:** Ejecuta `pnpm job:bootstrap` para poblar la base de datos

### Dashboard muestra "—" o datos antiguos
- **Solución:** Ejecuta `pnpm job:bootstrap` para actualizar datos
- Verifica que los jobs se ejecuten correctamente (revisa logs del servidor)

### Servidor no inicia
- Verifica que el puerto 3000 esté libre
- Verifica que Node sea versión 20.x
- Revisa errores en la consola

---

## 🚀 Siguiente Paso: Vercel

Una vez que **TODOS** los items del checklist estén ✅:

1. **Anota todas las variables de entorno** de `.env.local`
2. **Borrar proyecto antiguo en Vercel** (si existe)
3. **Crear proyecto nuevo desde cero** en Vercel
4. **Configurar variables de entorno** en Vercel (copiar desde `.env.local`)
5. **Desplegar** el código que ya funciona en local

---

## 📚 Documentos Relacionados

- `CHECKLIST-LOCAL.md` - Checklist detallado paso a paso
- `scripts/test-db.ts` - Script de prueba de base de datos
- `scripts/verificar-local-completo.ts` - Script de verificación completa
- `app/api/health/db/route.ts` - Endpoint de health check de BD

---

**Última actualización:** $(date +"%d/%m/%Y %H:%M")


