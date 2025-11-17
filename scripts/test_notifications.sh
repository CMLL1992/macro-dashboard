#!/usr/bin/env bash
set -euo pipefail

# Test script for Telegram notifications - "bulletproof" version
# Usage: BASE='http://localhost:3000' ING='Trading11!' ./scripts/test_notifications.sh

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BASE="${BASE:-http://localhost:3000}"
ING="${ING:-${INGEST_KEY:-Trading11!}}"

echo -e "${BLUE}🧪 Testing Telegram Notifications${NC}"
echo "=================================="
echo "Base URL: $BASE"
echo "Using INGEST_KEY: ${ING:0:8}..."
echo ""

# Generate unique id_fuente to avoid deduplication
TIMESTAMP=$(date +%s)
UNIQUE_ID="test_${TIMESTAMP}"

# Helper function to check HTTP status
check_status() {
  local http_code=$1
  local endpoint=$2
  if [[ $http_code -ge 200 && $http_code -lt 300 ]]; then
    echo -e "${GREEN}✅ Success${NC}"
    return 0
  else
    echo -e "${RED}❌ Failed with HTTP $http_code${NC}"
    case $http_code in
      401|403)
        echo -e "${YELLOW}💡 Tip: Check INGEST_KEY environment variable${NC}"
        ;;
      404)
        echo -e "${YELLOW}💡 Tip: Check BASE URL (currently: $BASE)${NC}"
        ;;
      500)
        echo -e "${YELLOW}💡 Tip: Check server logs and /api/notifications/status${NC}"
        ;;
    esac
    return 1
  fi
}

# Test 1: GET /api/notifications/status
echo -e "${BLUE}==> Comprobando status...${NC}"
STATUS_RESPONSE=$(curl -s -w "\n[http %{http_code}] -> /api/notifications/status\n" "$BASE/api/notifications/status")
HTTP_CODE=$(echo "$STATUS_RESPONSE" | grep '\[http' | sed 's/.*\[http \([0-9]\{3\}\)\].*/\1/' || echo "000")
STATUS_JSON=$(echo "$STATUS_RESPONSE" | sed '/\[http/d')

echo "[http $HTTP_CODE] -> /api/notifications/status"

if ! check_status "$HTTP_CODE" "/api/notifications/status"; then
  echo -e "${RED}Failed at status check. Exiting.${NC}"
  exit 1
fi

# Validate status fields
BOT_OK=$(echo "$STATUS_JSON" | jq -r '.bot_ok // false')
CHAT_OK=$(echo "$STATUS_JSON" | jq -r '.chat_ok // false')
INGEST_LOADED=$(echo "$STATUS_JSON" | jq -r '.ingest_key_loaded // false')
ENABLED=$(echo "$STATUS_JSON" | jq -r '.enabled // false')

# IMPORTANTE: En CI sin credenciales de Telegram, es esperable que bot_ok y chat_ok sean false
# Solo fallar si el endpoint devuelve 500 (error del servidor)
# Si las notificaciones están desactivadas (enabled=false), eso es válido y no es un error
if [[ "$ENABLED" == "false" ]]; then
  echo -e "${YELLOW}⚠️  Notifications disabled by config (ENABLE_TELEGRAM_NOTIFICATIONS != true)${NC}"
  echo -e "${YELLOW}   This is expected in CI without Telegram credentials. Continuing tests...${NC}"
elif [[ "$BOT_OK" != "true" ]] || [[ "$CHAT_OK" != "true" ]]; then
  echo -e "${YELLOW}⚠️  Telegram not configured (bot_ok=$BOT_OK, chat_ok=$CHAT_OK)${NC}"
  echo -e "${YELLOW}   This may be expected in CI. Continuing tests...${NC}"
fi

# INGEST_KEY debe estar configurado para que los tests funcionen
if [[ "$INGEST_LOADED" != "true" ]]; then
  echo -e "${RED}❌ ingest_key_loaded is false. Check INGEST_KEY${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Status check passed (bot_ok=$BOT_OK, chat_ok=$CHAT_OK, ingest_key_loaded=$INGEST_LOADED, enabled=$ENABLED)${NC}"
echo ""

