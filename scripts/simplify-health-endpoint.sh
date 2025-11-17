#!/bin/bash
# Script para simplificar temporalmente el endpoint /api/health
# Uso: ./scripts/simplify-health-endpoint.sh [enable|disable]

set -e

HEALTH_DIR="app/api/health"
BACKUP_FILE="${HEALTH_DIR}/route.ts.backup"
CURRENT_FILE="${HEALTH_DIR}/route.ts"
SIMPLE_FILE="${HEALTH_DIR}/route.simple.ts"

if [ "$1" == "enable" ]; then
  echo "🔧 Habilitando versión simplificada de /api/health..."
  
  # Hacer backup del archivo actual si no existe
  if [ ! -f "$BACKUP_FILE" ]; then
    echo "📦 Creando backup de route.ts..."
    cp "$CURRENT_FILE" "$BACKUP_FILE"
  fi
  
  # Copiar versión simplificada
  echo "✅ Copiando versión simplificada..."
  cp "$SIMPLE_FILE" "$CURRENT_FILE"
  
  echo "✅ Versión simplificada habilitada"
  echo "📝 Para desplegar: git add app/api/health/route.ts && git commit -m 'test: versión simplificada /api/health' && git push"
  
elif [ "$1" == "disable" ]; then
  echo "🔧 Restaurando versión original de /api/health..."
  
  if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ Error: No se encontró el backup. No se puede restaurar."
    exit 1
  fi
  
  # Restaurar backup
  echo "📦 Restaurando desde backup..."
  cp "$BACKUP_FILE" "$CURRENT_FILE"
  
  echo "✅ Versión original restaurada"
  
else
  echo "❌ Uso: $0 [enable|disable]"
  echo ""
  echo "  enable  - Habilita versión simplificada (sin base de datos)"
  echo "  disable - Restaura versión original"
  exit 1
fi

