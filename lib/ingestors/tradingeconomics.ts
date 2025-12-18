import { fetchWithTimeout } from "@/lib/utils/http";
import type { DataPoint } from "@/lib/types/macro";

type Observation = DataPoint & {
  released_at?: string;
  source_url?: string;
  indicator_id?: string;
  revision?: boolean;
};

// Constantes para retries
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 2000; // 2 segundos base

// Tipos de error de TradingEconomics
export enum TradingEconomicsErrorType {
  RATE_LIMIT = 'TE_RATE_LIMIT',
  AUTH = 'TE_AUTH',
  BAD_REQUEST = 'TE_BAD_REQUEST',
  SERVER = 'TE_SERVER',
  UNKNOWN = 'TE_UNKNOWN',
}

export interface TradingEconomicsError extends Error {
  type: TradingEconomicsErrorType;
  statusCode: number;
  endpoint: string;
  symbol?: string;
  dateRange?: string;
  responseBody?: string;
}

/**
 * Sleep helper para retries
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Clasifica el tipo de error según el status code y el mensaje
 */
function classifyError(status: number, responseBody: string): TradingEconomicsErrorType {
  const bodyLower = responseBody.toLowerCase();
  
  if (status === 409 || status === 429) {
    if (bodyLower.includes('rate limit') || bodyLower.includes('too many requests') || bodyLower.includes('conflict')) {
      return TradingEconomicsErrorType.RATE_LIMIT;
    }
    return TradingEconomicsErrorType.RATE_LIMIT; // 409/429 son generalmente rate limits
  }
  
  if (status === 401 || status === 403) {
    return TradingEconomicsErrorType.AUTH;
  }
  
  if (status === 400 || status === 404) {
    return TradingEconomicsErrorType.BAD_REQUEST;
  }
  
  if (status >= 500) {
    return TradingEconomicsErrorType.SERVER;
  }
  
  return TradingEconomicsErrorType.UNKNOWN;
}

/**
 * HTTP GET con retries y mejor manejo de errores
 */
