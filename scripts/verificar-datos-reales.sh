#!/bin/bash

# Script para verificar que todos los datos sean reales y actualizados
# Compara datos de la base de datos con las APIs oficiales

FRED_API_KEY="${FRED_API_KEY:-ccc90330e6a50afa217fb55ac48c4d28}"
TODAY=$(date +%Y-%m-%d)
DB_PATH="macro.db"

echo "🔍 Verificando que los datos sean reales y actualizados..."
echo "📅 Fecha de referencia: $TODAY"
echo ""

# Función para obtener último valor de FRED
get_fred_latest() {
  local series_id=$1
  curl -s "https://api.stlouisfed.org/fred/series/observations?series_id=${series_id}&api_key=${FRED_API_KEY}&file_type=json&observation_end=${TODAY}&limit=1&sort_order=desc" \
    | jq -r '.observations[0] | "\(.date)|\(.value)"' 2>/dev/null
}

# Función para obtener último valor de BD
get_db_latest() {
  local series_id=$1
  sqlite3 "$DB_PATH" "SELECT date || '|' || value FROM macro_observations WHERE series_id = '${series_id}' ORDER BY date DESC LIMIT 1;" 2>/dev/null
}

# Series importantes a verificar
declare -a SERIES=("T10Y2Y" "CPIAUCSL" "CPILFESL" "UNRATE" "PAYEMS" "GDPC1" "FEDFUNDS" "VIXCLS" "ICSA")

echo "📊 Comparando datos BD vs FRED API:"
echo ""

matched=0
mismatched=0

for series in "${SERIES[@]}"; do
  echo "Verificando $series..."
  
  db_data=$(get_db_latest "$series")
  fred_data=$(get_fred_latest "$series")
  
  if [ -z "$db_data" ]; then
    echo "  ❌ No hay datos en BD para $series"
    ((mismatched++))
    continue
  fi
  
  if [ -z "$fred_data" ] || [ "$fred_data" = "null|null" ]; then
    echo "  ⚠️  No se pudo obtener datos de FRED para $series"
    continue
  fi
  
  db_date=$(echo "$db_data" | cut -d'|' -f1)
  db_value=$(echo "$db_data" | cut -d'|' -f2)
  fred_date=$(echo "$fred_data" | cut -d'|' -f1)
  fred_value=$(echo "$fred_data" | cut -d'|' -f2)
  
  # Calcular días de diferencia
  db_timestamp=$(date -j -f "%Y-%m-%d" "$db_date" "+%s" 2>/dev/null || date -d "$db_date" "+%s" 2>/dev/null)
  fred_timestamp=$(date -j -f "%Y-%m-%d" "$fred_date" "+%s" 2>/dev/null || date -d "$fred_date" "+%s" 2>/dev/null)
  today_timestamp=$(date -j -f "%Y-%m-%d" "$TODAY" "+%s" 2>/dev/null || date -d "$TODAY" "+%s" 2>/dev/null)
  
  if [ -n "$db_timestamp" ] && [ -n "$fred_timestamp" ]; then
    db_days_ago=$(( (today_timestamp - db_timestamp) / 86400 ))
    fred_days_ago=$(( (today_timestamp - fred_timestamp) / 86400 ))
    
    # Comparar valores (con tolerancia para redondeo)
    value_diff=$(echo "scale=10; ($db_value - $fred_value) / $fred_value * 100" | bc 2>/dev/null || echo "999")
    abs_diff=$(echo "$value_diff" | sed 's/-//')
    
    if [ "$db_date" = "$fred_date" ] && [ "$(echo "$abs_diff < 0.1" | bc 2>/dev/null || echo "0")" = "1" ]; then
      echo "  ✅ Coincide: BD=$db_date ($db_value) vs FRED=$fred_date ($fred_value)"
      ((matched++))
    else
      echo "  ⚠️  Diferencia:"
      echo "     BD:   $db_date = $db_value (hace $db_days_ago días)"
      echo "     FRED: $fred_date = $fred_value (hace $fred_days_ago días)"
      if [ "$db_date" != "$fred_date" ]; then
        echo "     ⚠️  Fechas no coinciden - necesita actualización"
      fi
      if [ "$(echo "$abs_diff >= 0.1" | bc 2>/dev/null || echo "1")" = "1" ]; then
        echo "     ⚠️  Valores difieren en ${abs_diff}%"
      fi
      ((mismatched++))
    fi
  else
    echo "  ⚠️  BD: $db_date = $db_value"
    echo "     FRED: $fred_date = $fred_value"
  fi
  
  echo ""
  sleep 0.5  # Rate limiting
done

echo "=" | head -c 60
echo ""
echo "📊 RESUMEN:"
echo "  ✅ Coinciden: $matched"
echo "  ⚠️  Necesitan actualización: $mismatched"
echo ""

# Mostrar fechas más recientes
echo "📅 Fechas más recientes en BD:"
sqlite3 "$DB_PATH" "SELECT series_id, MAX(date) as latest_date FROM macro_observations GROUP BY series_id ORDER BY latest_date DESC LIMIT 10;" | while IFS='|' read -r series_id latest_date; do
  days_ago=$(sqlite3 "$DB_PATH" "SELECT CAST(julianday('$TODAY') - julianday('$latest_date') AS INTEGER);" 2>/dev/null || echo "?")
  if [ "$days_ago" -le 7 ] 2>/dev/null; then
    status="✅"
  elif [ "$days_ago" -le 30 ] 2>/dev/null; then
    status="⚠️"
  else
    status="❌"
  fi
  echo "  $status $series_id: $latest_date (hace ~$days_ago días)"
done
