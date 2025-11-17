#!/bin/bash

# Script para verificar el acceso al servidor desde otros dispositivos
# Macro Dashboard - Verificación de Red

echo "=========================================="
echo "  Verificación de Acceso en Red"
echo "  Macro Dashboard"
echo "=========================================="
echo ""

# Obtener la IP local
echo "📍 Detectando tu IP local..."
LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null)
if [ -z "$LOCAL_IP" ]; then
    LOCAL_IP=$(ipconfig getifaddr en1 2>/dev/null)
fi

if [ -z "$LOCAL_IP" ]; then
    echo "❌ No se pudo detectar la IP local automáticamente."
    echo "   Por favor, verifica tu conexión de red."
    exit 1
fi

echo "✅ IP local detectada: $LOCAL_IP"
echo ""

# Verificar si el servidor está corriendo
echo "🔍 Verificando si el servidor está corriendo..."
PORT_PID=$(lsof -ti:3000 2>/dev/null)

if [ -z "$PORT_PID" ]; then
    echo "⚠️  El servidor NO está corriendo en el puerto 3000"
    echo ""
    echo "   Para iniciarlo, ejecuta:"
    echo "   ./iniciar-servidor.sh"
    echo "   o"
    echo "   pnpm dev"
    echo ""
else
    echo "✅ El servidor está corriendo (PID: $PORT_PID)"
    echo ""
    
    # Verificar si está escuchando en 0.0.0.0
    echo "🔍 Verificando configuración de red..."
    LISTENING=$(lsof -i:3000 -P | grep LISTEN | grep -o "0.0.0.0\|127.0.0.1\|localhost" | head -1)
    
    if [ "$LISTENING" = "0.0.0.0" ] || [ -z "$LISTENING" ]; then
        echo "✅ El servidor está configurado para aceptar conexiones externas"
    else
        echo "⚠️  El servidor solo está escuchando en localhost"
        echo "   Necesitas reiniciarlo con: pnpm dev"
    fi
    echo ""
fi

# Mostrar información de acceso
echo "=========================================="
echo "  📱 INFORMACIÓN DE ACCESO"
echo "=========================================="
echo ""
echo "Desde este Mac:"
echo "   http://localhost:3000"
echo ""
echo "Desde otros dispositivos en la misma red:"
echo "   http://$LOCAL_IP:3000"
echo ""
echo "=========================================="
echo "  🔒 VERIFICACIÓN DE FIREWALL"
echo "=========================================="
echo ""
echo "Si no puedes acceder desde otros dispositivos:"
echo ""
echo "1. Abre 'Preferencias del Sistema' > 'Seguridad y Privacidad'"
echo "2. Ve a la pestaña 'Firewall'"
echo "3. Haz clic en 'Opciones de Firewall...'"
echo "4. Asegúrate de que Node.js tenga permisos para conexiones entrantes"
echo ""
echo "O desactiva temporalmente el firewall para probar:"
echo "   sudo /usr/libexec/ApplicationFirewall/socketfilterfw --setglobalstate off"
echo ""
echo "Para reactivarlo después:"
echo "   sudo /usr/libexec/ApplicationFirewall/socketfilterfw --setglobalstate on"
echo ""
echo "=========================================="
echo "  🧪 PRUEBA RÁPIDA"
echo "=========================================="
echo ""
echo "Para probar desde este Mac si el servidor responde:"
echo "   curl -I http://$LOCAL_IP:3000"
echo ""
echo "¿Quieres ejecutar esta prueba ahora? (s/n)"
read -r respuesta

if [ "$respuesta" = "s" ] || [ "$respuesta" = "S" ]; then
    echo ""
    echo "Ejecutando prueba..."
    curl -I "http://$LOCAL_IP:3000" 2>&1 | head -5
    echo ""
    if [ $? -eq 0 ]; then
        echo "✅ El servidor responde correctamente"
    else
        echo "❌ No se pudo conectar al servidor"
    fi
fi

echo ""
echo "=========================================="
echo "  ✅ Verificación completada"
echo "=========================================="