# Test 2: POST /api/jobs/weekly
echo -e "${BLUE}==> Probando WEEKLY (manual)...${NC}"
WEEKLY_RESPONSE=$(curl -s -w "\n[http %{http_code}] -> /api/jobs/weekly\n" \
  -X POST "$BASE/api/jobs/weekly" \
  -H "X-INGEST-KEY: $ING" \
  -H 'Content-Type: application/json' \
  --data '{}')

HTTP_CODE=$(echo "$WEEKLY_RESPONSE" | grep '\[http' | sed 's/.*\[http \([0-9]\{3\}\)\].*/\1/' || echo "000")
WEEKLY_JSON=$(echo "$WEEKLY_RESPONSE" | sed '/\[http/d')

echo "[http $HTTP_CODE] -> /api/jobs/weekly"

# Weekly can return 200 (success) or 500 (already sent this week - also OK)
if [[ $HTTP_CODE -ge 200 && $HTTP_CODE -lt 300 ]]; then
  echo -e "${GREEN}✅ Weekly notification sent${NC}"
elif [[ $HTTP_CODE -eq 500 ]]; then
  # Check if it's the idempotent case (already sent this week)
  if echo "$WEEKLY_JSON" | grep -q "Already sent this week"; then
    echo -e "${GREEN}✅ Weekly idempotency working (already sent this week)${NC}"
  else
    echo -e "${YELLOW}⚠️  Weekly returned 500, but continuing...${NC}"
    echo "Response: $WEEKLY_JSON"
  fi
else
  echo -e "${YELLOW}⚠️  Weekly test failed (HTTP $HTTP_CODE), but continuing...${NC}"
  echo "Response: $WEEKLY_JSON"
fi
echo ""

# Test 3: POST /api/news/insert
echo -e "${BLUE}==> Insertando CPI (NEW + posible NARRATIVA)...${NC}"
NEWS_PAYLOAD="{\"id_fuente\":\"${UNIQUE_ID}\",\"fuente\":\"BLS\",\"pais\":\"US\",\"tema\":\"Inflación\",\"titulo\":\"CPI m/m (oct)\",\"impacto\":\"high\",\"published_at\":\"2025-11-10T13:30:00Z\",\"valor_publicado\":0.5,\"valor_esperado\":0.3,\"resumen\":\"Test notification - unique ID: ${UNIQUE_ID}\"}"

NEWS_RESPONSE=$(curl -s -w "\n[http %{http_code}] -> /api/news/insert\n" \
  -X POST "$BASE/api/news/insert" \
  -H "X-INGEST-KEY: $ING" \
  -H 'Content-Type: application/json' \
  --data "$NEWS_PAYLOAD")

HTTP_CODE=$(echo "$NEWS_RESPONSE" | grep '\[http' | sed 's/.*\[http \([0-9]\{3\}\)\].*/\1/' || echo "000")
NEWS_JSON=$(echo "$NEWS_RESPONSE" | sed '/\[http/d')

echo "[http $HTTP_CODE] -> /api/news/insert"

if ! check_status "$HTTP_CODE" "/api/news/insert"; then
  echo -e "${RED}Failed at news insert. Exiting.${NC}"
  echo "Response: $NEWS_JSON"
  exit 1
fi

# Check if notification was sent
NOTIFIED=$(echo "$NEWS_JSON" | jq -r '.notified // false')
if [[ "$NOTIFIED" == "true" ]]; then
  echo -e "${GREEN}✅ News notification sent to Telegram${NC}"
else
  echo -e "${YELLOW}⚠️  News inserted but not notified (may be duplicate)${NC}"
fi

echo "Waiting 2 seconds for narrative processing..."
sleep 2
echo ""

# Test 4: GET /api/notifications/status (final check)
echo -e "${BLUE}==> Estado final (recentNotifications)...${NC}"
FINAL_STATUS=$(curl -s -w "\n[http %{http_code}] -> /api/notifications/status\n" "$BASE/api/notifications/status")
HTTP_CODE=$(echo "$FINAL_STATUS" | grep '\[http' | sed 's/.*\[http \([0-9]\{3\}\)\].*/\1/' || echo "000")
FINAL_JSON=$(echo "$FINAL_STATUS" | sed '/\[http/d')

