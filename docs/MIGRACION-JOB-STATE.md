# Migración: Crear tabla `job_state` en Turso

## Problema

Los jobs `/api/jobs/ingest/fred` y `/api/jobs/compute/bias` fallan con error:
```
no such table: job_state
```

**Causa:** La tabla `job_state` está definida en el código pero no existe en la base de datos Turso de producción. En Turso/libsql, las tablas deben crearse explícitamente mediante migración SQL.

## Solución

### Opción A: Usar script de migración (Recomendado)

El script `scripts/migrate-turso.ts` ya incluye la creación de `job_state`. Ejecuta:

```bash
pnpm db:migrate:turso
```

O si tienes un script npm configurado:
```bash
pnpm run migrate:turso
```

**Requisitos:**
- `TURSO_DATABASE_URL` en `.env.local`
- `TURSO_AUTH_TOKEN` en `.env.local`

### Opción B: Ejecutar SQL directamente en Turso

Si prefieres ejecutar SQL directamente:

```sql
CREATE TABLE IF NOT EXISTS job_state (
  job_name TEXT PRIMARY KEY,
  cursor TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_run_status TEXT,
  last_run_duration_ms INTEGER
);

CREATE INDEX IF NOT EXISTS idx_job_state_updated_at ON job_state(updated_at);
```

**Verificar que se creó:**
```sql
SELECT name FROM sqlite_master WHERE type='table' AND name='job_state';
```

Deberías ver:
```
job_state
```

## Guardrails implementados

Aunque la tabla no exista, los jobs **NO se romperán** porque:

1. `getJobState()` retorna `null` si la tabla no existe (log warning, no error)
2. `saveJobState()` loggea warning pero no lanza excepción si la tabla no existe
3. Los jobs continúan funcionando sin tracking de estado (solo sin cursor/continuation)

**Nota:** Sin la tabla, los jobs no podrán usar batch mode con continuation, pero seguirán funcionando normalmente.

## Después de la migración

Una vez creada la tabla, los jobs automáticamente:
- Guardarán el cursor después de cada batch
- Podrán continuar desde el último cursor en la siguiente ejecución
- Mostrarán `done: true` cuando completen todos los batches
