#!/usr/bin/env tsx
/**
 * Script para ingerir datos de todos los indicadores que no tienen observaciones
 */

// TODO: Re-implement when apps/web structure is complete
// import { ingestIndicator } from "../apps/web/lib/ingest";
// import { prisma } from "../apps/web/lib/prisma";

const INDICATORS_WITHOUT_DATA = [
  "consumer_conf_cb",
  "michigan_sentiment",
  "unrate_u3",
  "core_cpi_yoy",
  "pce_yoy",
  "core_pce_yoy",
  "breakeven_10y",
  "durable_goods_orders",
  "jolts_openings",
  "gdp_real_yoy",
  "core_capex_orders",
  "building_permits",
  "avg_hourly_earnings_yoy",
  "initial_claims",
  "high_yield_spread",
  "fed_funds_target",
  "new_home_sales",
  "housing_starts",
  "vix_index",
  "financial_conditions",
  "ppi_yoy",
  "ism_manu_pmi",
  "ism_serv_pmi",
];

async function main() {
  console.log(`🚀 Iniciando ingesta de ${INDICATORS_WITHOUT_DATA.length} indicadores...\n`);

  const results: Array<{ id: string; success: boolean; count: number; error?: string }> = [];

  for (const indicatorId of INDICATORS_WITHOUT_DATA) {
    try {
      console.log(`📊 Ingestando: ${indicatorId}...`);
      const result = await ingestIndicator(indicatorId);
      results.push({ id: indicatorId, ...result });
      
      if (result.success) {
        console.log(`  ✅ ${result.count} observaciones guardadas`);
      } else {
        console.log(`  ❌ Error: ${result.error}`);
      }
      
      // Pequeña pausa para evitar rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`  ❌ Excepción: ${error instanceof Error ? error.message : "Unknown error"}`);
      results.push({
        id: indicatorId,
        success: false,
        count: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  console.log("\n📊 Resumen:");
  console.log(`  Total: ${results.length}`);
  console.log(`  Exitosos: ${results.filter(r => r.success).length}`);
  console.log(`  Fallidos: ${results.filter(r => !r.success).length}`);
  console.log(`  Total observaciones: ${results.reduce((sum, r) => sum + r.count, 0)}`);

  console.log("\n✅ Indicadores exitosos:");
  results.filter(r => r.success).forEach(r => {
    console.log(`  - ${r.id}: ${r.count} observaciones`);
  });

  if (results.some(r => !r.success)) {
    console.log("\n❌ Indicadores con errores:");
    results.filter(r => !r.success).forEach(r => {
      console.log(`  - ${r.id}: ${r.error}`);
    });
  }
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });


export {}
