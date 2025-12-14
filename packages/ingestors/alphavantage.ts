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
    const url = `${AV_BASE}?function=MANUFACTURING_PMI&interval=monthly&apikey=${apiKey}`;
    
    const response = await fetchWithTimeout(url);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Alpha Vantage puede devolver errores en el JSON
    if (data['Error Message']) {
      throw new Error(data['Error Message']);
    }
    
    if (data['Note']) {
      throw new Error('Alpha Vantage API rate limit exceeded');
    }
    
    // Parsear datos de Alpha Vantage
    if (data['data'] && Array.isArray(data['data'])) {
      return parseAlphaVantageResponse(data['data']);
    }
    
    // Formato alternativo
    if (data['Monthly Time Series']) {
      const series = data['Monthly Time Series'];
      return Object.entries(series).map(([date, value]: [string, any]) => ({
        indicator_id: 'AV:PMI',
        date: date,
        value: parseFloat(value['value'] || value['PMI'] || value),
        source_url: `https://www.alphavantage.co/query?function=MANUFACTURING_PMI`,
        released_at: date,
      })).filter(obs => !isNaN(obs.value));
    }
    
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