async function httpGetWithRetry(
  url: string,
  endpoint: string,
  symbol?: string,
  dateRange?: string
): Promise<any> {
  let lastError: TradingEconomicsError | null = null;
  let responseBody = '';
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetchWithTimeout(url);
      
      // Intentar leer el body antes de verificar status
      // Esto es importante para tener el mensaje de error completo
      try {
        responseBody = await response.text();
      } catch (e) {
        responseBody = `Unable to read response body: ${e instanceof Error ? e.message : String(e)}`;
      }
      
      if (response.ok) {
        // Si la respuesta es OK, parsear el JSON
        try {
          return JSON.parse(responseBody);
        } catch (e) {
          // Si no es JSON válido pero el status es OK, devolver el body como string
          throw new Error(`Response is not valid JSON: ${responseBody.substring(0, 200)}`);
        }
      }
      
      const status = response.status;
      const errorType = classifyError(status, responseBody);
      
      // Si es un error recuperable (rate limit) y aún hay intentos, hacer retry
      if ((status === 409 || status === 429) && attempt < MAX_RETRIES) {
        const delayMs = BASE_DELAY_MS * Math.pow(2, attempt - 1); // Backoff exponencial
        console.warn(
          `[TradingEconomics] Rate limit (${status}) on attempt ${attempt}/${MAX_RETRIES} for ${endpoint}. ` +
          `Retrying in ${delayMs}ms... Response: ${responseBody.substring(0, 200)}`
        );
        await sleep(delayMs);
        continue;
      }
      
      // Si no es recuperable o ya no hay más intentos, crear error detallado
      const error: TradingEconomicsError = {
        name: 'TradingEconomicsError',
        message: `HTTP ${status}: ${response.statusText}`,
        type: errorType,
        statusCode: status,
        endpoint,
        symbol,
        dateRange,
        responseBody: responseBody.substring(0, 500), // Limitar tamaño del body en el error
      } as TradingEconomicsError;
      
      lastError = error;
      
      // Si no es un error recuperable, lanzar inmediatamente
      if (status !== 409 && status !== 429) {
        throw error;
      }
      
    } catch (error) {
      // Si es nuestro error tipado, propagarlo
      if (error && typeof error === 'object' && 'type' in error) {
        lastError = error as TradingEconomicsError;
        if (attempt < MAX_RETRIES && (error as TradingEconomicsError).type === TradingEconomicsErrorType.RATE_LIMIT) {
          const delayMs = BASE_DELAY_MS * Math.pow(2, attempt - 1);
          console.warn(`[TradingEconomics] Retrying after error on attempt ${attempt}/${MAX_RETRIES}...`);
          await sleep(delayMs);
          continue;
        }
        throw error;
      }
      
      // Si es otro tipo de error (network, timeout, etc.), crear error genérico
      lastError = {
        name: 'TradingEconomicsError',
        message: error instanceof Error ? error.message : String(error),
        type: TradingEconomicsErrorType.UNKNOWN,
        statusCode: 0,
        endpoint,
        symbol,
        dateRange,
        responseBody: error instanceof Error ? error.message : String(error),
      } as TradingEconomicsError;
      
      // Para errores de red, no hacer retry (probablemente no ayudará)
      throw lastError;
    }
  }
  
  // Si llegamos aquí, todos los intentos fallaron
  if (lastError) {
    console.error(
      `[TradingEconomics] All ${MAX_RETRIES} attempts failed for ${endpoint}. ` +
      `Last error: ${lastError.statusCode} ${lastError.message}. ` +
      `Response: ${lastError.responseBody}`
    );
    throw lastError;
  }
  
  throw new Error(`Unable to fetch data from Trading Economics for ${endpoint}`);
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
  // Mapeo de endpoints conocidos a nombres exactos de Trading Economics
  const endpointMap: Record<string, string> = {
    // United States
    "united-states/manufacturing-pmi": "manufacturing pmi",
    "united-states/services-pmi": "services pmi",
    "united-states/consumer-confidence": "consumer confidence",
    "united-states/michigan-consumer-sentiment": "consumer sentiment",
    "united-states/building-permits": "building permits",
    "united-states/housing-starts": "housing starts",
    "united-states/new-home-sales": "new home sales",
    "united-states/retail-sales": "retail sales",
    "united-states/industrial-production": "industrial production",
    // United Kingdom
    "united-kingdom/gdp-growth": "gdp",
    "united-kingdom/gdp-growth-annual": "gdp",
    "united-kingdom/services-pmi": "services pmi",
    "united-kingdom/manufacturing-pmi": "manufacturing pmi",
    "united-kingdom/retail-sales-yoy": "retail sales yoy",
    "united-kingdom/inflation-cpi": "inflation cpi",
    "united-kingdom/core-inflation-rate": "core inflation rate",
    "united-kingdom/producer-prices": "producer prices",
    "united-kingdom/unemployment-rate": "unemployment rate",
    "united-kingdom/wage-growth": "wage growth",
    "united-kingdom/interest-rate": "interest rate",
    // Japan
    "japan/gdp-growth": "gdp",
    "japan/gdp-growth-annual": "gdp",
    "japan/industrial-production": "industrial production",
    "japan/retail-sales-yoy": "retail sales yoy",
    "japan/tankan-large-manufacturing-index": "tankan large manufacturing index",
    "japan/services-pmi": "services pmi",
    "japan/inflation-cpi": "inflation cpi",
    "japan/core-inflation-rate": "core inflation rate",
    "japan/producer-prices": "producer prices",
    "japan/unemployment-rate": "unemployment rate",
    "japan/jobs-to-applicants-ratio": "jobs to applicants ratio",
    "japan/interest-rate": "interest rate",
    // Australia
    "australia/gdp-growth": "gdp",
    "australia/gdp-growth-annual": "gdp",
    "australia/services-pmi": "services pmi",
    "australia/manufacturing-pmi": "manufacturing pmi",
    "australia/retail-sales-yoy": "retail sales yoy",
    "australia/inflation-cpi": "inflation cpi",
    "australia/core-inflation-rate": "core inflation rate",
    "australia/unemployment-rate": "unemployment rate",
    "australia/interest-rate": "interest rate",
    // Eurozone indicators
    "retail sales yoy": "retail sales yoy",
    "industrial production yoy": "industrial production yoy",
    "pmi composite": "pmi composite",
    "retail sales": "retail sales",
    "industrial production": "industrial production",
  };
  
  // Si está en el mapa, usar el valor mapeado
  const lowerEndpoint = endpoint.toLowerCase().trim()
  if (endpointMap[lowerEndpoint]) {
    return endpointMap[lowerEndpoint];
  }
  
  // Si no, intentar extraer el nombre del indicador
  const parts = endpoint.split("/");
  if (parts.length === 2) {
    const indicatorPart = parts[1].toLowerCase();
    // Si ya está mapeado, devolverlo
    if (endpointMap[lowerEndpoint]) {
      return endpointMap[lowerEndpoint];
    }
    // Convertir kebab-case a espacios (ej: "gdp-growth" -> "gdp growth")
    return indicatorPart.replace(/-/g, " ");
  }
  
  // Si el endpoint ya está en formato correcto (con espacios y mayúsculas), devolverlo
  if (endpoint.includes(' ') && endpoint.match(/[A-Z]/)) {
    return endpoint;
  }
  
  // Convertir formato snake_case o kebab-case a espacios en minúsculas
  return endpoint.replace(/-/g, " ").replace(/_/g, " ").toLowerCase();
}

