#!/bin/bash

# Script para ejecutar workflows de GitHub Actions desde la línea de comandos
# Requiere: GITHUB_TOKEN como variable de entorno

GITHUB_TOKEN="${GITHUB_TOKEN}"
REPO="CMLL1992/macro-dashboard"

if [ -z "$GITHUB_TOKEN" ]; then
  echo "❌ GITHUB_TOKEN no configurado"
  echo ""
  echo "Para ejecutar workflows desde la línea de comandos, necesitas:"
  echo "1. Crear un Personal Access Token en GitHub:"
  echo "   https://github.com/settings/tokens"
  echo "2. Darle permisos: repo, workflow"
  echo "3. Exportar: export GITHUB_TOKEN=tu_token"
  echo ""
  echo "O ejecuta manualmente desde la web:"
  echo "  https://github.com/CMLL1992/macro-dashboard/actions"
  exit 1
fi

echo "🚀 Ejecutando workflows de GitHub Actions..."
echo ""

# 1. Daily Jobs (FRED, Correlaciones, Bias)
echo "📊 Ejecutando Daily Jobs (FRED, Correlaciones, Bias)..."
curl -X POST \
  -H "Authorization: token $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  "https://api.github.com/repos/$REPO/actions/workflows/daily-jobs.yml/dispatches" \
  -d '{"ref":"main"}' && echo "✅ Daily Jobs workflow iniciado"

echo ""
sleep 2

# 2. News & Calendar Ingest
echo "📰 Ejecutando News & Calendar Ingest (Todas las fuentes)..."
curl -X POST \
  -H "Authorization: token $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  "https://api.github.com/repos/$REPO/actions/workflows/news-calendar-ingest.yml/dispatches" \
  -d '{"ref":"main"}' && echo "✅ News & Calendar Ingest workflow iniciado"

echo ""
echo "✅ Workflows ejecutados!"
echo ""
echo "📊 Verifica el progreso en:"
echo "   https://github.com/$REPO/actions"
echo ""



