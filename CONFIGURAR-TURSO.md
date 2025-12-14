# 🗄️ Configurar Turso para Base de Datos Persistente

## 📋 Problema Actual

La base de datos en Vercel está en `/tmp/macro.db`, que es **efímera** y se pierde en cada deploy o reinicio del servidor. Esto causa que:
- Los datos históricos se pierdan
- El dashboard muestre "—" en datos anteriores
- Necesites actualizar manualmente después de cada deploy

## ✅ Solución: Turso (SQLite Distribuido)

**Turso** es SQLite distribuido que:
- ✅ Mantiene compatibilidad con SQLite (mismo esquema)
- ✅ Plan gratuito generoso (500 MB, 1 millón de filas)
- ✅ Migración fácil (solo cambiar el driver)
- ✅ Datos persistentes entre deploys

---

## 🚀 Pasos para Configurar Turso

### 1. Crear cuenta en Turso

1. Ve a https://turso.tech
2. Crea una cuenta (puedes usar GitHub)
3. Verifica tu email

### 2. Instalar CLI de Turso

```bash
# macOS/Linux
curl -sSfL https://get.tur.so/install.sh | bash

# O con Homebrew
brew install tursodatabase/tap/turso
```

### 3. Iniciar sesión

```bash
turso auth login
```

### 4. Crear base de datos

```bash
# Crear base de datos (reemplaza 'macro-dashboard' con el nombre que prefieras)
turso db create macro-dashboard

# Crear token de autenticación
turso db tokens create macro-dashboard
```

**Guarda el token** que se genera, lo necesitarás para las variables de entorno.

### 5. Obtener URL de la base de datos

```bash
# Listar tus bases de datos
turso db list

# Obtener la URL de conexión
turso db show macro-dashboard --url
```

La URL será algo como: `libsql://macro-dashboard-xxxxx.turso.io`

---

## 🔧 Configurar Variables de Entorno en Vercel

1. Ve a tu proyecto en Vercel: https://vercel.com/dashboard
2. Selecciona tu proyecto `macro-dashboard`
3. Ve a **Settings** → **Environment Variables**
4. Agrega estas variables:

```
TURSO_DATABASE_URL=libsql://macro-dashboard-xxxxx.turso.io
TURSO_AUTH_TOKEN=tu_token_aqui
```

5. **Importante**: Marca ambas como disponibles en:
   - ✅ Production
   - ✅ Preview
   - ✅ Development (opcional)

6. Haz clic en **Save**

---

## 📦 Migrar Datos Existentes (Opcional)

Si ya tienes datos en tu base de datos local, puedes migrarlos:

### Opción A: Usar script de migración (próximamente)

```bash
# Este script copiará los datos de local a Turso
pnpm tsx scripts/migrate-to-turso.ts
```

### Opción B: Dejar que se poblen automáticamente

El cron job diario poblará la base de datos automáticamente. Solo necesitas esperar a que se ejecute.

---

## 🔄 Actualizar Código para Usar Turso

**Nota**: El código ya está preparado para usar Turso cuando las variables de entorno estén configuradas.

El archivo `lib/db/schema.ts` detecta automáticamente si `TURSO_DATABASE_URL` está configurado:
- ✅ Si está configurado → Usa Turso
- ✅ Si no está configurado → Usa better-sqlite3 local

---

## ✅ Verificar Configuración

### 1. Verificar en Vercel

Después de configurar las variables de entorno:

1. Ve a **Settings** → **Environment Variables**
2. Verifica que `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN` estén configuradas
3. Haz un **redeploy** del proyecto

### 2. Verificar en el Dashboard

1. Ve a https://macro-dashboard-seven.vercel.app/dashboard
2. Verifica que los datos se muestren correctamente
3. Verifica que "Dato anterior" no muestre "—"

### 3. Verificar en Turso Dashboard

1. Ve a https://turso.tech/dashboard
2. Selecciona tu base de datos `macro-dashboard`
3. Verifica que las tablas existan:
   - `macro_series`
   - `macro_observations`
   - `macro_bias`
   - `correlations`

---

## 📅 Cron Job Diario

El cron job diario está configurado en `vercel.json`:

```json
{
  "path": "/api/jobs/daily-update",
  "schedule": "0 6 * * *"  // 6:00 AM UTC diariamente
}
```

Este job actualiza:
- ✅ Datos FRED (14 series macroeconómicas)
- ✅ Correlaciones (todos los pares)
- ✅ Bias macro (todos los símbolos)

**Nota**: El cron job se ejecuta automáticamente. No necesitas hacer nada manualmente.

---

## 🆘 Troubleshooting

### Error: "TURSO_DATABASE_URL not set"

**Solución**: Verifica que las variables de entorno estén configuradas en Vercel y que hayas hecho redeploy.

### Error: "Unauthorized" al conectar a Turso

**Solución**: Verifica que `TURSO_AUTH_TOKEN` sea correcto. Puedes generar un nuevo token con:
```bash
turso db tokens create macro-dashboard
```

### Los datos no se actualizan

**Solución**: 
1. Verifica que el cron job se esté ejecutando (ve a Vercel → Deployments → Functions)
2. Ejecuta manualmente el endpoint:
```bash
curl -X POST \
  -H "Authorization: Bearer $CRON_TOKEN" \
  https://macro-dashboard-seven.vercel.app/api/jobs/daily-update
```

### La base de datos está vacía después del deploy

**Solución**: 
1. Verifica que Turso esté configurado correctamente
2. Ejecuta manualmente el job de actualización (ver arriba)
3. Espera a que el cron job diario se ejecute (6:00 AM UTC)

---

## 📚 Recursos

- [Documentación de Turso](https://docs.turso.tech)
- [Turso CLI Reference](https://docs.turso.tech/cli)
- [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs)

---

## ✅ Checklist de Configuración

- [ ] Cuenta creada en Turso
- [ ] CLI de Turso instalado
- [ ] Base de datos creada en Turso
- [ ] Token de autenticación generado
- [ ] Variables de entorno configuradas en Vercel:
  - [ ] `TURSO_DATABASE_URL`
  - [ ] `TURSO_AUTH_TOKEN`
- [ ] Redeploy del proyecto en Vercel
- [ ] Verificar que el dashboard muestre datos correctamente
- [ ] Verificar que el cron job diario se ejecute

---

**¿Necesitas ayuda?** Abre un issue en GitHub o contacta al equipo.

















