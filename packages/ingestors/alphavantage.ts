/**
 * Alpha Vantage API ingestor
 * API gratuita con datos económicos
 * https://www.alphavantage.co/documentation/
 */

import { fetchWithTimeout } from "@/lib/utils/http";
import type { DataPoint } from "@/lib/types/macro";

type Observation = DataPoint & {
  released_at?: string;
  source_url?: string;
  indicator_id?: string;
  revision?: boolean;
};

const AV_BASE = "https://www.alphavantage.co/query";

export interface AlphaVantageOptions {
  function: string;
  symbol?: string;
  interval?: string;
  apiKey: string;
}

/**
 * Obtiene datos históricos de PMI desde Alpha Vantage
 * Alpha Vantage tiene un endpoint para datos económicos
 */
export async function fetchAlphaVantagePMI(
  apiKey: string
): Promise<Observation[]> {
  try {
    // Alpha Vantage Economic Data endpoint
    // Note: Alpha Vantage uses function=ISM_MANUFACTURING (not ISM_MANUFACTURING_PMI)
    // Try multiple formats as fallback
    const functions = ['ISM_MANUFACTURING', 'ISM_MANUFACTURING_PMI', 'MANUFACTURING_PMI', 'PMI']
    
    for (const func of functions) {
      try {
        const url = `${AV_BASE}?function=${func}&interval=monthly&apikey=${apiKey}`;
        
        const response = await fetchWithTimeout(url, { timeoutMs: 10000 });
        
        if (!response.ok) {
          if (response.status === 404 && func !== functions[functions.length - 1]) {
            // Try next function name
            continue
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Log raw response for debugging (first 500 chars)
        console.log(`[alphavantage] Response for ${func}:`, JSON.stringify(data).substring(0, 500))
        
        // Alpha Vantage puede devolver errores en el JSON
        if (data['Error Message']) {
          const errorMsg = data['Error Message']
          console.warn(`[alphavantage] Error for ${func}:`, errorMsg)
          if (func !== functions[functions.length - 1]) {
            // Try next function name
            continue
          }
          throw new Error(errorMsg);
        }
        
        if (data['Note']) {
          const note = data['Note']
          console.warn(`[alphavantage] Note for ${func}:`, note)
          throw new Error('Alpha Vantage API rate limit exceeded');
        }
        
        // Parsear datos de Alpha Vantage
        if (data['data'] && Array.isArray(data['data'])) {
          const parsed = parseAlphaVantageResponse(data['data'])
          if (parsed.length > 0) {
            return parsed
          }
        }
        
        // Formato alternativo: Monthly Time Series
        if (data['Monthly Time Series']) {
          const series = data['Monthly Time Series'];
          const parsed = Object.entries(series).map(([date, value]: [string, any]) => {
            // Try multiple value keys (Alpha Vantage format can vary)
            const numValue = parseFloat(
              value['value'] || 
              value['PMI'] || 
              value['Manufacturing PMI'] ||
              value['4. close'] || 
              value['close'] ||
              value
            )
            return {
              indicator_id: 'AV:PMI',
              date: date,
              value: numValue,
              source_url: `https://www.alphavantage.co/query?function=${func}`,
              released_at: date,
            }
          }).filter(obs => !isNaN(obs.value) && obs.value > 0 && obs.value <= 100) // PMI is typically 0-100
          
          if (parsed.length > 0) {
            return parsed.sort((a, b) => a.date.localeCompare(b.date))
          }
        }
        
        // Formato alternativo: data array directo
        if (Array.isArray(data)) {
          const parsed = parseAlphaVantageResponse(data)
          if (parsed.length > 0) {
            return parsed
          }
        }
        
        // Si llegamos aquí y no hay datos, intentar siguiente función
        if (func !== functions[functions.length - 1]) {
          continue
        }
      } catch (funcError) {
        // Si no es el último intento, continuar con siguiente función
        if (func !== functions[functions.length - 1]) {
          continue
        }
        throw funcError
      }
    }
    
        // Si ninguna función funcionó, retornar array vacío
        console.warn('[alphavantage] No PMI data found with any function name', {
          functionsTried: functions,
          note: 'Alpha Vantage may not have PMI data available, or function names are incorrect',
        })
        return [];
  } catch (error) {
    console.error('[alphavantage] Error fetching PMI:', error);
    throw error;
  }
}

function parseAlphaVantageResponse(data: any[]): Observation[] {
  return data
    .map((item: any): Observation | null => {
      // Try multiple value keys (Alpha Vantage format can vary)
      const value = parseFloat(
        item.value || 
        item.PMI || 
        item['Manufacturing PMI'] ||
        item['ISM Manufacturing PMI'] ||
        item.close ||
        item['4. close']
      );
      const dateStr = item.date || item.Date || item.timestamp || item.time;
      
      if (isNaN(value) || !dateStr || value <= 0 || value > 100) {
        // PMI is typically 0-100, filter invalid values
        return null;
      }
      
      // Normalize date to YYYY-MM-DD format
      let normalizedDate = dateStr;
      if (dateStr.includes('T')) {
        normalizedDate = dateStr.split('T')[0];
      } else if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        normalizedDate = dateStr;
      } else {
        // Try to parse and reformat
        const parsed = new Date(dateStr);
        if (!isNaN(parsed.getTime())) {
          normalizedDate = parsed.toISOString().split('T')[0];
        }
      }
      
      return {
        indicator_id: 'AV:PMI',
        date: normalizedDate,
        value: value,
        source_url: 'https://www.alphavantage.co/query?function=ISM_MANUFACTURING_PMI',
        released_at: normalizedDate,
      };
    })
    .filter((obs): obs is Observation => obs !== null)
    .sort((a, b) => a.date.localeCompare(b.date));
}














