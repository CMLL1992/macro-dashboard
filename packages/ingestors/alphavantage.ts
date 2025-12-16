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
    // Note: Alpha Vantage may use different function names - try multiple formats
    const functions = ['MANUFACTURING_PMI', 'PMI', 'ISM_MANUFACTURING_PMI']
    
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
        
        // Alpha Vantage puede devolver errores en el JSON
        if (data['Error Message']) {
          if (func !== functions[functions.length - 1]) {
            // Try next function name
            continue
          }
          throw new Error(data['Error Message']);
        }
        
        if (data['Note']) {
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
          const parsed = Object.entries(series).map(([date, value]: [string, any]) => ({
            indicator_id: 'AV:PMI',
            date: date,
            value: parseFloat(value['value'] || value['PMI'] || value['4. close'] || value),
            source_url: `https://www.alphavantage.co/query?function=${func}`,
            released_at: date,
          })).filter(obs => !isNaN(obs.value) && obs.value > 0)
          
          if (parsed.length > 0) {
            return parsed.sort((a, b) => a.date.localeCompare(b.date))
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
    console.warn('[alphavantage] No PMI data found with any function name')
    return [];
  } catch (error) {
    console.error('[alphavantage] Error fetching PMI:', error);
    throw error;
  }
}

function parseAlphaVantageResponse(data: any[]): Observation[] {
  return data
    .map((item: any): Observation | null => {
      const value = parseFloat(item.value || item.PMI || item['Manufacturing PMI']);
      const dateStr = item.date || item.Date || item.timestamp;
      
      if (isNaN(value) || !dateStr) {
        return null;
      }
      
      return {
        indicator_id: 'AV:PMI',
        date: dateStr,
        value: value,
        source_url: 'https://www.alphavantage.co/query?function=MANUFACTURING_PMI',
        released_at: dateStr,
      };
    })
    .filter((obs): obs is Observation => obs !== null)
    .sort((a, b) => a.date.localeCompare(b.date));
}














