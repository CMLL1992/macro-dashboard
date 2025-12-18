#!/bin/bash

# Script para verificar configuración de Turso entre local y Vercel

echo "=== Verificación de Base de Datos Turso ==="
echo ""

# Verificar .env.local
echo "📋 Configuración Local (.env.local):"
if [ -f .env.local ]; then
  TURSO_URL_LOCAL=$(grep "^TURSO_DATABASE_URL=" .env.local | cut -d'=' -f2)
  TURSO_TOKEN_LOCAL=$(grep "^TURSO_AUTH_TOKEN=" .env.local | cut -d'=' -f2)
  
  if [ -n "$TURSO_URL_LOCAL" ]; then
    echo "  ✅ TURSO_DATABASE_URL: $TURSO_URL_LOCAL"
    echo "  ✅ TURSO_AUTH_TOKEN: ${#TURSO_TOKEN_LOCAL} caracteres"
  else
    echo "  ❌ TURSO_DATABASE_URL: NO CONFIGURADO"
  fi
else
  echo "  ❌ .env.local no existe"
fi

echo ""
echo "📋 Valores esperados (de VALORES-TURSO.md):"
TURSO_URL_EXPECTED="libsql://macro-dashboard-cmll1992.aws-eu-west-1.turso.io"
echo "  TURSO_DATABASE_URL esperado: $TURSO_URL_EXPECTED"

echo ""
echo "🔍 Para verificar en Vercel:"
echo "  1. Ve a Vercel → Logs → Function → Route /dashboard"
echo "  2. Busca: [db] getUnifiedDB() - Using DB"
echo "  3. Compara los valores con los de arriba"
echo ""
echo "📊 Para probar endpoint de debug:"
echo "  Local:  curl http://localhost:3000/api/debug/macro-indicador | jq"
echo "  Vercel: curl https://macro-dashboard-seven.vercel.app/api/debug/macro-indicador | jq"
























