#!/bin/bash

# Script para iniciar un túnel ngrok para acceso remoto
# Macro Dashboard - Túnel ngrok

echo "=========================================="
echo "  Iniciando túnel ngrok"
echo "  Macro Dashboard"
echo "=========================================="
echo ""

# Verificar si ngrok está instalado
if ! command -v ngrok &> /dev/null; then
    echo "❌ ngrok no está instalado."
    echo ""
    echo "Para instalarlo:"
    echo "  1. Visita: https://ngrok.com/download"
    echo "  2. O instala con Homebrew:"
    echo "     brew install ngrok/ngrok/ngrok"
    echo ""
    echo "Después de instalar, necesitas:"
    echo "  1. Crear una cuenta en https://ngrok.com (gratis)"
    echo "  2. Obtener tu authtoken de: https://dashboard.ngrok.com/get-started/your-authtoken"
    echo "  3. Configurarlo con: ngrok config add-authtoken TU_TOKEN"
    echo ""
    exit 1
fi

# Verificar si el servidor está corriendo
PORT_PID=$(lsof -ti:3000 2>/dev/null)
if [ -z "$PORT_PID" ]; then
    echo "⚠️  El servidor NO está corriendo en el puerto 3000"
    echo ""
    echo "¿Quieres iniciarlo ahora? (s/n)"
    read -r respuesta
    if [ "$respuesta" = "s" ] || [ "$respuesta" = "S" ]; then
        echo "Iniciando servidor..."
        ./iniciar-servidor.sh
        sleep 3
    else
        echo "Por favor, inicia el servidor primero con: ./iniciar-servidor.sh"
        exit 1
    fi
fi

echo "✅ Servidor detectado en puerto 3000"
echo ""
echo "Iniciando túnel ngrok..."
echo ""
echo "⚠️  IMPORTANTE:"
echo "   - La URL pública aparecerá en la terminal"
echo "   - Comparte esa URL con quien necesite acceder"
echo "   - El túnel se cerrará cuando cierres esta terminal"
echo ""
echo "Presiona Ctrl+C para detener el túnel"
echo ""
echo "=========================================="
echo ""

# Iniciar ngrok
ngrok http 3000

