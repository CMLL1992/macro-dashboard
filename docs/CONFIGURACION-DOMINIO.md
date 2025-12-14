# 🌐 Configuración de Dominio Propio para CM11 Trading

Esta guía te ayudará a configurar tu dominio personalizado para el dashboard macro en Vercel.

## 📋 Requisitos Previos

- ✅ Proyecto desplegado en Vercel
- ✅ Dominio comprado y acceso al panel DNS del proveedor
- ✅ Variables de entorno configuradas en Vercel

---

## 🎯 Paso 1: Añadir Dominio en Vercel

### 1.1. Acceder a la Configuración de Dominios

1. Ve a [Vercel Dashboard](https://vercel.com/dashboard)
2. Selecciona tu proyecto **CM11 Trading** (o el nombre que tenga)
3. Ve a **Settings** → **Domains**

### 1.2. Añadir Dominio

**Opción A: Dominio Raíz (ej: `mi-dominio.com`)**
- Haz clic en **"Add Domain"**
- Introduce tu dominio: `mi-dominio.com`
- Vercel te mostrará las instrucciones de DNS

**Opción B: Subdominio (ej: `macro.mi-dominio.com`)**
- Haz clic en **"Add Domain"**
- Introduce tu subdominio: `macro.mi-dominio.com`
- Vercel te mostrará las instrucciones de DNS

### 1.3. Anotar Instrucciones de DNS

Vercel te mostrará algo como:

```
Para mi-dominio.com:
  Tipo: A
  Nombre: @
  Valor: 76.76.21.21

Para macro.mi-dominio.com:
  Tipo: CNAME
  Nombre: macro
  Valor: cname.vercel-dns.com
```

**⚠️ IMPORTANTE:** Anota estas instrucciones antes de continuar.

---

## 🔧 Paso 2: Configurar DNS en tu Proveedor

### 2.1. Acceder al Panel DNS

Accede al panel donde gestionas tu dominio (Cloudflare, DonDominio, GoDaddy, Namecheap, etc.)

### 2.2. Configurar Registros DNS

**Para Dominio Raíz (`mi-dominio.com`):**

1. Busca la sección de **DNS Records** o **Zona DNS**
2. Añade un registro **A**:
   - **Nombre/Host:** `@` o deja en blanco (depende del proveedor)
   - **Tipo:** `A`
   - **Valor/IP:** El que te indicó Vercel (ej: `76.76.21.21`)
   - **TTL:** `3600` o automático

**Para Subdominio (`macro.mi-dominio.com`):**

1. Añade un registro **CNAME**:
   - **Nombre/Host:** `macro`
   - **Tipo:** `CNAME`
   - **Valor/Destino:** El que te indicó Vercel (ej: `cname.vercel-dns.com`)
   - **TTL:** `3600` o automático

### 2.3. Guardar Cambios

Guarda los cambios en el panel DNS. La propagación puede tardar:
- **CNAME:** 5-15 minutos
- **A:** 15 minutos - 2 horas

---

## ✅ Paso 3: Verificar en Vercel

### 3.1. Esperar Propagación DNS

1. Vuelve a Vercel → **Settings** → **Domains**
2. Verás el estado de tu dominio:
   - 🟡 **Pending:** Esperando propagación DNS
   - 🟢 **Valid:** Dominio configurado correctamente
   - 🔴 **Invalid:** Error en configuración DNS

### 3.2. Verificar Certificado SSL

Una vez que el dominio esté **Valid**, Vercel emitirá automáticamente un certificado SSL (Let's Encrypt) para HTTPS.

Esto puede tardar 1-5 minutos adicionales.

### 3.3. Probar Acceso

Abre en tu navegador:
- `https://mi-dominio.com` (o `https://macro.mi-dominio.com`)

Deberías ver tu dashboard funcionando con HTTPS.

---

## 🔄 Paso 4: Actualizar APP_URL

### 4.1. Cambiar Variable de Entorno

1. Ve a Vercel → **Settings** → **Environment Variables**
2. Busca `APP_URL`
3. Cambia el valor a tu dominio final:
   - `https://mi-dominio.com` (o `https://macro.mi-dominio.com`)
4. Asegúrate de que está marcada para **Production**
5. Haz clic en **Save**

### 4.2. Redeploy

1. Ve a **Deployments**
2. Haz clic en el menú (⋯) del último deployment
3. Selecciona **Redeploy**
4. Espera a que termine el deployment

**Alternativa:** Haz un pequeño cambio y push a `main` para forzar un nuevo deployment.

---

## 🧪 Paso 5: Verificar Funcionamiento

### 5.1. Probar Endpoints

```bash
# Health check
curl https://mi-dominio.com/api/health

# Diagnóstico
curl https://mi-dominio.com/api/diag
```

### 5.2. Verificar Notificaciones (si están activas)

Si tienes notificaciones de Telegram activadas, verifica que los enlaces en los mensajes usen tu dominio final (no `vercel.app`).

### 5.3. Probar Páginas Principales

Abre en tu navegador:
- `https://mi-dominio.com/dashboard`
- `https://mi-dominio.com/correlaciones`
- `https://mi-dominio.com/sesgos`
- `https://mi-dominio.com/calendario`

---

## 🐛 Solución de Problemas

### Problema: Dominio muestra "Invalid" en Vercel

**Causas comunes:**
- DNS aún no propagado (espera más tiempo)
- Registro DNS incorrecto (verifica tipo, nombre y valor)
- TTL muy alto (espera más tiempo)

**Solución:**
1. Verifica los registros DNS con `dig` o `nslookup`:
   ```bash
   dig mi-dominio.com
   dig macro.mi-dominio.com
   ```
2. Compara con lo que Vercel espera
3. Si está incorrecto, corrige en el panel DNS y espera

### Problema: Certificado SSL no se emite

**Causas comunes:**
- DNS aún no propagado completamente
- Dominio en estado "Pending"

**Solución:**
1. Espera 10-15 minutos después de que el dominio esté "Valid"
2. Si sigue sin funcionar, en Vercel → Domains → haz clic en "Refresh"

### Problema: Redirección a dominio de Vercel

**Causa:** `APP_URL` aún apunta a `vercel.app`

**Solución:**
1. Actualiza `APP_URL` en Vercel a tu dominio final
2. Haz redeploy

### Problema: Errores de CORS o Mixed Content

**Causa:** URLs hardcodeadas usando `http://` o dominio antiguo

**Solución:**
1. Busca en el código referencias a `vercel.app` o `localhost`
2. Reemplázalas por `process.env.APP_URL` o `process.env.NEXT_PUBLIC_API_URL`
3. Haz redeploy

---

## 📝 Checklist Final

- [ ] Dominio añadido en Vercel → Settings → Domains
- [ ] Registros DNS configurados en el proveedor del dominio
- [ ] Dominio muestra estado "Valid" en Vercel
- [ ] Certificado SSL activo (HTTPS funciona)
- [ ] `APP_URL` actualizada en Vercel con el dominio final
- [ ] Redeploy realizado después de cambiar `APP_URL`
- [ ] Dashboard accesible desde `https://mi-dominio.com`
- [ ] Endpoints `/api/health` y `/api/diag` funcionan
- [ ] Notificaciones (si activas) usan el dominio correcto

---

## 🎉 Resultado Final

Una vez completado, tu dashboard será accesible desde:
- ✅ `https://mi-dominio.com` (o `https://macro.mi-dominio.com`)
- ✅ Con certificado SSL válido
- ✅ Funcionando 100% autónomo sin tu ordenador
- ✅ Todos los enlaces y notificaciones usando el dominio correcto

---

## 📚 Referencias

- [Documentación de Vercel sobre Dominios](https://vercel.com/docs/concepts/projects/domains)
- [Guía de DNS de Vercel](https://vercel.com/docs/concepts/projects/domains/add-a-domain)