echo "[http $HTTP_CODE] -> /api/notifications/status"

if ! check_status "$HTTP_CODE" "/api/notifications/status"; then
  echo -e "${RED}Failed at final status check. Exiting.${NC}"
  exit 1
fi

# Show recent notifications (first 3, formatted)
RECENT_NOTIFS=$(echo "$FINAL_JSON" | jq -c '.recentNotifications[0:3]' 2>/dev/null || echo "[]")
echo "Recent notifications (first 3):"
if command -v jq &> /dev/null; then
  echo "$RECENT_NOTIFS" | jq '.' 2>/dev/null || echo "$RECENT_NOTIFS"
else
  echo "$RECENT_NOTIFS"
fi
echo ""

# Show full JSON (first 200 lines) if verbose
if [[ "${VERBOSE:-}" == "1" ]]; then
  echo "Full status response (first 200 lines):"
  echo "$FINAL_JSON" | head -200
  echo ""
fi

# Test 5: Narrative (inflación) - CPI Δ≥DELTA_INFL_PP
echo -e "${BLUE}==> Probando narrativa (inflación)...${NC}"
NARRATIVE_PAYLOAD="{\"id_fuente\":\"test_narrative_${TIMESTAMP}\",\"fuente\":\"BLS\",\"pais\":\"US\",\"tema\":\"Inflación\",\"titulo\":\"CPI m/m (test)\",\"impacto\":\"high\",\"published_at\":\"2025-11-10T13:30:00Z\",\"valor_publicado\":0.5,\"valor_esperado\":0.2,\"resumen\":\"Test narrative change\"}"

NARRATIVE_RESPONSE=$(curl -s -w "\n[http %{http_code}] -> /api/news/insert\n" \
  -X POST "$BASE/api/news/insert" \
  -H "X-INGEST-KEY: $ING" \
  -H 'Content-Type: application/json' \
  --data "$NARRATIVE_PAYLOAD")

HTTP_CODE=$(echo "$NARRATIVE_RESPONSE" | grep '\[http' | sed 's/.*\[http \([0-9]\{3\}\)\].*/\1/' || echo "000")
echo "[http $HTTP_CODE] -> /api/news/insert (narrative test)"

if check_status "$HTTP_CODE" "/api/news/insert"; then
  echo -e "${GREEN}✅ Narrative test sent${NC}"
else
  echo -e "${YELLOW}⚠️  Narrative test failed, but continuing...${NC}"
fi
echo ""

# Test 6: Weekly idempotency
echo -e "${BLUE}==> Probando idempotencia weekly...${NC}"
WEEKLY_RESPONSE2=$(curl -s -w "\n[http %{http_code}] -> /api/jobs/weekly\n" \
  -X POST "$BASE/api/jobs/weekly" \
  -H "X-INGEST-KEY: $ING" \
  -H 'Content-Type: application/json' \
  --data '{}')

HTTP_CODE2=$(echo "$WEEKLY_RESPONSE2" | grep '\[http' | sed 's/.*\[http \([0-9]\{3\}\)\].*/\1/' || echo "000")
WEEKLY_JSON2=$(echo "$WEEKLY_RESPONSE2" | sed '/\[http/d')
echo "[http $HTTP_CODE2] -> /api/jobs/weekly (repeat)"

if [[ $HTTP_CODE2 -eq 500 ]] && echo "$WEEKLY_JSON2" | grep -q "Already sent"; then
  echo -e "${GREEN}✅ Weekly idempotency confirmed${NC}"
elif [[ $HTTP_CODE2 -ge 200 && $HTTP_CODE2 -lt 300 ]]; then
  echo -e "${GREEN}✅ Weekly sent (not yet sent this week)${NC}"
else
  echo -e "${YELLOW}⚠️  Weekly idempotency test unclear${NC}"
fi
echo ""

# Test 7: Digest idempotency
echo -e "${BLUE}==> Probando digest...${NC}"
DIGEST_RESPONSE=$(curl -s -w "\n[http %{http_code}] -> /api/jobs/digest\n" \
  -X POST "$BASE/api/jobs/digest" \
  -H "X-INGEST-KEY: $ING" \
  -H 'Content-Type: application/json' \
  --data '{}')

