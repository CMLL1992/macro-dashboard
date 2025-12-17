# ✅ Solución: PMI Manufacturing - Inserción Manual

## 🎯 Situación Actual

- **Alpha Vantage:** ❌ No tiene ISM Manufacturing PMI disponible (ni en plan gratuito ni premium)
- **Calendario:** ⚠️ No hay eventos de PMI en los últimos 90 días
- **Cobertura US:** 88% (15/17) → Objetivo: 100% (17/17)

---

## ✅ Solución: Inserción Manual

El sistema ya tiene un endpoint para insertar PMI manualmente. Es la solución más práctica hasta que haya una fuente automática disponible.

### Endpoint Disponible

**POST** `/api/admin/pmi/insert`

**Autenticación:** `CRON_TOKEN` o `INGEST_KEY`

**Body:**
```json
{
  "date": "2025-12-01",
  "value": 52.5
}
```

---

## 📋 Pasos para Insertar PMI

### 1. Obtener Valor de PMI

El PMI Manufacturing se publica el **primer día hábil de cada mes** por ISM (Institute for Supply Management).

**Fuentes:**
- ISM: https://www.ismworld.org/supply-management-news-and-reports/reports/ism-pmi-reports/
- Trading Economics: https://tradingeconomics.com/united-states/manufacturing-pmi
- FRED (alternativa): Buscar series relacionadas

**Valores típicos:** 40-60 (50 = neutral, >50 = expansión, <50 = contracción)

### 2. Insertar en el Sistema

```bash
curl -X POST https://macro-dashboard-seven.vercel.app/api/admin/pmi/insert \
  -H "Authorization: Bearer ${CRON_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2025-12-01",
    "value": 52.5
  }'
```

**Respuesta esperada:**
```json
{
  "success": true,
  "message": "PMI value inserted successfully",
  "date": "2025-12-01",
  "value": 52.5
}
```

### 3. Verificación

```bash
# Verificar datos en BD
curl https://macro-dashboard-seven.vercel.app/api/debug/usa-indicators | jq '.USPMI'

# Verificar cobertura
curl https://macro-dashboard-seven.vercel.app/api/dashboard | jq '.data.coverage.US'
# Debería mostrar: { "total": 17, "withData": 17, "percentage": 100 }

# Verificar PMI en dashboard
curl https://macro-dashboard-seven.vercel.app/api/dashboard | jq '[.data.indicators[] | select(.key == "pmi_mfg")][0]'
# Debería mostrar: { "key": "pmi_mfg", "value": 52.5, "date": "2025-12-01" }
```

---

## 🔄 Automatización Futura

### Opción A: Mejorar Job PMI con Calendario
- El job PMI ya busca eventos de últimos 90 días
- Si el calendario se actualiza con eventos de PMI, se ingerirán automáticamente

### Opción B: Web Scraping de ISM
- Scraping de la página de ISM (requiere manejo de rate limits y cambios de formato)

### Opción C: Otra API
- Buscar proveedores alternativos que tengan PMI disponible

---

## ✅ Checklist

- [ ] Obtener valor de PMI más reciente (ISM o Trading Economics)
- [ ] Insertar usando `/api/admin/pmi/insert`
- [ ] Verificar datos en BD: `USPMI.count > 0`
- [ ] Verificar dashboard: PMI muestra valor (no null)
- [ ] Verificar cobertura: US = 100% (17/17) ✅

---

## 🎯 Resultado Esperado

Después de inserción manual:

```json
{
  "coverage": {
    "US": {
      "total": 17,
      "withData": 17,
      "percentage": 100
    }
  },
  "pmi_mfg": {
    "key": "pmi_mfg",
    "value": 52.5,
    "date": "2025-12-01"
  }
}
```

**UI:** Cobertura US pasa a **verde (100%)** ✅

---

## 📝 Nota

PMI se publica mensualmente. Para mantener datos actualizados:
- Insertar manualmente cada mes después de publicación
- O automatizar con job que scrapee ISM (futuro)
