# 📋 Instrucciones para Revisar Logs en Vercel

## 🔍 Pasos para Ver los Logs `[db]`

1. **Ve a Vercel Dashboard:**
   - https://vercel.com → Tu proyecto `macro-dashboard`
   - Click en **"Logs"** (o **"Monitoring"** → **"Logs"**)

2. **Aplicar Filtros:**
   - **Environment:** `Production`
   - **Type:** `Function` o `Serverless / Edge`
   - **Buscar:** `/api/health` o `/api/diag`

3. **Reproducir las Llamadas:**
   - Abre en el navegador o ejecuta:
     ```bash
     curl https://macro-dashboard-seven.vercel.app/api/health
     curl https://macro-dashboard-seven.vercel.app/api/diag
     ```

4. **Buscar en los Logs:**
   - Busca líneas que empiezan con `[db]`
   - Deberías ver algo como:
     ```
     [db] ========================================
     [db] getDB() called - Iniciando apertura de base de datos
     [db] process.cwd(): /var/task
     [db] ========================================
     [db] DETECCIÓN DE ENTORNO:
     [db]   isVercel (por env vars): [true/false]
     [db]   isServerless (por process.cwd()): [true/false]
     [db]   process.cwd(): [path]
     [db]   DATABASE_PATH env: [valor o NOT SET]
     [db] ========================================
     [db] RUTA DE BASE DE DATOS QUE SE VA A USAR:
     [db]   DB_PATH: [path exacto]
     [db] ========================================
     ```

5. **Copia TODAS las líneas `[db]` que aparezcan**

## 📝 Información que Necesito

**Copia y pega aquí:**

1. **Líneas `[db]` de los logs:**
   ```
   [PEGAR AQUÍ todas las líneas [db] completas]
   ```

2. **Respuesta de los endpoints:**
   - `/api/health`: [respuesta completa]
   - `/api/diag`: [respuesta completa]

3. **Errores (si hay):**
   - ¿Aparece `SQLITE_CANTOPEN`?
   - ¿Qué error específico aparece?

---

**Con esta información podremos identificar exactamente qué está pasando y aplicar la solución correcta.**

