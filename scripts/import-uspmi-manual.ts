/**
 * Script de importación manual de USPMI (ISM Manufacturing PMI)
 * 
 * Fuente: ISM (Institute for Supply Management) - datos oficiales
 * Formato: CSV en data/manual/USPMI.csv
 * 
 * Uso:
 *   pnpm tsx scripts/import-uspmi-manual.ts
 * 
 * Requisitos:
 *   - Archivo data/manual/USPMI.csv con formato: date,value
 *   - Variables de entorno: TURSO_DATABASE_URL, TURSO_AUTH_TOKEN
 */

import { createClient } from '@libsql/client';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parse } from 'csv-parse/sync';
import { upsertMacroSeries } from '@/lib/db/upsert';
import type { MacroSeries } from '@/lib/types/macro';

interface CSVRow {
  date: string;
  value: string;
}

/**
 * Normaliza fecha a YYYY-MM-01 (primer día del mes)
 */
function normalizeMonth(dateStr: string): string {
  // Acepta formatos: YYYY-MM, YYYY-MM-DD, MM/YYYY, etc.
  let normalized: string;
  
  if (dateStr.includes('-')) {
    // Formato YYYY-MM o YYYY-MM-DD
    normalized = dateStr.split('T')[0].split(' ')[0]; // Remove time if present
    if (normalized.length === 7) {
      // YYYY-MM
      return `${normalized}-01`;
    } else if (normalized.length === 10) {
      // YYYY-MM-DD
      return normalized.slice(0, 7) + '-01';
    }
  } else if (dateStr.includes('/')) {
    // Formato MM/YYYY o DD/MM/YYYY
    const parts = dateStr.split('/');
    if (parts.length === 2) {
      // MM/YYYY
      const month = parts[0].padStart(2, '0');
      const year = parts[1];
      return `${year}-${month}-01`;
    } else if (parts.length === 3) {
      // DD/MM/YYYY o MM/DD/YYYY (asumimos MM/DD/YYYY)
      const month = parts[0].padStart(2, '0');
      const year = parts[2];
      return `${year}-${month}-01`;
    }
  }
  
  // Try to parse as Date
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      const year = d.getUTCFullYear();
      const month = String(d.getUTCMonth() + 1).padStart(2, '0');
      return `${year}-${month}-01`;
    }
  } catch (e) {
    // Ignore
  }
  
  throw new Error(`Cannot normalize date: ${dateStr}`);
}

/**
 * Valida y parsea valor de PMI
 */
function parsePMIValue(valueStr: string): number {
  const value = parseFloat(valueStr.trim());
  if (isNaN(value)) {
    throw new Error(`Invalid PMI value: ${valueStr}`);
  }
  // PMI típicamente está entre 0-100
  if (value < 0 || value > 100) {
    console.warn(`PMI value out of typical range (0-100): ${value}`);
  }
  return value;
}

