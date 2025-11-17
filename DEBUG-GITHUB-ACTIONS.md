# 🔍 Debug: Errores en GitHub Actions

## 📋 Pasos para Ver el Error Exacto

### Paso 1: Ver los Logs del Workflow

1. **Ve a GitHub:**
   - https://github.com/CMLL1992/macro-dashboard
   - Click en **"Actions"** (pestaña superior)

2. **Busca el workflow que falló:**
   - "News & Calendar Ingest" (si es el que falla)
   - O "Test Notifications" (si es ese)

3. **Click en el workflow fallido** (ej: "News & Calendar Ingest #25")

4. **Click en el job que falló:**
   - "Ingest News from RSS" (si es ese)
   - O "Ingest Calendar from FRED" (si es ese)

5. **Expande el step que falló:**
   - Busca el step "Run news ingestion script" o similar
   - Click para expandir y ver los logs completos

6. **Copia el error completo** (las últimas 20-30 líneas)

---

## 🔍 Errores Comunes y Soluciones

### Error 1: "Cannot find module" o "Module not found"

**Causa:** Dependencias no instaladas correctamente

**Solución:**
- Verifica que `pnpm install --frozen-lockfile` se ejecute correctamente
- Puede ser que falte alguna dependencia en `package.json`

### Error 2: "APP_URL is not defined" o "INGEST_KEY is not defined"

**Causa:** Secrets no están configurados o no se pasan correctamente

**Solución:**
- Verifica que los secrets existan en GitHub
- Verifica que los nombres sean exactos (case-sensitive)
- Verifica que el workflow use `${{ secrets.APP_URL }}` (no `$APP_URL`)

### Error 3: "Network error" o "Failed to fetch"

**Causa:** La URL de Vercel no responde o está mal configurada

**Solución:**
- Verifica que `APP_URL` sea la URL correcta de Vercel
- Verifica que la URL no tenga trailing slash: `https://macro-dashboard-seven.vercel.app` (no `https://macro-dashboard-seven.vercel.app/`)
- Prueba la URL manualmente en el navegador

### Error 4: "401 Unauthorized" o "403 Forbidden"

**Causa:** `INGEST_KEY` o `CRON_TOKEN` incorrectos

**Solución:**
- Verifica que el valor del secret sea exactamente el mismo que en Vercel
- Verifica que no haya espacios extra al copiar/pegar
- Verifica que el endpoint requiera autenticación y la esté enviando correctamente

### Error 5: "tsx: command not found"

**Causa:** `tsx` no está instalado o no está en el PATH

**Solución:**
- Verifica que `tsx` esté en `package.json` como dependencia
- Puede ser que necesite instalarse globalmente o que el script use `pnpm tsx` en lugar de solo `tsx`

### Error 6: "Script failed with exit code 1"

**Causa:** El script tiene un error en tiempo de ejecución

**Solución:**
- Revisa los logs completos para ver el error específico
- Puede ser un error en el código del script
- Puede ser que falte alguna variable de entorno

---

## 🔧 Soluciones Rápidas

### Solución 1: Agregar Debug al Workflow

Agrega estos pasos antes del step que falla para ver qué valores tienen los secrets:

```yaml
- name: Debug secrets
  run: |
    echo "APP_URL is set: $([ -n "$APP_URL" ] && echo 'YES' || echo 'NO')"
    echo "INGEST_KEY is set: $([ -n "$INGEST_KEY" ] && echo 'YES' || echo 'NO')"
    echo "FRED_API_KEY is set: $([ -n "$FRED_API_KEY" ] && echo 'YES' || echo 'NO')"
  env:
    APP_URL: ${{ secrets.APP_URL }}
    INGEST_KEY: ${{ secrets.INGEST_KEY }}
    FRED_API_KEY: ${{ secrets.FRED_API_KEY }}
```

### Solución 2: Verificar que los Scripts Existen

Agrega un step para verificar:

```yaml
- name: Verify scripts exist
  run: |
    ls -la scripts/ingest-news-rss.ts
    ls -la scripts/ingest-calendar-fred.ts
```

### Solución 3: Ejecutar Script con Más Verbosidad

Modifica el step para ver más detalles:

```yaml
- name: Run news ingestion script
  run: |
    echo "🔄 Ingestando noticias desde RSS feeds..."
    pnpm tsx scripts/ingest-news-rss.ts 2>&1 | tee ingest.log
    cat ingest.log
  env:
    APP_URL: ${{ secrets.APP_URL }}
    INGEST_KEY: ${{ secrets.INGEST_KEY }}
```

---

## 📝 Qué Información Necesito

Para ayudarte mejor, necesito:

1. **El error exacto** (copia las últimas 20-30 líneas de los logs)
2. **Qué workflow falla** (News & Calendar Ingest o Test Notifications)
3. **Qué step falla** (Ingest News, Ingest Calendar, etc.)
4. **Screenshot o texto del error** completo

---

## 🚨 Si Nada Funciona

Si después de verificar todo sigue fallando:

1. **Desactiva temporalmente el workflow:**
   - Renombra el archivo `.yml` a `.yml.disabled`
   - O comenta el contenido del workflow

2. **O configura `continue-on-error: true`:**
   - Esto hará que el workflow no marque como fallido
   - Pero seguirá intentando ejecutarse

3. **Los errores en GitHub Actions NO afectan el dashboard en Vercel**
   - El dashboard seguirá funcionando normalmente
   - Solo afectan los pipelines automáticos de ingesta

---

**Nota:** Comparte el error exacto de los logs para poder darte una solución más específica.