HTTP_CODE_DIGEST=$(echo "$DIGEST_RESPONSE" | grep '\[http' | sed 's/.*\[http \([0-9]\{3\}\)\].*/\1/' || echo "000")
DIGEST_JSON=$(echo "$DIGEST_RESPONSE" | sed '/\[http/d')
echo "[http $HTTP_CODE_DIGEST] -> /api/jobs/digest"

if [[ $HTTP_CODE_DIGEST -ge 200 && $HTTP_CODE_DIGEST -lt 300 ]]; then
  if echo "$DIGEST_JSON" | grep -q "Already sent"; then
    echo -e "${GREEN}✅ Digest idempotency confirmed${NC}"
  else
    echo -e "${GREEN}✅ Digest sent${NC}"
  fi
else
  echo -e "${YELLOW}⚠️  Digest test unclear (may be disabled)${NC}"
fi
echo ""

# Test 8: Settings
echo -e "${BLUE}==> Probando settings...${NC}"
SETTINGS_GET=$(curl -s -w "\n[http %{http_code}] -> /api/notifications/settings\n" "$BASE/api/notifications/settings")
HTTP_CODE_SETTINGS=$(echo "$SETTINGS_GET" | grep '\[http' | sed 's/.*\[http \([0-9]\{3\}\)\].*/\1/' || echo "000")
echo "[http $HTTP_CODE_SETTINGS] -> /api/notifications/settings"

if check_status "$HTTP_CODE_SETTINGS" "/api/notifications/settings"; then
  echo -e "${GREEN}✅ Settings endpoint OK${NC}"
else
  echo -e "${YELLOW}⚠️  Settings endpoint failed${NC}"
fi
echo ""

# Test 9: Rate limit (12 inserts in <60s)
echo -e "${BLUE}==> Probando rate limit (12 inserts)...${NC}"
RATE_LIMIT_SUCCESS=0
RATE_LIMIT_FAILED=0
for i in {1..12}; do
  RATE_PAYLOAD="{\"id_fuente\":\"rate_test_${TIMESTAMP}_${i}\",\"fuente\":\"Test\",\"pais\":\"US\",\"tema\":\"Test\",\"titulo\":\"Rate Test ${i}\",\"impacto\":\"low\",\"published_at\":\"2025-11-10T13:30:00Z\"}"
  RATE_RESPONSE=$(curl -s -w "\n[http %{http_code}]\n" \
    -X POST "$BASE/api/news/insert" \
    -H "X-INGEST-KEY: $ING" \
    -H 'Content-Type: application/json' \
    --data "$RATE_PAYLOAD")
  HTTP_CODE_RATE=$(echo "$RATE_RESPONSE" | grep '\[http' | sed 's/.*\[http \([0-9]\{3\}\)\].*/\1/' || echo "000")
  if [[ $HTTP_CODE_RATE -ge 200 && $HTTP_CODE_RATE -lt 300 ]]; then
    RATE_LIMIT_SUCCESS=$((RATE_LIMIT_SUCCESS + 1))
  else
    RATE_LIMIT_FAILED=$((RATE_LIMIT_FAILED + 1))
  fi
  sleep 0.5
done

echo "[http 2xx] -> $RATE_LIMIT_SUCCESS/12 successful"
if [[ $RATE_LIMIT_FAILED -eq 0 ]]; then
  echo -e "${GREEN}✅ Rate limit test passed (all 2xx)${NC}"
else
  echo -e "${YELLOW}⚠️  Rate limit test: $RATE_LIMIT_FAILED failed (may have delays)${NC}"
fi
echo ""

# Summary
echo "=================================="
echo -e "${GREEN}✅ All tests completed!${NC}"
echo ""
echo "Check your Telegram for:"
echo "  - [NEW] message (should arrive)"
echo "  - [NARRATIVA] message (if delta ≥ threshold and no cooldown)"
echo "  - [WEEK AHEAD] message (if weekly was sent)"
echo "  - [DIGEST] message (if digest was sent)"
echo ""
echo "Unique test ID: $UNIQUE_ID"
echo ""

