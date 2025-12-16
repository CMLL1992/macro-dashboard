# 📊 Estado del Deploy - Correlaciones

**Fecha:** 2025-12-16

---

## ✅ Cambios Aplicados (Local)

### 1. Fixes Críticos
- ✅ `getYahooSymbol` exportado en `lib/correlations/fetch.ts`
- ✅ `errors` separado de `noDataCount` en `app/api/jobs/correlations/route.ts`
- ✅ Logging mejorado con `nullCorrelations` array

### 2. Mejora USDCNH
- ✅ Fallback múltiple para USDCNH: `['CNH=X', 'CNY=X', 'USDCNH=X']`
- ✅ Actualizado en `lib/correlations/fetch.ts` (YAHOO_MAP)
- ✅ Actualizado en `config/tactical-pairs.json`

---

## 📦 Estado del Deploy

### Commits Realizados
1. ✅ `21b0bae` - "fix: export getYahooSymbol, separate errors from noDataCount, improve null correlation logging"
   - **Estado:** Push exitoso a GitHub
   - **Deploy:** ⏳ Pendiente (Vercel puede tardar 1-2 minutos)

2. ⚠️ `75bf732` - "fix: add fallback Yahoo symbols for USDCNH (CNH=X, CNY=X, USDCNH=X)"
   - **Estado:** Commit local, push falló (SSL_ERROR_SYSCALL)
   - **Acción requerida:** Reintentar push manualmente

---

## 🔍 Verificación del Deploy

### Job Actual (Código Viejo)
```json
{
  "success": true,
  "processed": 19,
  "errors": 0,
  "duration_ms": 12123
}
```

**Nota:** Aún no incluye `noDataCount`, `nullCorrelationsCount`, ni `nullCorrelations`.

### Job Esperado (Código Nuevo)
```json
{
  "success": true,
  "processed": 19,
  "errors": 0,
  "noDataCount": 1,
  "nullCorrelationsCount": 1,
  "duration_ms": ~12000,
  "nullCorrelations": [
    {
      "symbol": "USDCNH",
      "assetPoints": 0,
      "assetLastDate": null,
      "corr12m_reasonNull": "NO_DATA",
      "corr3m_reasonNull": "NO_DATA"
    }
  ]
}
```

---

## 🚀 Próximos Pasos

### 1. Reintentar Push del Commit de USDCNH
```bash
git push origin main
```

Si falla por SSL, intentar:
```bash
# Verificar conexión
git remote -v

# O usar SSH si está configurado
git remote set-url origin git@github.com:CMLL1992/macro-dashboard.git
git push origin main
```

### 2. Esperar Deploy en Vercel
- Verificar en Vercel Dashboard que el deploy se complete
- Tiempo estimado: 1-2 minutos después del push

### 3. Ejecutar Job y Verificar
```bash
curl -X POST https://macro-dashboard-seven.vercel.app/api/jobs/correlations \
  -H "Authorization: Bearer cbc3d1139031a75f4721ddb45bf8cca4a79b115d4c15ba83e1a1713898cdbc82" \
  -H "Content-Type: application/json" | jq '.'
```

**Verificar:**
- ✅ `noDataCount` presente
- ✅ `nullCorrelationsCount` presente
- ✅ `nullCorrelations` array con detalles de USDCNH

### 4. Investigar USDCNH

**A) Verificar datos en BD:**
```sql
SELECT COUNT(*) AS n, MIN(date) AS first, MAX(date) AS last
FROM asset_prices
WHERE symbol = 'USDCNH';
```

**B) Revisar logs de Vercel:**
- Buscar `[fetchAssetDaily] USDCNH` en logs
- Ver `source`, `points`, `yahoo_symbol`
- Ver `reasonNull` en logs del job

**C) Si `reasonNull === 'NO_DATA'`:**
- Verificar que el fallback múltiple funcione
- Probar manualmente: `CNH=X`, `CNY=X`, `USDCNH=X` en Yahoo Finance

---

## 📝 Archivos Modificados

1. ✅ `lib/correlations/fetch.ts`
   - Exportado `getYahooSymbol`
   - Fallback múltiple para USDCNH

2. ✅ `app/api/jobs/correlations/route.ts`
   - Separado `errors` de `noDataCount`
   - Añadido tracking de `nullCorrelations`
   - Mejorado logging

3. ✅ `config/tactical-pairs.json`
   - Fallback múltiple para USDCNH

---

## ⚠️ Problema Actual

**Push falla por SSL:**
```
fatal: unable to access 'https://github.com/CMLL1992/macro-dashboard.git/': 
LibreSSL SSL_connect: SSL_ERROR_SYSCALL in connection to github.com:443
```

**Solución temporal:**
- El commit de USDCNH está en local pero no en GitHub
- El primer commit (fixes críticos) SÍ está en GitHub
- Vercel debería desplegar el primer commit automáticamente

**Acción:**
- Reintentar push manualmente cuando la conexión SSL funcione
- O usar SSH si está configurado

---

## ✅ Checklist

- [x] Fixes críticos commiteados y pusheados
- [x] Mejora USDCNH commiteada (local)
- [ ] Mejora USDCNH pusheada (falló SSL)
- [ ] Deploy en Vercel completado
- [ ] Job ejecutado con código nuevo
- [ ] Verificado `noDataCount` y `nullCorrelations`
- [ ] Investigado USDCNH (datos BD, logs, mapeo)
