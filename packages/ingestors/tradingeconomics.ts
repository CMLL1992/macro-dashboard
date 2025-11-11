import { fetchWithTimeout } from "@/lib/utils/http";
import type { DataPoint } from "@/lib/types/macro";

type Observation = DataPoint & {
  released_at?: string;
  source_url?: string;
  indicator_id?: string;
  revision?: boolean;
};

async function httpGet(url: string): Promise<any> {
  const response = await fetchWithTimeout(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return response.json();
}

const TE_BASE = "https://api.tradingeconomics.com";

export interface TradingEconomicsOptions {
  country?: string;
  indicator?: string;
  apiKey: string;
}

/**
 * Mapea endpoint de data_sources.json a formato de Trading Economics API
 */
function mapTradingEconomicsEndpoint(endpoint: string): string {
  // Mapeo de endpoints conocidos
  const endpointMap: Record<string, string> = {
    "united-states/manufacturing-pmi": "manufacturing pmi",
    "united-states/services-pmi": "services pmi",
    "united-states/consumer-confidence": "consumer confidence",
    "united-states/michigan-consumer-sentiment": "consumer sentiment",
    "united-states/building-permits": "building permits",
    "united-states/housing-starts": "housing starts",
    "united-states/new-home-sales": "new home sales",
    "united-states/retail-sales": "retail sales",
    "united-states/industrial-production": "industrial production",
  };
  
  // Si está en el mapa, usar el valor mapeado
  if (endpointMap[endpoint]) {
    return endpointMap[endpoint];
  }
  
  // Si no, intentar extraer el nombre del indicador
  const parts = endpoint.split("/");
  if (parts.length === 2) {
    return parts[1].replace(/-/g, " ");
  }
  
  return endpoint.replace(/-/g, " ");
}

/**
 * Obtiene datos de Trading Economics para un indicador específico
 * Intenta múltiples endpoints si el primero falla
 */
export async function fetchTradingEconomics(
  endpoint: string,
  apiKey: string,
): Promise<Observation[]> {
  const mappedIndicator = mapTradingEconomicsEndpoint(endpoint);
  const country = "united states"; // Por defecto US
  
  // Intentar múltiples formatos de endpoint
  const endpoints = [
    // Endpoint histórico (recomendado)
    `${TE_BASE}/historical/country/${encodeURIComponent(country)}/indicator/${encodeURIComponent(mappedIndicator)}?c=${encodeURIComponent(apiKey)}`,
    // Endpoint markets/indicators (alternativo)
    `${TE_BASE}/markets/indicators/${encodeURIComponent(endpoint)}?c=${encodeURIComponent(apiKey)}`,
    // Endpoint histórico con formato diferente
    `${TE_BASE}/historical/country/${encodeURIComponent(country)}/indicator/${encodeURIComponent(mappedIndicator.toLowerCase())}?c=${encodeURIComponent(apiKey)}`,
  ];
  
  let lastError: Error | null = null;
  
  for (const url of endpoints) {
    try {
      const res = await httpGet(url);
      if (res.ok) {
        // Si este endpoint funciona, usarlo
        const text = await res.text();
        let data: any;
        
        try {
          data = JSON.parse(text);
        } catch (parseError) {
          console.error(`Failed to parse Trading Economics response for ${endpoint}:`, text.substring(0, 200));
          continue; // Intentar siguiente endpoint
        }
        
        return parseTradingEconomicsResponse(data, endpoint);
      } else {
        // Si no es 500, puede ser un error diferente (404, etc.)
        const errorText = await res.text();
        if (res.status !== 500) {
          console.warn(`Trading Economics endpoint ${url} returned ${res.status}:`, errorText.substring(0, 200));
        }
        lastError = new Error(`Trading Economics error ${res.status}: ${res.statusText}`);
        continue; // Intentar siguiente endpoint
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      continue; // Intentar siguiente endpoint
    }
  }
  
  // Si todos los endpoints fallaron, lanzar el último error
  if (lastError) {
    console.error(`All Trading Economics endpoints failed for ${endpoint}`);
    throw lastError;
  }
  
  throw new Error(`Unable to fetch data from Trading Economics for ${endpoint}`);
}

/**
 * Parsea la respuesta de Trading Economics a observaciones
 */
function parseTradingEconomicsResponse(data: any, endpoint: string): Observation[] {
  // Trading Economics puede devolver diferentes formatos
  let series: any[] = [];
  
  if (Array.isArray(data)) {
    series = data;
  } else if (data?.data && Array.isArray(data.data)) {
    series = data.data;
  } else if (data?.value !== undefined || data?.Value !== undefined) {
    // Si es un solo valor, crear un objeto
    series = [data];
  } else if (data?.results && Array.isArray(data.results)) {
    series = data.results;
  }
  
  if (series.length === 0) {
    console.warn(`Trading Economics returned empty data for ${endpoint}. Data structure:`, Object.keys(data || {}));
    return [];
  }
  
  const observations = series
    .map((item: any): Observation | null => {
      // Trading Economics puede devolver diferentes formatos de campo
      const value = item.Value !== undefined ? item.Value : 
                   item.value !== undefined ? item.value :
                   item.Last !== undefined ? item.Last :
                   item.last !== undefined ? item.last :
                   item.LatestValue !== undefined ? item.LatestValue :
                   item.latestValue !== undefined ? item.latestValue : null;
      
      const dateStr = item.Date !== undefined ? item.Date :
                     item.date !== undefined ? item.date :
                     item.DateTime !== undefined ? item.DateTime :
                     item.datetime !== undefined ? item.datetime :
                     item.LastUpdate !== undefined ? item.LastUpdate :
                     item.lastUpdate !== undefined ? item.lastUpdate : null;
      
      if (value === null || dateStr === null) {
        return null;
      }
      
      // Parsear fecha (formato puede variar: ISO string, timestamp, etc.)
      let date: Date;
      if (typeof dateStr === "string") {
        // Intentar parsear como ISO string
        date = new Date(dateStr);
        // Si falla, intentar otros formatos
        if (isNaN(date.getTime())) {
          // Formato "YYYY-MM-DD" o similar
          const parts = dateStr.split(/[-/]/);
          if (parts.length === 3) {
            date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
          } else {
            return null;
          }
        }
      } else if (typeof dateStr === "number") {
        // Timestamp
        date = new Date(dateStr * 1000);
      } else {
        return null;
      }
      
      if (isNaN(date.getTime())) {
        return null;
      }
      
      const numValue = Number(value);
      if (!Number.isFinite(numValue)) {
        return null;
      }
      
      return {
        indicator_id: `TE:${endpoint}`,
        date: date.toISOString().split("T")[0],
        value: numValue,
        revision: false,
        source_url: `https://tradingeconomics.com/${endpoint}`,
        released_at: date.toISOString(),
      };
    })
    .filter((o: Observation | null): o is Observation => o !== null) as Observation[];
  
  // Ordenar por fecha descendente (más reciente primero)
  observations.sort((a, b) => {
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    return dateB.getTime() - dateA.getTime();
  });
  
  return observations;
}

/**
 * Obtiene múltiples indicadores de Trading Economics
 */
export async function fetchTradingEconomicsMultiple(
  indicators: string[],
  apiKey: string,
): Promise<Record<string, Observation[]>> {
  const results: Record<string, Observation[]> = {};
  
  for (const indicator of indicators) {
    try {
      const observations = await fetchTradingEconomics(indicator, apiKey);
      results[indicator] = observations;
      // Rate limiting: esperar un poco entre requests
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      console.error(`Failed to fetch ${indicator}:`, error);
      results[indicator] = [];
    }
  }
  
  return results;
}
