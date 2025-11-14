# 🔍 Debug: Endpoint Sin Respuesta

## 📊 Problema

El endpoint `/api/health` no está respondiendo (curl recibe 0 bytes).

## 🔍 Diagnóstico Paso a Paso

### 1. Probar con más verbosidad

```bash
# Probar sin jq para ver la respuesta completa
curl -v https://macro-dashboard-seven.vercel.app/api/health

# O con timeout más largo
curl --max-time 30 https://macro-dashboard-seven.vercel.app/api/health
```

### 2. Verificar Estado del Deployment

1. **Ve a Vercel Dashboard:**
   - Verifica que el deployment esté en estado "Ready" (verde)
   - Si está en "Building" o "Error", espera a que termine

2. **Verifica la URL:**
   - Asegúrate de que la URL sea correcta
   - Puede haber cambiado después del redeploy

### 3. Revisar Logs en Vercel

1. **Ve a Vercel → Logs:**
   - Filtra: Environment: Production
   - Buscar: `/api/health`
   - Reproduce el error (haz curl de nuevo)
   - Revisa los logs más recientes

**Qué buscar:**
- Errores de inicialización de BD
- Timeouts
- Errores de runtime

### 4. Probar Otros Endpoints

```bash
# Probar endpoint que NO usa BD
curl https://macro-dashboard-seven.vercel.app/api/diag

# Probar endpoint de FRED (tampoco usa BD)
curl "https://macro-dashboard-seven.vercel.app/api/fred/CPIAUCSL?observation_start=2024-01-01"
```

**Interpretación:**
- Si `/api/diag` funciona → El problema es específico de `/api/health` o de la BD
- Si `/api/diag` NO funciona → El problema es más general (deployment, configuración, etc.)

## 🚨 Posibles Causas

### 1. Timeout en Inicialización de BD

**Síntoma:** El endpoint tarda mucho en responder o no responde

**Causa:** La inicialización de la BD en `/tmp` puede estar tardando demasiado

**Solución:** Verificar logs de Vercel para ver si hay errores de BD

### 2. Deployment No Completado

**Síntoma:** El endpoint no responde

**Causa:** El deployment puede no estar completamente listo

**Solución:** Esperar unos minutos más o verificar estado en Vercel

### 3. Error en Runtime

**Síntoma:** El endpoint no responde

**Causa:** Hay un error que está causando que la función se cuelgue

**Solución:** Revisar logs de Vercel para ver el error específico

### 4. Problema con NODE_ENV

**Síntoma:** El path de BD puede estar incorrecto

**Causa:** `NODE_ENV` puede no estar configurado correctamente en Vercel

**Solución:** Verificar variables de entorno en Vercel

## 🔧 Soluciones Rápidas

### Opción 1: Verificar Variables de Entorno

1. Ve a Vercel → Settings → Environment Variables
2. Verifica que `NODE_ENV` esté configurado (o que Vercel lo configure automáticamente)
3. Si no está, añade: `NODE_ENV=production`

### Opción 2: Verificar Logs Detallados

1. Ve a Vercel → Logs
2. Filtra por `/api/health`
3. Haz curl de nuevo
4. Revisa los logs más recientes
5. Busca errores específicos

### Opción 3: Probar Endpoint Simplificado

Si el problema persiste, podemos temporalmente usar la versión simplificada de `/api/health` que no toca la BD para verificar que el problema es específico de la BD.

## 📋 Checklist

- [ ] Deployment está en estado "Ready" (verde)
- [ ] Probar con `curl -v` para ver detalles
- [ ] Revisar logs de Vercel
- [ ] Probar `/api/diag` para comparar
- [ ] Verificar variables de entorno en Vercel
- [ ] Verificar que `NODE_ENV` esté configurado

---

**Última actualización:** $(date +"%d/%m/%Y %H:%M")

