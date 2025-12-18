# Guía de Uso - Script de Validación QA

## Ejecución Rápida

```bash
# Validar dashboard local (default: http://localhost:3001)
pnpm validate:qa

# Validar dashboard en producción
DASHBOARD_URL=https://tu-dominio.vercel.app pnpm validate:qa

# O usando argumento
pnpm validate:qa --url=https://tu-dominio.vercel.app
```

## Qué Valida

El script ejecuta 6 validaciones principales:

1. **Cobertura de Datos**
   - Timestamp de última actualización
   - Cobertura por moneda (USD/EUR/GBP)
   - Indicadores con valores null

2. **Régimen Actual**
   - Tipo de régimen y confianza
   - Timestamp de cálculo
   - Inputs visibles y no-null

3. **Regímenes por Moneda**
   - Diferencias entre USD/EUR/GBP
   - Drivers con fechas recientes
   - Detección de regímenes clonados

4. **Escenarios Institucionales**
   - Probabilidades suman 100%
   - No están clavados (placeholder)
   - Timestamps presentes

5. **Indicadores Macro**
   - Sin NaN/Infinity
   - Sin fechas futuras
   - Unidades presentes
   - Valores no absurdos

6. **Pares Tácticos**
   - Distribución de sesgos (no todo bullish/neutral)
   - Drivers presentes (2-3 por par)
   - Coherencia con régimen

## Interpretación del Reporte

### ✅ Sección OK
- Sin errores ni advertencias
- Todo funciona correctamente

### ⚠️ Advertencias
- Problemas menores que no bloquean
- Pueden indicar mejoras necesarias
- Ejemplo: cobertura < 80%, timestamp antiguo

### ❌ Errores
- Problemas críticos que requieren atención
- Ejemplo: NaN/Infinity, regímenes clonados, probabilidades clavadas

## Ejemplo de Salida

```
================================================================================
📊 REPORTE DE VALIDACIÓN QA - DASHBOARD MACRO TRADING
================================================================================
URL: http://localhost:3001
Fecha: 2025-12-17T23:00:00.000Z
================================================================================

✅ 1. Cobertura de Datos
   ✅ Sin problemas detectados

✅ 2. Régimen Actual del Mercado
   ⚠️ Régimen es "Neutral" (puede indicar inputs null)
   📋 Detalles: { "type": "Neutral", "confidence": 0.5 }

❌ 3. Regímenes Macro por Moneda
   ❌ USD y EUR tienen los mismos drivers (posible clonado)

...

================================================================================
📈 RESUMEN
================================================================================
✅ Secciones OK: 4/6
⚠️  Advertencias: 3
❌ Errores: 2
================================================================================
```

## Integración en CI/CD

```yaml
# .github/workflows/validate-qa.yml
name: Validate Dashboard QA

on:
  schedule:
    - cron: '0 */6 * * *'  # Cada 6 horas
  workflow_dispatch:

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: pnpm install
      - run: pnpm validate:qa --url=${{ secrets.DASHBOARD_URL }}
```

## Troubleshooting

### Error: "No data in response"
- Verificar que el servidor esté corriendo
- Verificar que `/api/dashboard` esté accesible
- Revisar logs del servidor

### Error: "HTTP 500"
- Revisar logs del servidor
- Verificar que la base de datos esté accesible
- Verificar variables de entorno

### Advertencia: "Última actualización muy antigua"
- Verificar que el cron job esté corriendo
- Revisar logs del cron job
- Verificar configuración de Vercel cron
