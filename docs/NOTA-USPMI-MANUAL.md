# Nota: USPMI - Importación Manual

**Fecha**: 2025-12-17  
**Estado**: ✅ Activo

---

## ⚠️ Importante

**USPMI (ISM Manufacturing PMI) se mantiene por importación manual hasta disponer de API profesional (Trading Economics).**

### Estado actual

- **Fuente**: ISM (Institute for Supply Management) - datos oficiales
- **Método**: Importación manual vía CSV (`data/manual/USPMI.csv`)
- **Metadata**: `source='MANUAL_ISM'` en `macro_series`
- **Actualización**: Manual mensual (ver procedimiento abajo)

### Por qué manual

- Trading Economics requiere plan de pago para acceso a datos de Estados Unidos
- Alpha Vantage no tiene endpoint válido para ISM PMI
- FRED removió datos de ISM en 2016
- **Solución**: Datos oficiales de ISM importados manualmente

---

## 📅 Actualización mensual

**Tiempo requerido**: ~1 minuto

1. ISM publica PMI el **primer día hábil del mes**
2. Añadir línea al CSV: `data/manual/USPMI.csv`
   ```
   2026-01,XX.X
   ```
3. Ejecutar script:
   ```bash
   NODE_OPTIONS="--conditions=react-server" pnpm tsx scripts/import-uspmi-manual.ts
   ```

**Documentación completa**: Ver `docs/USPMI-IMPORTACION-MANUAL.md`

---

## 🔮 Migración futura

Cuando Trading Economics esté disponible:

1. Configurar `TRADING_ECONOMICS_API_KEY` con acceso a US
2. Ejecutar job: `POST /api/jobs/ingest/fred?only=USPMI`
3. El sistema migrará automáticamente a ingesta automática

**Sin cambios de código necesarios** - ya está implementado.

---

**Última actualización**: 2025-12-17  
**Próxima revisión**: Cuando Trading Economics esté disponible
