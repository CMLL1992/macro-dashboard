# Acceso Remoto al Dashboard

Este documento explica cómo acceder al dashboard desde cualquier lugar del mundo.

## Opciones Disponibles

### 1. Cloudflare Tunnel (Recomendado - Gratis)

**Ventajas:**
- ✅ Completamente gratis
- ✅ Sin límites de tiempo o ancho de banda
- ✅ Sin necesidad de cuenta (modo quick tunnel)
- ✅ Fácil de usar

**Cómo usar:**

1. Instalar cloudflared:
```bash
brew install cloudflare/cloudflare/cloudflared
```

2. Asegúrate de que el servidor esté corriendo:
```bash
./iniciar-servidor.sh
```

3. Iniciar el túnel:
```bash
./iniciar-tunel-cloudflare.sh
```

4. Copiar la URL que aparece (algo como: `https://xxxxx.trycloudflare.com`)

5. Compartir esa URL con quien necesite acceder

---

### 2. ngrok (Alternativa)

**Ventajas:**
- ✅ Muy popular y estable
- ✅ Interfaz web para monitoreo

**Desventajas:**
- ⚠️ Plan gratuito tiene límites (40 conexiones/minuto)
- ⚠️ Requiere cuenta y authtoken

**Cómo usar:**

1. Instalar ngrok:
```bash
brew install ngrok/ngrok/ngrok
```

2. Crear cuenta en https://ngrok.com (gratis)

3. Obtener authtoken de: https://dashboard.ngrok.com/get-started/your-authtoken

4. Configurar:
```bash
ngrok config add-authtoken TU_TOKEN_AQUI
```

5. Asegúrate de que el servidor esté corriendo:
```bash
./iniciar-servidor.sh
```

6. Iniciar el túnel:
```bash
./iniciar-tunel-ngrok.sh
```

7. Copiar la URL que aparece (algo como: `https://xxxxx.ngrok.io`)

---

### 3. Deploy a Producción (Vercel)

Si quieres una solución permanente, puedes desplegar a Vercel:

1. Conecta tu repositorio a Vercel
2. Configura las variables de entorno
3. Deploy automático

Ver documentación en: `docs/VERCEL_DEPLOY_CHECKLIST.md`

---

## Comparación Rápida

| Característica | Cloudflare Tunnel | ngrok | Vercel |
|---------------|-------------------|-------|--------|
| Costo | Gratis | Gratis (con límites) | Gratis (hobby) |
| Límites | Ninguno | 40 conn/min | Generoso |
| Configuración | Mínima | Requiere cuenta | Requiere setup |
| Permanencia | Temporal | Temporal | Permanente |
| Mejor para | Desarrollo/Testing | Desarrollo | Producción |

---

## Seguridad

⚠️ **IMPORTANTE**: Los túneles exponen tu servidor local a internet.

- Solo úsalos para desarrollo/testing
- No compartas las URLs públicamente
- Las URLs cambian cada vez que reinicias el túnel (excepto con ngrok plan pago)
- Para producción, usa un deploy adecuado (Vercel, etc.)

---

## Solución de Problemas

### El túnel no conecta
- Verifica que el servidor esté corriendo: `lsof -ti:3000`
- Verifica que el servidor escuche en 0.0.0.0 (ya configurado en package.json)

### La URL no funciona desde otro país
- Espera unos segundos después de iniciar el túnel
- Verifica que copiaste la URL completa (con https://)
- Prueba desde un navegador en modo incógnito

### El túnel se cierra solo
- Es normal si cierras la terminal
- Para mantenerlo activo, usa `screen` o `tmux`:
```bash
screen -S tunnel
./iniciar-tunel-cloudflare.sh
# Presiona Ctrl+A luego D para detach
# Para volver: screen -r tunnel
```

