#!/bin/bash

# Script para limpiar completamente el caché y rebuild
echo "🧹 Limpiando caché de Next.js..."
rm -rf .next

echo "🧹 Limpiando node_modules/.cache..."
rm -rf node_modules/.cache

echo "✅ Caché limpiado. Ahora ejecuta: pnpm dev"

