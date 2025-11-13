#!/bin/bash

# Script simple para iniciar túnel Cloudflare
# Usa cloudflared desde Downloads

echo "=========================================="
echo "  Iniciando túnel Cloudflare"
echo "  Macro Dashboard"
echo "=========================================="
echo ""

# Ruta a cloudflared
CLOUDFLARED_PATH="/Users/carlosmontagutllarch/Downloads/cloudflared"

# Verificar si existe
if [ ! -f "$CLOUDFLARED_PATH" ]; then
    echo "❌ No se encuentra cloudflared en Downloads"
    echo ""
    echo "Por favor, descárgalo de:"
    echo "https://github.com/cloudflare/cloudflared/releases/latest"
    echo ""
    exit 1
fi

# Hacer ejecutable y quitar cuarentena
chmod +x "$CLOUDFLARED_PATH" 2>/dev/null
xattr -d com.apple.quarantine "$CLOUDFLARED_PATH" 2>/dev/null

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
echo "=========================================="
echo "  🌐 INICIANDO TÚNEL"
echo "=========================================="
echo ""
echo "⚠️  IMPORTANTE:"
echo "   - En unos segundos aparecerá una línea que dice:"
echo "     'https://xxxxx.trycloudflare.com'"
echo "   - ESA es la URL que debes compartir"
echo "   - Funciona desde cualquier país"
echo "   - El túnel se cerrará cuando presiones Ctrl+C"
echo ""
echo "=========================================="
echo ""
echo "Esperando URL pública..."
echo ""

# Iniciar cloudflared
"$CLOUDFLARED_PATH" tunnel --url http://localhost:3000

