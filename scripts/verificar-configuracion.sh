#!/bin/bash

# Script para verificar la configuración de Telegram y Pipeline de Noticias
# Ejecutar: bash scripts/verificar-configuracion.sh

echo "🔍 Verificando configuración de CM11 Trading..."
echo ""

# Colores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Verificar variables de entorno locales
echo "📋 Variables de Entorno Locales:"
echo ""

if [ -f .env.local ]; then
    echo "✅ .env.local encontrado"
    
    # Telegram
    if grep -q "TELEGRAM_BOT_TOKEN" .env.local; then
        TOKEN=$(grep "TELEGRAM_BOT_TOKEN" .env.local | cut -d '=' -f2 | tr -d ' ')
        if [ -n "$TOKEN" ]; then
            echo -e "${GREEN}✅ TELEGRAM_BOT_TOKEN configurado${NC}"
        else
            echo -e "${RED}❌ TELEGRAM_BOT_TOKEN vacío${NC}"
        fi
    else
        echo -e "${RED}❌ TELEGRAM_BOT_TOKEN no encontrado${NC}"
    fi
    
    if grep -q "TELEGRAM_CHAT_ID" .env.local; then
        CHAT_ID=$(grep "TELEGRAM_CHAT_ID" .env.local | cut -d '=' -f2 | tr -d ' ')
        if [ -n "$CHAT_ID" ]; then
            echo -e "${GREEN}✅ TELEGRAM_CHAT_ID configurado${NC}"
        else
            echo -e "${RED}❌ TELEGRAM_CHAT_ID vacío${NC}"
        fi
    else
        echo -e "${RED}❌ TELEGRAM_CHAT_ID no encontrado${NC}"
    fi
    
    if grep -q "ENABLE_TELEGRAM_NOTIFICATIONS=true" .env.local; then
        echo -e "${GREEN}✅ ENABLE_TELEGRAM_NOTIFICATIONS=true${NC}"
    else
        echo -e "${YELLOW}⚠️  ENABLE_TELEGRAM_NOTIFICATIONS no está en true${NC}"
    fi
    
    # INGEST_KEY
    if grep -q "INGEST_KEY" .env.local; then
        INGEST_KEY=$(grep "INGEST_KEY" .env.local | cut -d '=' -f2 | tr -d ' ')
        if [ -n "$INGEST_KEY" ]; then
            echo -e "${GREEN}✅ INGEST_KEY configurado${NC}"
        else
            echo -e "${RED}❌ INGEST_KEY vacío${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  INGEST_KEY no encontrado (necesario para producción)${NC}"
    fi
    
    # FRED_API_KEY
    if grep -q "FRED_API_KEY" .env.local; then
        FRED_KEY=$(grep "FRED_API_KEY" .env.local | cut -d '=' -f2 | tr -d ' ')
        if [ -n "$FRED_KEY" ]; then
            echo -e "${GREEN}✅ FRED_API_KEY configurado${NC}"
        else
            echo -e "${YELLOW}⚠️  FRED_API_KEY vacío (opcional pero recomendado)${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  FRED_API_KEY no encontrado (opcional)${NC}"
    fi
    
    # APP_URL
    if grep -q "APP_URL" .env.local; then
        APP_URL=$(grep "APP_URL" .env.local | cut -d '=' -f2 | tr -d ' ')
        if [ -n "$APP_URL" ]; then
            echo -e "${GREEN}✅ APP_URL configurado: ${APP_URL}${NC}"
        else
            echo -e "${RED}❌ APP_URL vacío${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  APP_URL no encontrado (usará http://localhost:3000 por defecto)${NC}"
    fi
else
    echo -e "${RED}❌ .env.local no encontrado${NC}"
    echo "   Crea un archivo .env.local con las variables necesarias"
fi

echo ""
echo "📋 Verificación de GitHub Secrets:"
echo ""
echo "Para verificar los secrets en GitHub:"
echo "1. Ve a: https://github.com/CMLL1992/macro-dashboard/settings/secrets/actions"
echo "2. Verifica que existan:"
echo "   - APP_URL"
echo "   - INGEST_KEY"
echo "   - FRED_API_KEY (opcional)"
echo ""

echo "📋 Verificación de Vercel Environment Variables:"
echo ""
echo "Para verificar las variables en Vercel:"
echo "1. Ve a: https://vercel.com/dashboard"
echo "2. Selecciona tu proyecto"
echo "3. Settings → Environment Variables"
echo "4. Verifica que existan:"
echo "   - TELEGRAM_BOT_TOKEN"
echo "   - TELEGRAM_CHAT_ID"
echo "   - ENABLE_TELEGRAM_NOTIFICATIONS"
echo "   - INGEST_KEY"
echo ""

echo "🧪 Pruebas:"
echo ""
echo "Para probar Telegram localmente:"
echo "  pnpm tsx scripts/verify-notifications.ts"
echo ""
echo "Para probar el pipeline de noticias localmente:"
echo "  APP_URL=https://macro-dashboard-seven.vercel.app INGEST_KEY=tu_key pnpm tsx scripts/ingest-news-rss.ts"
echo ""

echo "✅ Verificación completada"
echo ""
echo "📖 Para más información, consulta: GUIA-ACTIVACION-COMPLETA.md"





