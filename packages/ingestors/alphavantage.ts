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
    // Use only ISM_MANUFACTURING (confirmed endpoint name)
    // Do NOT try multiple functions - this causes rate limits
    const func = 'ISM_MANUFACTURING'
    const url = `${AV_BASE}?function=${func}&interval=monthly&apikey=${apiKey}`;
    
    // DEBUG: Log URL (mask API key completely)
    const maskedUrl = url.replace(/apikey=[^&]+/, 'apikey=***')
    console.log(`[alphavantage] Fetching PMI from Alpha Vantage`, {
      function: func,
      url: maskedUrl,
    })
    
    const response = await fetchWithTimeout(url, { timeoutMs: 10000 });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    // Log response status and content-type before parsing
    console.log(`[alphavantage] Response status for ${func}:`, {
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers.get('content-type'),
    })
    
    const data = await response.json();
    
    // Log raw response for debugging (first 400 chars as requested)
    const responsePreview = JSON.stringify(data).substring(0, 400)
    console.log(`[alphavantage] Response body preview for ${func} (first 400 chars):`, responsePreview)
    
    // Also log full structure keys for debugging
    if (data && typeof data === 'object') {
      console.log(`[alphavantage] Response keys for ${func}:`, Object.keys(data))
    }
    
    // CRITICAL: Handle rate limit as recoverable error - stop immediately
    if (data['Note'] || data['Information']) {
      const rateLimitMsg = data['Note'] || data['Information']
      console.warn(`[alphavantage] Rate limit detected for ${func}:`, rateLimitMsg)
      // Return empty array with error indicator - don't throw, let caller handle
      return []
    }
    
    // Alpha Vantage puede devolver errores en el JSON
    if (data['Error Message']) {
      const errorMsg = data['Error Message']
      console.error(`[alphavantage] Error Message for ${func}:`, errorMsg)
      throw new Error(errorMsg);
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
        
        // Normalize date to YYYY-MM-01 for monthly series
        const yearMonth = date.slice(0, 7); // "YYYY-MM"
        const monthKey = `${yearMonth}-01`; // "YYYY-MM-01"
        
        return {
          indicator_id: 'AV:PMI',
          date: monthKey, // Always YYYY-MM-01 for monthly PMI data
          value: numValue,
          source_url: `https://www.alphavantage.co/query?function=${func}`,
          released_at: date, // Keep original date as metadata
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
    
    // Si llegamos aquí y no hay datos, retornar array vacío
    console.warn('[alphavantage] No PMI data found in response', {
      function: func,
      responseKeys: data && typeof data === 'object' ? Object.keys(data) : [],
      note: 'Alpha Vantage may not have PMI data available, or response format is unexpected',
    })
    return []
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
      
      // Normalize date to YYYY-MM-01 format (first day of month for monthly series)
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
      
      // CRITICAL: Normalize to YYYY-MM-01 for monthly series (PMI is monthly)
      // This ensures consistent dates and prevents duplicate key conflicts
      const yearMonth = normalizedDate.slice(0, 7); // "YYYY-MM"
      const monthKey = `${yearMonth}-01`; // "YYYY-MM-01"
      
      return {
        indicator_id: 'AV:PMI',
        date: monthKey, // Always YYYY-MM-01 for monthly PMI data
        value: value,
        source_url: 'https://www.alphavantage.co/query?function=ISM_MANUFACTURING_PMI',
        released_at: normalizedDate, // Keep original date as metadata
      };
    })
    .filter((obs): obs is Observation => obs !== null)
    .sort((a, b) => a.date.localeCompare(b.date));
}














