#!/bin/bash

# Script para iniciar el servidor de desarrollo del Macro Dashboard
# Ubicación del proyecto
PROJECT_DIR="/Users/carlosmontagutllarch/Desktop/macro-dashboard-with-data"

# Cambiar al directorio del proyecto
cd "$PROJECT_DIR" || exit 1

# Verificar y detener proceso en puerto 3000 si existe
PORT_PID=$(lsof -ti:3000 2>/dev/null)
if [ ! -z "$PORT_PID" ]; then
    echo "Deteniendo proceso en puerto 3000 (PID: $PORT_PID)..."
    kill $PORT_PID 2>/dev/null
    sleep 1
fi

# Abrir una nueva ventana de Terminal y ejecutar el servidor
osascript -e "tell application \"Terminal\"" \
  -e "do script \"cd '$PROJECT_DIR' && pnpm dev\"" \
  -e "end tell"

# Obtener la IP local del Mac
LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "localhost")

# Mensaje de confirmación
osascript -e "display notification \"Servidor iniciando en http://${LOCAL_IP}:3000\" with title \"Macro Dashboard\" subtitle \"Servidor de desarrollo\""