async function main() {
  console.log('📊 Importación manual de USPMI (ISM Manufacturing PMI)');
  console.log('='.repeat(60));
  
  // Cargar variables de entorno
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;
  
  if (!tursoUrl || !tursoToken) {
    console.error('❌ Error: TURSO_DATABASE_URL y TURSO_AUTH_TOKEN deben estar configurados');
    process.exit(1);
  }
  
  // Leer CSV
  const csvPath = join(process.cwd(), 'data', 'manual', 'USPMI.csv');
  console.log(`\n📁 Leyendo CSV: ${csvPath}`);
  
  let csvContent: string;
  try {
    csvContent = readFileSync(csvPath, 'utf-8');
  } catch (error) {
    console.error(`❌ Error al leer CSV: ${error}`);
    console.error(`\n💡 Asegúrate de que el archivo existe en: ${csvPath}`);
    console.error('   Formato esperado:');
    console.error('   date,value');
    console.error('   1990-01,52.1');
    console.error('   1990-02,51.9');
    process.exit(1);
  }
  
  // Parsear CSV
  let rows: CSVRow[];
  try {
    rows = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as CSVRow[];
  } catch (error) {
    console.error(`❌ Error al parsear CSV: ${error}`);
    process.exit(1);
  }
  
  if (rows.length === 0) {
    console.error('❌ Error: CSV vacío o sin datos válidos');
    process.exit(1);
  }
  
  console.log(`✅ CSV parseado: ${rows.length} filas`);
  
  // Conectar a BD
  console.log('\n🔌 Conectando a Turso...');
  const client = createClient({
    url: tursoUrl,
    authToken: tursoToken,
  });
  
  // Procesar y normalizar datos
  console.log('\n📝 Procesando datos...');
  const observations: Array<{ date: string; value: number }> = [];
  const errors: Array<{ row: number; error: string }> = [];
  
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const date = normalizeMonth(row.date);
      const value = parsePMIValue(row.value);
      observations.push({ date, value });
    } catch (error) {
      errors.push({
        row: i + 2, // +2 porque CSV tiene header y es 1-indexed
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  
  if (errors.length > 0) {
    console.warn(`\n⚠️  Errores en ${errors.length} filas:`);
    errors.slice(0, 10).forEach(e => {
      console.warn(`   Fila ${e.row}: ${e.error}`);
    });
    if (errors.length > 10) {
      console.warn(`   ... y ${errors.length - 10} errores más`);
    }
  }
  
  if (observations.length === 0) {
    console.error('❌ Error: No hay observaciones válidas para insertar');
    process.exit(1);
  }
  
  console.log(`✅ ${observations.length} observaciones válidas`);
  console.log(`   Rango de fechas: ${observations[0].date} → ${observations[observations.length - 1].date}`);
  console.log(`   Rango de valores: ${Math.min(...observations.map(o => o.value)).toFixed(1)} → ${Math.max(...observations.map(o => o.value)).toFixed(1)}`);
  
  // Verificar duplicados existentes
  console.log('\n🔍 Verificando duplicados existentes...');
  const existingDates = new Set<string>();
  try {
    const existing = await client.execute({
      sql: "SELECT date FROM macro_observations WHERE series_id = 'USPMI'",
    });
    existing.rows.forEach((row: any) => {
      existingDates.add(row.date);
    });
  } catch (error) {
    console.error(`❌ Error al verificar duplicados: ${error}`);
    process.exit(1);
  }
  
  const toInsert = observations.filter(obs => !existingDates.has(obs.date));
  const toSkip = observations.length - toInsert.length;
  
  if (toSkip > 0) {
    console.log(`⚠️  ${toSkip} observaciones ya existen (serán omitidas)`);
  }
  
  if (toInsert.length === 0) {
    console.log('\n✅ Todas las observaciones ya existen en BD. No hay nada que insertar.');
    process.exit(0);
  }
  
  // Insertar datos usando upsertMacroSeries (método estándar del sistema)
  console.log(`\n💾 Insertando ${toInsert.length} observaciones usando upsertMacroSeries...`);
  
  try {
    const pmiSeries: MacroSeries = {
      id: 'USPMI',
      source: 'MANUAL_ISM',
      indicator: 'USPMI',
      nativeId: 'ISM_MANUFACTURING_PMI',
      name: 'ISM Manufacturing: PMI',
      frequency: 'M', // Monthly
      data: toInsert.map(obs => ({
        date: obs.date,
        value: obs.value,
      })),
      lastUpdated: toInsert[toInsert.length - 1]?.date || undefined,
    };

    await upsertMacroSeries(pmiSeries);
    
    console.log(`✅ ${toInsert.length} observaciones procesadas con upsertMacroSeries`);
  } catch (error) {
    console.error(`❌ Error al insertar con upsertMacroSeries: ${error}`);
    throw error;
  }
  
  const inserted = toInsert.length;
  const failed = 0;
  
  // Resumen final
  console.log('\n' + '='.repeat(60));
  console.log('📊 Resumen de importación:');
  console.log(`   ✅ Insertadas/Actualizadas: ${inserted}`);
  if (failed > 0) {
    console.log(`   ❌ Fallidas: ${failed}`);
  }
  if (toSkip > 0) {
    console.log(`   ⏭️  Omitidas (ya existían): ${toSkip}`);
  }
  console.log(`   📈 Total procesadas: ${observations.length}`);
  
  // Validación final
  console.log('\n🔍 Validación final en BD...');
  try {
    const result = await client.execute({
      sql: `
        SELECT 
          COUNT(*) AS n,
          MIN(date) AS min_date,
          MAX(date) AS max_date,
          ROUND(AVG(value), 2) AS avg_value,
          MIN(value) AS min_value,
          MAX(value) AS max_value
        FROM macro_observations
        WHERE series_id = 'USPMI'
      `,
    });
    
    const stats = result.rows[0] as any;
    console.log(`   Count: ${stats.n}`);
    console.log(`   Min date: ${stats.min_date}`);
    console.log(`   Max date: ${stats.max_date}`);
    console.log(`   Avg value: ${stats.avg_value}`);
    console.log(`   Range: ${stats.min_value} - ${stats.max_value}`);
    
    if (stats.n > 0) {
      console.log('\n✅ Importación completada exitosamente!');
      console.log('   USPMI está disponible en el dashboard.');
    } else {
      console.log('\n⚠️  Advertencia: No hay datos de USPMI en BD');
    }
  } catch (error) {
    console.error(`❌ Error en validación: ${error}`);
  }
  
  process.exit(0);
}

main().catch((error) => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
});
