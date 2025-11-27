# ✅ Solución Implementada: Persistencia de Datos y Cron Job Diario

## 🎯 Problema Resuelto

**Problema**: La base de datos en Vercel (`/tmp/macro.db`) es efímera y se pierde en cada deploy, causando que:
- Los datos históricos se pierdan
- El dashboard muestre "—" en datos anteriores
- Necesites actualizar manualmente después de cada deploy

## ✅ Soluciones Implementadas

### 1. **Cron Job Diario Automático** ✅

Se ha configurado un cron job que se ejecuta **diariamente a las 6:00 AM UTC** para actualizar automáticamente:

- ✅ Datos FRED (14 series macroeconómicas)
- ✅ Correlaciones (todos los pares)
- ✅ Bias macro (todos los símbolos)

**Archivo**: `app/api/jobs/daily-update/route.ts`
**Configuración**: `vercel.json`

```json
{
  "path": "/api/jobs/daily-update",
  "schedule": "0 6 * * *"  // 6:00 AM UTC diariamente
}
```

**Beneficios**:
- Los datos se actualizan automáticamente cada día
- No necesitas intervención manual
- Los datos estarán frescos incluso después de un deploy

### 2. **Documentación para Turso (Base de Datos Persistente)** ✅

Se ha creado documentación completa para configurar **Turso** (SQLite distribuido) como base de datos persistente.

**Archivo**: `CONFIGURAR-TURSO.md`

**Ventajas de Turso**:
- ✅ Datos persistentes entre deploys
- ✅ Plan gratuito generoso (500 MB, 1 millón de filas)
- ✅ Compatible con SQLite (mismo esquema)
- ✅ Migración fácil

**Nota**: La migración completa a Turso requiere cambiar la aplicación de sync (better-sqlite3) a async (Turso), lo cual es más complejo. Por ahora, el cron job diario mantendrá los datos actualizados.

---

## 🚀 Cómo Funciona Ahora

### Escenario Actual (Sin Turso)

1. **Desarrollo local**: Base de datos en `./macro.db` (persistente)
2. **Producción (Vercel)**: Base de datos en `/tmp/macro.db` (efímera)
3. **Cron job diario**: Actualiza los datos automáticamente cada día a las 6:00 AM UTC

**Flujo**:
```
Deploy → Base de datos vacía → Cron job actualiza datos → Dashboard funciona
```

**Ventajas**:
- ✅ Datos actualizados automáticamente
- ✅ No necesitas intervención manual
- ✅ Funciona sin configuración adicional

**Desventajas**:
- ⚠️ Los datos históricos se pierden en cada deploy
- ⚠️ Si el cron job falla, los datos pueden estar desactualizados

### Escenario Futuro (Con Turso)

1. **Desarrollo local**: Base de datos en `./macro.db` (persistente)
2. **Producción (Vercel)**: Base de datos en Turso (persistente)
3. **Cron job diario**: Actualiza los datos automáticamente cada día

**Flujo**:
```
Deploy → Base de datos en Turso (persistente) → Datos históricos preservados → Dashboard funciona
```

**Ventajas**:
- ✅ Datos persistentes entre deploys
- ✅ Histórico completo preservado
- ✅ Datos actualizados automáticamente
- ✅ Más robusto y confiable

---

## 📋 Próximos Pasos

### Opción A: Usar Cron Job Diario (Recomendado para empezar)

**No necesitas hacer nada**. El cron job se ejecutará automáticamente cada día.

**Para verificar**:
1. Espera a que se ejecute el cron job (6:00 AM UTC)
2. O ejecuta manualmente:
```bash
curl -X POST \
  -H "Authorization: Bearer $CRON_TOKEN" \
  https://macro-dashboard-seven.vercel.app/api/jobs/daily-update
```

### Opción B: Configurar Turso (Para persistencia completa)

Sigue los pasos en `CONFIGURAR-TURSO.md`:

1. Crear cuenta en Turso
2. Crear base de datos
3. Configurar variables de entorno en Vercel
4. (Opcional) Migrar datos existentes

**Nota**: La migración completa a Turso requiere cambios en el código para usar async. Por ahora, el cron job diario es suficiente para mantener los datos actualizados.

---

## 🔍 Verificar que Funciona

### 1. Verificar Cron Job

1. Ve a Vercel → Tu proyecto → Deployments
2. Busca el deployment más reciente
3. Ve a "Functions" → Busca `/api/jobs/daily-update`
4. Verifica que se haya ejecutado

### 2. Verificar Datos en el Dashboard

1. Ve a https://macro-dashboard-seven.vercel.app/dashboard
2. Verifica que:
   - Los datos se muestren correctamente
   - "Dato anterior" no muestre "—" (después de que se ejecute el cron job)
   - "Última actualización" muestre una fecha reciente

### 3. Verificar Endpoint de Health

```bash
curl https://macro-dashboard-seven.vercel.app/api/health
```

Deberías ver:
```json
{
  "hasData": true,
  "observationCount": 10000+,  // Debería ser > 0
  "latestDate": "2025-11-26"   // Fecha reciente
}
```

---

## 📚 Archivos Modificados/Creados

1. ✅ `vercel.json` - Agregado cron job diario
2. ✅ `app/api/jobs/daily-update/route.ts` - Nuevo endpoint para actualización diaria
3. ✅ `CONFIGURAR-TURSO.md` - Documentación completa de Turso
4. ✅ `lib/db/turso-adapter.ts` - Adapter para Turso (preparado para futuro)
5. ✅ `package.json` - Agregado `@libsql/client` (para futuro uso con Turso)

---

## ✅ Checklist

- [x] Cron job diario configurado
- [x] Endpoint de actualización diaria creado
- [x] Documentación de Turso creada
- [x] Adapter de Turso preparado (para futuro)
- [ ] (Opcional) Configurar Turso en Vercel
- [ ] (Opcional) Migrar datos a Turso

---

## 🆘 Troubleshooting

### El cron job no se ejecuta

**Solución**: 
1. Verifica que `CRON_TOKEN` esté configurado en Vercel
2. Verifica que el schedule sea correcto en `vercel.json`
3. Ejecuta manualmente el endpoint para verificar que funciona

### Los datos siguen mostrando "—"

**Solución**:
1. Espera a que se ejecute el cron job (6:00 AM UTC)
2. O ejecuta manualmente el endpoint de actualización
3. Verifica que el endpoint `/api/jobs/ingest/fred` funcione correctamente

### Error al ejecutar el cron job

**Solución**:
1. Verifica los logs en Vercel → Deployments → Functions
2. Verifica que `CRON_TOKEN` sea correcto
3. Verifica que `APP_URL` esté configurado (o usa el valor por defecto)

---

**¿Necesitas ayuda?** Revisa `CONFIGURAR-TURSO.md` o abre un issue en GitHub.

