#!/bin/bash

# Script para crear una aplicación de macOS para iniciar el servidor
APP_NAME="Macro Dashboard"
APP_DIR="$HOME/Desktop/${APP_NAME}.app"
PROJECT_DIR="/Users/carlosmontagutllarch/Desktop/macro-dashboard-with-data"

# Crear estructura de la aplicación
mkdir -p "${APP_DIR}/Contents/MacOS"
mkdir -p "${APP_DIR}/Contents/Resources"

# Crear el script ejecutable
cat > "${APP_DIR}/Contents/MacOS/${APP_NAME}" << 'EOF'
#!/bin/bash
PROJECT_DIR="/Users/carlosmontagutllarch/Desktop/macro-dashboard-with-data"
cd "$PROJECT_DIR" || exit 1

# Verificar y detener proceso en puerto 3000 si existe
PORT_PID=$(lsof -ti:3000 2>/dev/null)
if [ ! -z "$PORT_PID" ]; then
    kill $PORT_PID 2>/dev/null
    sleep 1
fi

# Abrir Terminal y ejecutar el servidor
osascript <<APPLESCRIPT
tell application "Terminal"
    activate
    do script "cd '$PROJECT_DIR' && pnpm dev"
end tell

display notification "Servidor iniciando en http://localhost:3000" with title "Macro Dashboard" subtitle "Servidor de desarrollo"
APPLESCRIPT
EOF

# Hacer ejecutable
chmod +x "${APP_DIR}/Contents/MacOS/${APP_NAME}"

# Crear Info.plist
cat > "${APP_DIR}/Contents/Info.plist" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>${APP_NAME}</string>
    <key>CFBundleIdentifier</key>
    <string>com.macrodashboard.dev</string>
    <key>CFBundleName</key>
    <string>${APP_NAME}</string>
    <key>CFBundleVersion</key>
    <string>1.0</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
</dict>
</plist>
EOF

echo "✅ Aplicación creada en: ${APP_DIR}"
echo "📱 Puedes moverla al escritorio o a Aplicaciones"

