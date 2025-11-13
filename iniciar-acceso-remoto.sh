#!/bin/bash

# Script principal para iniciar acceso remoto
# Macro Dashboard - Acceso desde cualquier lugar

echo "=========================================="
echo "  Acceso Remoto al Dashboard"
echo "  Macro Dashboard"
echo "=========================================="
echo ""

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
        sleep 5
    else
        echo "Por favor, inicia el servidor primero con: ./iniciar-servidor.sh"
        exit 1
    fi
fi

echo "✅ Servidor detectado en puerto 3000"
echo ""

# Verificar cloudflared
if command -v cloudflared &> /dev/null; then
    echo "✅ Cloudflare Tunnel detectado"
    echo ""
    echo "Iniciando túnel Cloudflare..."
    echo ""
    echo "⚠️  IMPORTANTE:"
    echo "   - La URL pública aparecerá en unos segundos"
    echo "   - Comparte esa URL con quien necesite acceder (funciona desde cualquier país)"
    echo "   - El túnel se cerrará cuando cierres esta terminal"
    echo ""
    echo "Presiona Ctrl+C para detener el túnel"
    echo ""
    echo "=========================================="
    echo ""
    
    cloudflared tunnel --url http://localhost:3000
    exit 0
fi

# Verificar ngrok
if command -v ngrok &> /dev/null; then
    echo "✅ ngrok detectado"
    echo ""
    echo "Iniciando túnel ngrok..."
    echo ""
    echo "⚠️  IMPORTANTE:"
    echo "   - La URL pública aparecerá en unos segundos"
    echo "   - Comparte esa URL con quien necesite acceder (funciona desde cualquier país)"
    echo "   - El túnel se cerrará cuando cierres esta terminal"
    echo ""
    echo "Presiona Ctrl+C para detener el túnel"
    echo ""
    echo "=========================================="
    echo ""
    
    ngrok http 3000
    exit 0
fi

# Si no hay ninguna herramienta instalada
echo "❌ No se encontró ninguna herramienta de túnel instalada"
echo ""
echo "=========================================="
echo "  OPCIONES DE INSTALACIÓN"
echo "=========================================="
echo ""
echo "OPCIÓN 1: Cloudflare Tunnel (Recomendado - Gratis, sin límites)"
echo ""
echo "  1. Descarga desde: https://github.com/cloudflare/cloudflared/releases"
echo "     Busca: cloudflared-darwin-amd64 (para Mac Intel)"
echo "     O: cloudflared-darwin-arm64 (para Mac M1/M2/M3)"
echo ""
echo "  2. Extrae el archivo y muévelo a /usr/local/bin:"
echo "     sudo mv cloudflared /usr/local/bin/"
echo "     sudo chmod +x /usr/local/bin/cloudflared"
echo ""
echo "  3. O si tienes Homebrew:"
echo "     brew install cloudflare/cloudflare/cloudflared"
echo ""
echo "OPCIÓN 2: ngrok"
echo ""
echo "  1. Descarga desde: https://ngrok.com/download"
echo "  2. Extrae y mueve a /usr/local/bin"
echo "  3. Crea cuenta en https://ngrok.com"
echo "  4. Configura: ngrok config add-authtoken TU_TOKEN"
echo ""
echo "=========================================="
echo ""
echo "Después de instalar, ejecuta este script nuevamente:"
echo "  ./iniciar-acceso-remoto.sh"
echo ""

