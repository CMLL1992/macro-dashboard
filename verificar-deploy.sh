#!/bin/bash

# Script para verificar el deployment en Vercel
# Macro Dashboard - Verificación de Deploy

echo "=========================================="
echo "  Verificación de Deploy en Vercel"
echo "  Macro Dashboard"
echo "=========================================="
echo ""

# Solicitar la URL de Vercel
echo "📋 Para verificar tu deployment, necesito la URL de tu proyecto en Vercel."
echo ""
echo "La URL debería ser algo como:"
echo "   https://macro-dashboard-xxxxx.vercel.app"
echo "   o"
echo "   https://tu-proyecto.vercel.app"
echo ""
read -p "Introduce la URL de tu proyecto en Vercel: " VERCEL_URL

# Limpiar la URL (quitar espacios, etc.)
VERCEL_URL=$(echo "$VERCEL_URL" | tr -d ' ')

# Verificar que la URL tiene el formato correcto
if [[ ! "$VERCEL_URL" =~ ^https?:// ]]; then
    echo ""
    echo "⚠️  La URL debe empezar con http:// o https://"
    echo "   Añadiendo https:// automáticamente..."
    VERCEL_URL="https://$VERCEL_URL"
fi

echo ""
echo "=========================================="
echo "  🔍 Verificando: $VERCEL_URL"
echo "=========================================="
echo ""

# Verificar que la URL responde
echo "1️⃣  Verificando conectividad..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$VERCEL_URL" 2>/dev/null)

if [ "$HTTP_CODE" = "000" ]; then
    echo "❌ No se pudo conectar a la URL"
    echo "   Verifica que la URL es correcta"
    exit 1
elif [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "307" ] || [ "$HTTP_CODE" = "301" ] || [ "$HTTP_CODE" = "302" ]; then
    echo "✅ La URL responde correctamente (HTTP $HTTP_CODE)"
else
    echo "⚠️  La URL responde con código HTTP $HTTP_CODE"
fi

echo ""

# Verificar página principal
echo "2️⃣  Verificando página principal..."
MAIN_RESPONSE=$(curl -s -L --max-time 10 "$VERCEL_URL" 2>/dev/null | head -20)

if echo "$MAIN_RESPONSE" | grep -q "html\|<!DOCTYPE\|<html" 2>/dev/null; then
    echo "✅ La página principal carga correctamente"
else
    echo "⚠️  No se detectó contenido HTML en la respuesta"
fi

echo ""

# Verificar dashboard
echo "3️⃣  Verificando dashboard..."
DASHBOARD_URL="${VERCEL_URL}/dashboard"
DASHBOARD_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$DASHBOARD_URL" 2>/dev/null)

if [ "$DASHBOARD_CODE" = "200" ] || [ "$DASHBOARD_CODE" = "307" ]; then
    echo "✅ El dashboard está accesible (HTTP $DASHBOARD_CODE)"
else
    echo "⚠️  El dashboard responde con código HTTP $DASHBOARD_CODE"
fi

echo ""

# Verificar API health
echo "4️⃣  Verificando API health..."
HEALTH_URL="${VERCEL_URL}/api/health"
HEALTH_RESPONSE=$(curl -s --max-time 10 "$HEALTH_URL" 2>/dev/null)

if [ ! -z "$HEALTH_RESPONSE" ]; then
    echo "✅ La API responde: $HEALTH_RESPONSE"
else
    echo "⚠️  La API no responde o no existe el endpoint /api/health"
fi

echo ""
echo "=========================================="
echo "  📊 RESUMEN"
echo "=========================================="
echo ""
echo "URL Pública: $VERCEL_URL"
echo ""
echo "✅ Esta URL funciona desde:"
echo "   - Cualquier dispositivo en cualquier país"
echo "   - Incluso con tu Mac cerrado"
echo "   - 24/7 (siempre que Vercel esté activo)"
echo ""
echo "🔗 Enlaces importantes:"
echo "   - Página principal: $VERCEL_URL"
echo "   - Dashboard: $VERCEL_URL/dashboard"
echo "   - Narrativas: $VERCEL_URL/narrativas"
echo ""
echo "=========================================="
echo "  ✅ Verificación completada"
echo "=========================================="

