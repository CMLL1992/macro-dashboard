# 🔧 Instrucciones: Configurar Node 20.x

Este proyecto **requiere Node 20.x** para funcionar correctamente. Node 24.x causará errores con `better-sqlite3`.

---

## ⚠️ Problema Actual

- **Node instalado:** v24.11.0
- **Node requerido:** v20.x
- **Error:** `better-sqlite3` no encuentra los bindings nativos porque están compilados para otra versión de Node.

---

## ✅ Solución: Instalar y Usar Node 20.x

### Opción 1: Usar nvm (Recomendado)

#### Si NO tienes nvm instalado:

```bash
# Instalar nvm con Homebrew
brew install nvm

# Crear directorio para nvm
mkdir -p ~/.nvm

# Configurar nvm en tu shell (zsh)
echo 'export NVM_DIR="$HOME/.nvm"' >> ~/.zshrc
echo '[ -s "/opt/homebrew/opt/nvm/nvm.sh" ] && . "/opt/homebrew/opt/nvm/nvm.sh"' >> ~/.zshrc

# Recargar configuración
source ~/.zshrc
```

#### Si YA tienes nvm instalado:

```bash
# Solo necesitas instalar y usar Node 20
nvm install 20
nvm use 20
```

#### Verificar instalación:

```bash
node -v
# Debe mostrar: v20.x.x

# Verificar que nvm está activo
nvm current
# Debe mostrar: v20.x.x
```

#### Configurar Node 20 como predeterminado para este proyecto:

```bash
# En el directorio del proyecto
nvm use 20

# Crear archivo .nvmrc (ya está creado)
# El archivo .nvmrc contiene: 20
```

**Nota:** Cada vez que entres al proyecto, ejecuta `nvm use` o `nvm use 20` para activar Node 20.

---

### Opción 2: Usar Volta (Alternativa)

```bash
# Instalar Volta
curl https://get.volta.sh | bash

# Cerrar y volver a abrir la terminal

# Instalar Node 20
volta install node@20

# Verificar
node -v
# Debe mostrar: v20.x.x
```

---

## 🔄 Paso 2: Limpiar y Reinstalar Dependencias

Una vez que tengas Node 20 activo:

```bash
# Limpiar dependencias antiguas
rm -rf node_modules .pnpm-store

# Reinstalar con Node 20
pnpm install
```

**Verificar que se compiló correctamente:**

```bash
# Debe compilar better-sqlite3 sin errores
# Busca en la salida algo como:
# "better-sqlite3@12.4.1 build-release" completed successfully
```

---

## ✅ Paso 3: Configurar .env.local con Turso

Asegúrate de que `.env.local` tiene las variables de Turso configuradas:

```bash
TURSO_DATABASE_URL=libsql://tu-db-xxxxx.turso.io
TURSO_AUTH_TOKEN=tu_token_aqui
FRED_API_KEY=tu_fred_api_key
CRON_TOKEN=tu_cron_token
INGEST_KEY=tu_ingest_key
APP_URL=http://localhost:3000
```

**Importante:** Si `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN` están configurados, el proyecto usará Turso automáticamente y NO intentará usar SQLite local.

---

## 🧪 Paso 4: Probar Conexión a Base de Datos

Con Node 20 activo y `.env.local` configurado:

```bash
pnpm test:db
```

**Resultado esperado:**
- ✅ Si Turso está configurado: "Usando Turso: ✅ Sí"
- ✅ Conexión exitosa
- ✅ Esquema inicializado
- ✅ Tablas listadas

---

## 🚀 Paso 5: Levantar Dashboard y Verificar

```bash
# Terminal 1: Levantar servidor
pnpm dev

# Terminal 2: Ejecutar verificación completa
pnpm verify:local
```

**Verificar en navegador:**
- Abre `http://localhost:3000/dashboard`
- Debe cargar sin errores
- Debe mostrar datos reales

---

## 📝 Notas Importantes

1. **Siempre usa Node 20.x en este proyecto**
   - El archivo `.nvmrc` ya está creado con `20`
   - Ejecuta `nvm use` al entrar al proyecto

2. **Si olvidas cambiar a Node 20:**
   - Verás warnings: `Unsupported engine: wanted: {"node":"20.x"}`
   - Los scripts pueden fallar con errores de `better-sqlite3`

3. **Para verificar qué versión de Node estás usando:**
   ```bash
   node -v
   which node
   ```

4. **Si nvm no carga automáticamente:**
   ```bash
   source ~/.nvm/nvm.sh
   nvm use 20
   ```

---

## 🐛 Troubleshooting

### Error: "nvm: command not found"
- Verifica que nvm esté instalado: `brew list nvm`
- Recarga tu shell: `source ~/.zshrc`
- O ejecuta manualmente: `source ~/.nvm/nvm.sh`

### Error: "better-sqlite3 bindings not found" después de cambiar a Node 20
- Limpia y reinstala: `rm -rf node_modules && pnpm install`
- Verifica que estás usando Node 20: `node -v`

### Error: "TURSO_DATABASE_URL not set"
- Verifica que `.env.local` existe y tiene las variables configuradas
- Si no quieres usar Turso, está bien - se usará SQLite local (pero requiere Node 20)

---

## ✅ Checklist Final

- [ ] Node 20.x instalado y activo (`node -v` muestra v20.x.x)
- [ ] Dependencias reinstaladas con Node 20 (`pnpm install` sin errores)
- [ ] `.env.local` configurado con variables necesarias
- [ ] `pnpm test:db` pasa exitosamente
- [ ] `pnpm dev` arranca sin errores
- [ ] `pnpm verify:local` muestra todas las verificaciones en verde

---

**Una vez completado este checklist, el entorno local estará al 100% y podrás proceder a desplegar a Vercel.**