/**
 * Obtiene datos de Trading Economics para un indicador específico
 * Intenta múltiples endpoints si el primero falla
 * Implementa retries con backoff para errores 409/429
 */
export async function fetchTradingEconomics(
  endpoint: string,
  apiKey: string,
  country?: string,
): Promise<Observation[]> {
  const mappedIndicator = mapTradingEconomicsEndpoint(endpoint);
  const defaultCountry = country || "united states";
  
  // Detectar si es un indicador de Eurozona
  const isEurozoneIndicator = endpoint.includes('eurozone') || 
                              endpoint.includes('euro-area') || 
                              endpoint.includes('euro area') ||
                              country === 'euro area' ||
                              country === 'eurozone';
  
  // Reducir rango temporal para evitar problemas (últimos 5 años en vez de desde 2010)
  const today = new Date().toISOString().split('T')[0];
  const fiveYearsAgo = new Date();
  fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
  const startDate = fiveYearsAgo.toISOString().split('T')[0]; // Últimos 5 años
  const dateParams = `&d1=${startDate}&d2=${today}`;
  const dateRange = `${startDate} to ${today}`;
  
  const endpoints = isEurozoneIndicator ? [
    // PRIORIDAD 1: Historical sin rango de fechas (devuelve todos los datos, más recientes al final)
    {
      url: `${TE_BASE}/historical/country/euro%20area/indicator/${encodeURIComponent(mappedIndicator)}?c=${encodeURIComponent(apiKey)}`,
      description: `historical/country/euro area/indicator/${mappedIndicator} (all data)`,
    },
    // PRIORIDAD 2: Historical con rango de fechas más corto
    {
      url: `${TE_BASE}/historical/country/euro%20area/indicator/${encodeURIComponent(mappedIndicator)}?c=${encodeURIComponent(apiKey)}${dateParams}`,
      description: `historical/country/euro area/indicator/${mappedIndicator} (last 5 years)`,
    },
    // PRIORIDAD 3: Endpoint de indicador actual (puede no estar disponible para todos)
    {
      url: `${TE_BASE}/indicator/${encodeURIComponent(mappedIndicator)}?country=euro%20area&c=${encodeURIComponent(apiKey)}`,
      description: `indicator/${mappedIndicator} for euro area`,
    },
  ] : [
    // Para otros países, mismo patrón
    {
      url: `${TE_BASE}/indicator/${encodeURIComponent(mappedIndicator)}?country=${encodeURIComponent(defaultCountry)}&c=${encodeURIComponent(apiKey)}`,
      description: `indicator/${mappedIndicator} for ${defaultCountry}`,
    },
    {
      url: `${TE_BASE}/historical/country/${encodeURIComponent(defaultCountry)}/indicator/${encodeURIComponent(mappedIndicator)}?c=${encodeURIComponent(apiKey)}${dateParams}`,
      description: `historical/country/${defaultCountry}/indicator/${mappedIndicator} (last 5 years)`,
    },
  ];
  
  let lastError: TradingEconomicsError | null = null;
  
  for (const endpointConfig of endpoints) {
    const { url, description } = endpointConfig;
    try {
      console.log(`[TradingEconomics] Trying ${description} for ${endpoint}`);
      
      // Usar httpGetWithRetry que maneja retries automáticamente
      const data = await httpGetWithRetry(url, endpoint, mappedIndicator, dateRange);
      
      // Si llegamos aquí, la petición fue exitosa
      const observations = parseTradingEconomicsResponse(data, endpoint);
      
      if (observations.length > 0) {
        console.log(`[TradingEconomics] Successfully fetched ${observations.length} observations for ${endpoint} from ${description}`);
        return observations;
      } else {
        // Empty data, try next endpoint
        console.warn(`[TradingEconomics] Endpoint ${description} returned empty data for ${endpoint}`);
        continue;
      }
    } catch (error) {
      const teError = error as TradingEconomicsError;
      lastError = teError;
      
      // Log detallado del error
      console.error(
        `[TradingEconomics] Endpoint ${description} failed for ${endpoint}: ` +
        `Type: ${teError.type}, Status: ${teError.statusCode}, ` +
        `Message: ${teError.message}, ` +
        `Response: ${teError.responseBody?.substring(0, 200)}`
      );
      
      // Si es un error de autenticación o bad request, no intentar otros endpoints
      if (teError.type === TradingEconomicsErrorType.AUTH || 
          teError.type === TradingEconomicsErrorType.BAD_REQUEST) {
        throw teError;
      }
      
      // Para rate limits, continuar con el siguiente endpoint (ya se hizo retry en httpGetWithRetry)
      if (teError.type === TradingEconomicsErrorType.RATE_LIMIT) {
        console.warn(`[TradingEconomics] Rate limit encountered, trying next endpoint...`);
        // Esperar un poco antes de intentar el siguiente endpoint
        await sleep(1000);
        continue;
      }
      
      // Para otros errores, continuar con el siguiente endpoint
      continue;
    }
  }
  
  // Si todos los endpoints fallaron, lanzar el último error con contexto completo
  if (lastError) {
    const errorMessage = 
      `All Trading Economics endpoints failed for ${endpoint}. ` +
      `Last error: ${lastError.type} (${lastError.statusCode}) - ${lastError.message}. ` +
      `Endpoint tried: ${lastError.endpoint}, Symbol: ${lastError.symbol || 'N/A'}, ` +
      `Date range: ${lastError.dateRange || 'N/A'}. ` +
      `Response: ${lastError.responseBody || 'N/A'}`;
    
    console.error(`[TradingEconomics] ${errorMessage}`);
    throw new Error(errorMessage);
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
    console.warn(`[TradingEconomics] Empty data for ${endpoint}. Data structure:`, Object.keys(data || {}));
    return [];
  }
  
  const observations = series
    .map((item: any): Observation | null => {
      // Trading Economics puede devolver diferentes formatos de campo
      // PRIORIDAD: actual/latestValue primero (valores más recientes), luego Value/Last
      const value = item.actual !== undefined ? item.actual :
                   item.Actual !== undefined ? item.Actual :
                   item.latestValue !== undefined ? item.latestValue :
                   item.LatestValue !== undefined ? item.LatestValue :
                   item.Value !== undefined ? item.Value : 
                   item.value !== undefined ? item.value :
                   item.Last !== undefined ? item.Last :
                   item.last !== undefined ? item.last : null;
      
      // PRIORIDAD: latestValueDate primero (fecha del valor más reciente), luego Date/LastUpdate
      const dateStr = item.latestValueDate !== undefined ? item.latestValueDate :
                     item.LatestValueDate !== undefined ? item.LatestValueDate :
                     item.Date !== undefined ? item.Date :
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
      
      // Para indicadores mensuales (PMIs), usar el mes del dato, no el día 1
      // Si la fecha es "2025-10-01" pero el dato corresponde a octubre, mantener octubre
      // Para PMIs, la fecha debería ser el mes del release, no el día 1
      let normalizedDate = date.toISOString().split("T")[0]
      
      // Detectar si es un PMI (indicadores mensuales que se publican a principios de mes)
      const isPMI = endpoint.toLowerCase().includes('pmi') || 
                   endpoint.toLowerCase().includes('manufacturing') ||
                   endpoint.toLowerCase().includes('services') ||
                   endpoint.toLowerCase().includes('composite')
      
      if (isPMI && date.getDate() === 1) {
        // Para PMIs, si la fecha es día 1, es el mes del dato
        // Mantener la fecha como está (ya representa el mes correcto)
        // El formateo en formatIndicatorDate mostrará "Oct 2025" correctamente
      }
      
      return {
        indicator_id: `TE:${endpoint}`,
        date: normalizedDate,
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
 * Obtiene múltiples indicadores de Trading Economics con throttling
 */
export async function fetchTradingEconomicsMultiple(
  indicators: string[],
  apiKey: string,
  throttleMs: number = 2000, // 2 segundos entre llamadas por defecto
): Promise<Record<string, Observation[]>> {
  const results: Record<string, Observation[]> = {};
  
  for (let i = 0; i < indicators.length; i++) {
    const indicator = indicators[i];
    try {
      console.log(`[TradingEconomics] Fetching ${indicator} (${i + 1}/${indicators.length})`);
      const observations = await fetchTradingEconomics(indicator, apiKey);
      results[indicator] = observations;
      
      // Throttling: esperar entre requests (excepto el último)
      if (i < indicators.length - 1) {
        await sleep(throttleMs);
      }
    } catch (error) {
      const teError = error as TradingEconomicsError;
      console.error(
        `[TradingEconomics] Failed to fetch ${indicator}: ` +
        `Type: ${teError.type}, Status: ${teError.statusCode}, ` +
        `Message: ${teError.message}`
      );
      results[indicator] = [];
    }
  }
  
  return results;
}

/**
 * Fetch US ISM Manufacturing PMI from Trading Economics
 * Wrapper around fetchTradingEconomics for USPMI specifically
 * 
 * @param apiKey Trading Economics API key
 * @returns Array of observations with normalized dates (YYYY-MM-01) and values
 */
export async function fetchUSPMIFromTradingEconomics(
  apiKey: string
): Promise<Observation[]> {
  if (!apiKey) {
    throw new Error("TE_API_KEY missing");
  }
  
  // Use the generic fetchTradingEconomics function
  return fetchTradingEconomics("ISM Manufacturing PMI", apiKey, "United States");
}
