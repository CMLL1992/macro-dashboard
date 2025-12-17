#!/usr/bin/env tsx
/**
 * Script para probar códigos alternativos para los indicadores faltantes
 */

import { fetchFredSeries } from "../packages/ingestors/fred";
import { fetchTradingEconomics } from "../packages/ingestors/tradingEconomics";

const FRED_API_KEY = process.env.FRED_API_KEY || "ccc90330e6a50afa217fb55ac48c4d28";
const TE_API_KEY = process.env.TRADING_ECONOMICS_API_KEY || "3EE47420-8691-4DE1-AF46-32283925D96C";

async function testCoreCapex() {
  console.log("🔍 Probando códigos FRED para core_capex_orders...\n");
  
  // Códigos alternativos para Core Capex Orders (Non-defense Capital Goods ex Aircraft)
  const codes = [
    "NCOC96", // Original
    "A34NXO", // New Orders for Nondefense Capital Goods Excluding Aircraft
    "DGORDER", // Durable Goods Orders (total)
    "ANDENO", // New Orders for Durable Goods
  ];

  for (const code of codes) {
    try {
      const observations = await fetchFredSeries({
        indicatorId: "test",
        seriesId: code,
        transform: "mom",
        apiKey: FRED_API_KEY,
      });
      
      if (observations.length > 0) {
        console.log(`  ✅ ${code}: ${observations.length} observaciones`);
        console.log(`     Último valor: ${observations[observations.length - 1]?.value?.toFixed(2)}`);
        console.log(`     Fecha: ${observations[observations.length - 1]?.date}`);
        return code;
      } else {
        console.log(`  ⚠️  ${code}: Sin observaciones`);
      }
    } catch (error: any) {
      console.log(`  ❌ ${code}: ${error.message}`);
    }
    
    // Pequeña pausa para evitar rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  return null;
}

async function testTradingEconomics() {
  console.log("\n🔍 Probando endpoints de Trading Economics...\n");
  
  const endpoints = [
    "united-states/manufacturing-pmi",
    "united-states/services-pmi",
    "united-states/consumer-confidence",
  ];

  for (const endpoint of endpoints) {
    try {
      const observations = await fetchTradingEconomics(endpoint, TE_API_KEY);
      if (observations.length > 0) {
        console.log(`  ✅ ${endpoint}: ${observations.length} observaciones`);
        console.log(`     Último valor: ${observations[0]?.value?.toFixed(2)}`);
        console.log(`     Fecha: ${observations[0]?.date}`);
      } else {
        console.log(`  ⚠️  ${endpoint}: Sin observaciones`);
      }
    } catch (error: any) {
      console.log(`  ❌ ${endpoint}: ${error.message}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

async function main() {
  console.log("🚀 Test de códigos alternativos para indicadores faltantes\n");
  
  const workingCode = await testCoreCapex();
  if (workingCode && workingCode !== "NCOC96") {
    console.log(`\n💡 Recomendación: Usar código FRED "${workingCode}" en lugar de "NCOC96"`);
  }
  
  await testTradingEconomics();
  
  console.log("\n✅ Test completado");
}

main().catch(console.error);


export {}
