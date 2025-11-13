#!/bin/bash

# Script para iniciar un túnel Cloudflare (gratis, sin límites)
# Macro Dashboard - Cloudflare Tunnel

echo "=========================================="
echo "  Iniciando túnel Cloudflare"
echo "  Macro Dashboard"
echo "=========================================="
echo ""

# Verificar si cloudflared está instalado
if ! command -v cloudflared &> /dev/null; then
    echo "❌ cloudflared no está instalado."
    echo ""
    echo "Para instalarlo con Homebrew:"
    echo "  brew install cloudflare/cloudflare/cloudflared"
    echo ""
    echo "O descárgalo de: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/"
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
echo "Iniciando túnel Cloudflare..."
echo ""
echo "⚠️  IMPORTANTE:"
echo "   - La URL pública aparecerá en la terminal"
echo "   - Comparte esa URL con quien necesite acceder"
echo "   - El túnel se cerrará cuando cierres esta terminal"
echo "   - Cloudflare Tunnel es GRATIS y sin límites"
echo ""
echo "Presiona Ctrl+C para detener el túnel"
echo ""
echo "=========================================="
echo ""

# Iniciar cloudflared
cloudflared tunnel --url http://localhost:3000

