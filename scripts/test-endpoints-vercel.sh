#!/bin/bash
# Script para probar endpoints en Vercel y recopilar información

BASE_URL="https://macro-dashboard-seven.vercel.app"

echo "🔍 Probando Endpoints en Vercel"
echo "================================"
echo ""

echo "1️⃣ Probando /api/health..."
echo "----------------------------"
curl -s --max-time 30 "${BASE_URL}/api/health" | jq '.' || echo "❌ Error o sin respuesta"
echo ""
echo ""

echo "2️⃣ Probando /api/diag..."
echo "-------------------------"
curl -s --max-time 30 "${BASE_URL}/api/diag" | jq '.' || echo "❌ Error o sin respuesta"
echo ""
echo ""

echo "3️⃣ Probando /api/fred/CPIAUCSL..."
echo "----------------------------------"
curl -s --max-time 30 "${BASE_URL}/api/fred/CPIAUCSL?observation_start=2024-01-01" | jq '.observations | length' || echo "❌ Error o sin respuesta"
echo ""
echo ""

echo "✅ Pruebas completadas"
echo ""
echo "📋 INSTRUCCIONES:"
echo "1. Ve a Vercel → Logs → Production"
echo "2. Filtra por: /api/health o /api/diag"
echo "3. Busca las líneas que empiezan con [db]"
echo "4. Copia las líneas de debug y cualquier error"
echo "5. Comparte la información con Cursor"

