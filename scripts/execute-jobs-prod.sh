#!/bin/bash
# Script para ejecutar jobs de producción hasta completar

URL="https://macro-dashboard-cm11.vercel.app"
TOKEN="cbc3d1139031a75f4721ddb45bf8cca4a79b115d4c15ba83e1a1713898cdbc82"

echo "============================================================"
echo "🚀 EJECUTANDO JOBS DE PRODUCCIÓN"
echo "============================================================"
echo ""

# 1. FRED
echo "📊 1. FRED INGESTION"
echo "----------------------------------------"
BATCH_SIZE=3
CURSOR=""
ITERATION=0

while true; do
  ITERATION=$((ITERATION + 1))
  echo ""
  echo "🔄 Iteración $ITERATION..."
  
  if [ -z "$CURSOR" ]; then
    URL_PARAMS="batch=$BATCH_SIZE"
  else
    URL_PARAMS="batch=$BATCH_SIZE&cursor=$CURSOR"
  fi
  
  RESPONSE=$(curl -sS -X POST "$URL/api/jobs/ingest/fred?$URL_PARAMS" \
    -H "Authorization: Bearer $TOKEN")
  
  DONE=$(echo "$RESPONSE" | jq -r '.done // false')
  NEXT_CURSOR=$(echo "$RESPONSE" | jq -r '.nextCursor // null')
  PROCESSED=$(echo "$RESPONSE" | jq -r '.processed // 0')
  DURATION=$(echo "$RESPONSE" | jq -r '.durationMs // 0')
  
  echo "   ✅ Procesados: $PROCESSED"
  echo "   ⏱️  Duración: $(echo "scale=1; $DURATION/1000" | bc)s"
  echo "   📊 Estado: $(if [ "$DONE" = "true" ]; then echo "✅ COMPLETADO"; else echo "⏳ EN PROGRESO"; fi)"
  
  if [ "$DONE" = "true" ]; then
    echo ""
    echo "✅ FRED completado en $ITERATION iteraciones"
    echo "$RESPONSE" | jq '{done, nextCursor, processed, durationMs}'
    break
  fi
  
  if [ "$NEXT_CURSOR" = "null" ] || [ -z "$NEXT_CURSOR" ]; then
    echo "⚠️  No hay nextCursor pero done=false. Revisar logs."
    break
  fi
  
  CURSOR="$NEXT_CURSOR"
  echo "   📍 Siguiente cursor: $CURSOR"
  sleep 2
done

echo ""
echo "============================================================"
echo "📦 2. ASSETS INGESTION"
echo "============================================================"
echo ""

# 2. ASSETS
BATCH_SIZE=2
CURSOR=""
ITERATION=0
RESET=true

while true; do
  ITERATION=$((ITERATION + 1))
  echo ""
  echo "🔄 Iteración $ITERATION..."
  
  if [ "$RESET" = "true" ]; then
    URL_PARAMS="batch=$BATCH_SIZE&reset=true"
    RESET=false
  elif [ -z "$CURSOR" ]; then
    URL_PARAMS="batch=$BATCH_SIZE"
  else
    URL_PARAMS="batch=$BATCH_SIZE&cursor=$CURSOR"
  fi
  
  RESPONSE=$(curl -sS -X POST "$URL/api/jobs/ingest/assets?$URL_PARAMS" \
    -H "Authorization: Bearer $TOKEN")
  
  DONE=$(echo "$RESPONSE" | jq -r '.done // false')
  NEXT_CURSOR=$(echo "$RESPONSE" | jq -r '.nextCursor // null')
  PROCESSED=$(echo "$RESPONSE" | jq -r '.processed // 0')
  DURATION=$(echo "$RESPONSE" | jq -r '.durationMs // 0')
  
  echo "   ✅ Procesados: $PROCESSED"
  echo "   ⏱️  Duración: $(echo "scale=1; $DURATION/1000" | bc)s"
  echo "   📊 Estado: $(if [ "$DONE" = "true" ]; then echo "✅ COMPLETADO"; else echo "⏳ EN PROGRESO"; fi)"
  
  if [ "$DONE" = "true" ]; then
    echo ""
    echo "✅ ASSETS completado en $ITERATION iteraciones"
    echo "$RESPONSE" | jq '{done, nextCursor, processed, durationMs}'
    break
  fi
  
  if [ "$NEXT_CURSOR" = "null" ] || [ -z "$NEXT_CURSOR" ]; then
    echo "⚠️  No hay nextCursor pero done=false. Revisar logs."
    break
  fi
  
  CURSOR="$NEXT_CURSOR"
  echo "   📍 Siguiente cursor: $CURSOR"
  sleep 2
done

echo ""
echo "============================================================"
echo "🎯 3. BIAS COMPUTATION"
echo "============================================================"
echo ""

# 3. BIAS
BATCH_SIZE=5
CURSOR=""
ITERATION=0
RESET=true

while true; do
  ITERATION=$((ITERATION + 1))
  echo ""
  echo "🔄 Iteración $ITERATION..."
  
  if [ "$RESET" = "true" ]; then
    URL_PARAMS="batch=$BATCH_SIZE&reset=true"
    RESET=false
  elif [ -z "$CURSOR" ]; then
    URL_PARAMS="batch=$BATCH_SIZE"
  else
    URL_PARAMS="batch=$BATCH_SIZE&cursor=$CURSOR"
  fi
  
  RESPONSE=$(curl -sS -X POST "$URL/api/jobs/compute/bias?$URL_PARAMS" \
    -H "Authorization: Bearer $TOKEN")
  
  DONE=$(echo "$RESPONSE" | jq -r '.done // false')
  NEXT_CURSOR=$(echo "$RESPONSE" | jq -r '.nextCursor // null')
  PROCESSED=$(echo "$RESPONSE" | jq -r '.processed // 0')
  DURATION=$(echo "$RESPONSE" | jq -r '.durationMs // 0')
  
  echo "   ✅ Procesados: $PROCESSED"
  echo "   ⏱️  Duración: $(echo "scale=1; $DURATION/1000" | bc)s"
  echo "   📊 Estado: $(if [ "$DONE" = "true" ]; then echo "✅ COMPLETADO"; else echo "⏳ EN PROGRESO"; fi)"
  
  if [ "$DONE" = "true" ]; then
    echo ""
    echo "✅ BIAS completado en $ITERATION iteraciones"
    echo "$RESPONSE" | jq '{done, nextCursor, processed, durationMs}'
    break
  fi
  
  if [ "$NEXT_CURSOR" = "null" ] || [ -z "$NEXT_CURSOR" ]; then
    echo "⚠️  No hay nextCursor pero done=false. Revisar logs."
    break
  fi
  
  CURSOR="$NEXT_CURSOR"
  echo "   📍 Siguiente cursor: $CURSOR"
  sleep 2
done

echo ""
echo "============================================================"
echo "✅ TODOS LOS JOBS COMPLETADOS"
echo "============================================================"

