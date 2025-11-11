# Cómo acceder al panel de Admin

## 📍 Ubicación

El panel de admin está disponible en: **`http://localhost:3000/admin`**

## 🔧 Configuración necesaria

### 1. Habilitar tests (ya hecho ✅)
```bash
ENABLE_TELEGRAM_TESTS=true
```

### 2. Configurar chat de pruebas

Necesitas obtener tu `TELEGRAM_TEST_CHAT_ID`:

**Opción A: Usar el mismo chat de producción (para pruebas rápidas)**
```bash
TELEGRAM_TEST_CHAT_ID=1156619610  # Mismo que TELEGRAM_CHAT_ID
```

**Opción B: Crear un chat de pruebas separado**
1. Abre Telegram
2. Busca [@userinfobot](https://t.me/userinfobot)
3. Envía `/start`
4. Copia tu `Id` (número)
5. Añádelo a `.env`:
   ```bash
   TELEGRAM_TEST_CHAT_ID=<tu_id>
   ```

### 3. Reiniciar el servidor

Después de cambiar `.env`, reinicia el servidor:
```bash
# Detener el servidor (Ctrl+C)
# Luego reiniciar:
pnpm dev
```

## 🚀 Acceso

### Método 1: Enlace directo
Ve a: **`http://localhost:3000/admin`**

### Método 2: Desde el menú
Si `ENABLE_TELEGRAM_TESTS=true`, verás un enlace **"⚙️ Admin"** en el menú superior.

## ✅ Verificación

Si todo está bien configurado, verás:
- ✅ Banner verde: "Modo TEST activo"
- ✅ Botón "Enviar mensaje de prueba"
- ✅ Simulador de triggers
- ✅ Estado del sistema

Si ves un mensaje amarillo, verifica:
- `ENABLE_TELEGRAM_TESTS=true` en `.env`
- `TELEGRAM_TEST_CHAT_ID` configurado
- Servidor reiniciado después de cambios

## 🔐 Autenticación

Los endpoints requieren `CRON_TOKEN`. Cuando hagas clic en los botones, se te pedirá el token.

Token por defecto: `dev_local_token` (o el que tengas en `CRON_TOKEN`)



