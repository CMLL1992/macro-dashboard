# 🔐 Variables de Entorno para Vercel

## Variables OBLIGATORIAS

### 1. FRED_API_KEY
**Valor:**
```
ccc90330e6a50afa217fb55ac48c4d28
```

**Descripción:** Clave de API de FRED (Federal Reserve Economic Data) para obtener datos macroeconómicos.

**Entornos:** Production, Preview, Development

---

### 2. INGEST_KEY
**Valor generado:**
```
cbc3d1139031a75f4721ddb45bf8cca4a79b115d4c15ba83e1a1713898cdbc82
```

**Descripción:** Clave secreta para proteger los endpoints de ingesta (news, calendar, weekly jobs). **OBLIGATORIO en producción.**

**Entornos:** Production, Preview, Development

---

### 3. CRON_TOKEN
**Valor generado:**
```
[GENERAR NUEVO - ver abajo]
```

**Descripción:** Token para proteger los endpoints de jobs (`/api/jobs/*`). Usado por GitHub Actions y jobs automatizados.

**Entornos:** Production, Preview, Development

**Nota:** Si no tienes uno, puedes usar el mismo valor que `INGEST_KEY` o generar uno nuevo.

---

## Variables OPCIONALES

### 4. APP_URL
**Valor:**
```
https://tu-app.vercel.app
```

**Descripción:** URL base de tu aplicación en Vercel. Se usa para jobs automatizados y callbacks.

**Entornos:** Production (obligatorio), Preview, Development (opcional, usa localhost)

**Nota:** Reemplaza `tu-app` con el nombre real de tu proyecto en Vercel.

---

### 5. TELEGRAM_BOT_TOKEN
**Valor:**
```
[OPCIONAL - solo si usas notificaciones Telegram]
```

**Descripción:** Token del bot de Telegram para enviar notificaciones.

**Entornos:** Production, Preview, Development (opcional)

---

### 6. TELEGRAM_TEST_CHAT_ID
**Valor:**
```
[OPCIONAL - solo si usas notificaciones Telegram]
```

**Descripción:** ID del chat de Telegram para pruebas.

**Entornos:** Production, Preview, Development (opcional)

---

## 📋 Instrucciones para Añadir en Vercel

1. Ve a **Vercel Dashboard** → Tu proyecto → **Settings** → **Environment Variables**

2. Añade cada variable:
   - **Name:** `FRED_API_KEY`
   - **Value:** `ccc90330e6a50afa217fb55ac48c4d28`
   - **Environments:** ✅ Production, ✅ Preview, ✅ Development
   - Click **Save**

3. Repite para cada variable obligatoria:
   - `INGEST_KEY` → `cbc3d1139031a75f4721ddb45bf8cca4a79b115d4c15ba83e1a1713898cdbc82`
   - `CRON_TOKEN` → [generar nuevo o usar el mismo que INGEST_KEY]
   - `APP_URL` → `https://tu-app.vercel.app` (ajustar nombre real)

4. Para variables opcionales (Telegram), añádelas solo si las vas a usar.

5. **Redeploy** después de añadir variables para que surtan efecto.

---

## 🔒 Seguridad

- ✅ **NUNCA** expongas estas claves en el código del cliente
- ✅ **NUNCA** las subas a Git (ya están en `.gitignore`)
- ✅ Rota las claves periódicamente (cada 3-6 meses)
- ✅ Usa valores diferentes para Production y Development si es posible

---

## 🧪 Verificación

Después de añadir las variables, puedes verificar que están cargadas:

1. Ve a tu deployment en Vercel
2. Revisa los Build Logs - no debe aparecer `api_key=undefined`
3. Prueba un endpoint protegido (debe funcionar con autenticación)

---

**Última actualización:** 2025-11-11

