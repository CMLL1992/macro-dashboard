# Datos Manuales

Este directorio contiene datos importados manualmente cuando no hay acceso a APIs automáticas.

## USPMI.csv

Archivo CSV con datos de ISM Manufacturing PMI.

**Formato**:
```csv
date,value
1990-01,52.1
1990-02,51.9
...
```

**Fuente**: ISM (Institute for Supply Management) - https://www.ismworld.org/

**Uso**: Ejecutar `pnpm tsx scripts/import-uspmi-manual.ts`

**Nota**: Este archivo NO debe estar en git (añadir a `.gitignore` si contiene datos reales).
