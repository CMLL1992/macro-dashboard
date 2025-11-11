#!/bin/bash

# Test script for Telegram notifications
# Usage: ./test_notifications.sh

set -e

BASE_URL="${APP_URL:-http://localhost:3000}"
INGEST_KEY="${INGEST_KEY:-TU_SECRETO}"

echo "🧪 Testing Telegram Notifications"
echo "=================================="
echo "Base URL: $BASE_URL"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Insert news item
echo -e "${YELLOW}Test 1: Insert News Item → [NEW]${NC}"
echo "----------------------------------------"

# Use single quotes for headers to avoid zsh issues with !
RESPONSE=$(curl -s -X POST "$BASE_URL/api/news/insert" \
  -H "X-INGEST-KEY: $INGEST_KEY" \
  -H 'Content-Type: application/json' \
  --data '{"id_fuente":"bls_2025-11_cpi_mom","fuente":"BLS","pais":"US","tema":"Inflación","titulo":"CPI m/m (oct)","impacto":"high","published_at":"2025-11-10T13:30:00Z","valor_publicado":0.5,"valor_esperado":0.3,"resumen":"Por encima del consenso."}')

echo "Response: $RESPONSE"
echo ""

if echo "$RESPONSE" | grep -q '"success":true'; then
  echo -e "${GREEN}✅ Test 1 passed: News item inserted${NC}"
else
  echo -e "${RED}❌ Test 1 failed${NC}"
fi

echo ""
echo "Waiting 2 seconds for narrative processing..."
sleep 2

# Test 2: Check status
echo -e "${YELLOW}Test 2: Check Status${NC}"
echo "----------------------------------------"

STATUS=$(curl -s "$BASE_URL/api/notifications/status")
echo "Status response:"
echo "$STATUS" | jq '.' 2>/dev/null || echo "$STATUS"
echo ""

# Test 3: Weekly ahead (manual trigger)
echo -e "${YELLOW}Test 3: Weekly Ahead → [WEEK AHEAD]${NC}"
echo "----------------------------------------"

WEEKLY_RESPONSE=$(curl -s -X POST "$BASE_URL/api/jobs/weekly" \
  -H "X-INGEST-KEY: $INGEST_KEY" \
  -H 'Content-Type: application/json' \
  --data '{}')

echo "Response: $WEEKLY_RESPONSE"
echo ""

if echo "$WEEKLY_RESPONSE" | grep -q '"success":true'; then
  echo -e "${GREEN}✅ Test 3 passed: Weekly ahead sent${NC}"
else
  echo -e "${RED}❌ Test 3 failed${NC}"
fi

echo ""
echo -e "${YELLOW}Test 4: Weekly Ahead (idempotency - should not resend)${NC}"
echo "----------------------------------------"

WEEKLY_RESPONSE2=$(curl -s -X POST "$BASE_URL/api/jobs/weekly" \
  -H "X-INGEST-KEY: $INGEST_KEY" \
  -H 'Content-Type: application/json' \
  --data '{}')

echo "Response: $WEEKLY_RESPONSE2"
echo ""

if echo "$WEEKLY_RESPONSE2" | grep -q '"error":"Already sent this week"'; then
  echo -e "${GREEN}✅ Test 4 passed: Idempotency working (not resent)${NC}"
else
  echo -e "${YELLOW}⚠️  Test 4: May have been resent (check if first run was successful)${NC}"
fi

echo ""
echo "=================================="
echo -e "${GREEN}Tests completed!${NC}"
echo ""
echo "Check your Telegram for:"
echo "  - [NEW] message (Test 1)"
echo "  - [NARRATIVA] message (if delta ≥ 0.2pp and no cooldown)"
echo "  - [WEEK AHEAD] message (Test 3)"

