/**
 * Trading Economics API ingestor
 * Professional economic data provider
 * https://tradingeconomics.com/api
 */

import { fetchWithTimeout } from "@/lib/utils/http";

export interface TradingEconomicsObservation {
  date: string;
  value: number;
}

const TE_BASE = "https://api.tradingeconomics.com";

/**
 * Normalize date to YYYY-MM-01 format (first day of month for monthly series)
 */
function normalizeMonth(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) {
      throw new Error(`Invalid date: ${dateStr}`);
    }
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, "0");
    return `${year}-${month}-01`;
  } catch (error) {
    console.error(`[tradingeconomics] Failed to normalize date: ${dateStr}`, error);
    throw error;
  }
}

/**
 * Fetch US ISM Manufacturing PMI from Trading Economics
 * 
 * Endpoint: GET /historical/country/United%20States/ISM%20Manufacturing%20PMI
 * 
 * @param apiKey Trading Economics API key (format: "key" or "user:password")
 * @returns Array of observations with normalized dates (YYYY-MM-01) and values
 */
/**
 * Fetch US ISM Manufacturing PMI from Trading Economics
 * 
 * @param apiKey Trading Economics API key
 * @returns Array of observations with normalized dates (YYYY-MM-01) and values
 */
export async function fetchUSPMIFromTradingEconomics(
  apiKey: string
): Promise<TradingEconomicsObservation[]> {
  try {
    // Construct URL
    // Format: /historical/country/{country}/indicator/{indicator}/{start_date}/{end_date}?c={api_key}
    // Or without dates for all historical: /historical/country/{country}/indicator/{indicator}?c={api_key}
    const country = "united states"; // Use lowercase as per API docs
    const indicator = "ism manufacturing pmi"; // Use lowercase as per API docs
    const startDate = "2010-01-01"; // Start from 2010 for historical data
    const endDate = new Date().toISOString().split('T')[0]; // Today
    const url = `${TE_BASE}/historical/country/${encodeURIComponent(country)}/indicator/${encodeURIComponent(indicator)}/${startDate}/${endDate}?c=${apiKey}`;

    // Log request (mask API key)
    const maskedUrl = url.replace(/c=[^&]+/, 'c=***');
    console.log(`[tradingeconomics] Fetching USPMI from Trading Economics`, {
      url: maskedUrl,
    });

    // Fetch with timeout (20s as requested)
    const response = await fetchWithTimeout(url, { timeoutMs: 20000 });

    // Log response status
    console.log(`[tradingeconomics] Response status:`, {
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers.get('content-type'),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Parse JSON
    const data = await response.json();

    // Log response preview (first 400 chars)
    const responsePreview = JSON.stringify(data).substring(0, 400);
    console.log(`[tradingeconomics] Response body preview (first 400 chars):`, responsePreview);

    // Handle null response
    if (data === null) {
      console.warn(`[tradingeconomics] Received null response from Trading Economics`);
      throw new Error('Trading Economics API returned null - check API key and endpoint');
    }

    // Log response structure for debugging
    if (data && typeof data === 'object') {
      console.log(`[tradingeconomics] Response type: ${Array.isArray(data) ? 'array' : 'object'}`);
      if (!Array.isArray(data)) {
        console.log(`[tradingeconomics] Response keys:`, Object.keys(data));
      }
    }

    // Trading Economics may return object with error or data array
    let dataArray: any[] = [];
    
    if (Array.isArray(data)) {
      // Direct array response
      dataArray = data;
    } else if (data && typeof data === 'object') {
      // Check for common error patterns
      if (data['error']) {
        throw new Error(`Trading Economics API error: ${data['error']}`);
      }
      if (data['Error']) {
        throw new Error(`Trading Economics API error: ${data['Error']}`);
      }
      
      // Check if data is nested in a property
      if (Array.isArray(data['data'])) {
        dataArray = data['data'];
      } else if (Array.isArray(data['results'])) {
        dataArray = data['results'];
      } else if (Array.isArray(data['values'])) {
        dataArray = data['values'];
      } else {
        // Try to find any array property
        const arrayKey = Object.keys(data).find(key => Array.isArray(data[key]));
        if (arrayKey) {
          console.log(`[tradingeconomics] Found array in key: ${arrayKey}`);
          dataArray = data[arrayKey];
        } else {
          throw new Error(`Expected array or object with array property, got object with keys: ${Object.keys(data).join(', ')}`);
        }
      }
    } else {
      throw new Error(`Expected array or object, got ${typeof data}`);
    }

    if (dataArray.length === 0) {
      console.warn(`[tradingeconomics] Empty data array from Trading Economics`);
      return [];
    }

    // Map and normalize data
    const observations: TradingEconomicsObservation[] = dataArray
      .map((item: any) => {
        try {
          // Extract value
          const value = typeof item.Value === 'number' ? item.Value : parseFloat(item.Value);
          if (isNaN(value) || value <= 0 || value > 100) {
            // PMI is typically 0-100, filter invalid values
            return null;
          }

          // Extract and normalize date
          const dateStr = item.DateTime || item.LastUpdate || item.Date;
          if (!dateStr) {
            console.warn(`[tradingeconomics] Missing date in item:`, item);
            return null;
          }

          const normalizedDate = normalizeMonth(dateStr);

          return {
            date: normalizedDate,
            value: value,
          };
        } catch (error) {
          console.warn(`[tradingeconomics] Failed to parse item:`, item, error);
          return null;
        }
      })
      .filter((obs: TradingEconomicsObservation | null): obs is TradingEconomicsObservation => obs !== null);

    // Remove duplicates (same month, keep most recent)
    const byMonth = new Map<string, TradingEconomicsObservation>();
    for (const obs of observations) {
      const existing = byMonth.get(obs.date);
      if (!existing || obs.value !== existing.value) {
        // Keep if new or if value differs (prefer more recent)
        byMonth.set(obs.date, obs);
      }
    }

    const uniqueObservations = Array.from(byMonth.values());

    // Sort by date ascending
    uniqueObservations.sort((a, b) => a.date.localeCompare(b.date));

    // Log summary
    const minDate = uniqueObservations[0]?.date || null;
    const maxDate = uniqueObservations[uniqueObservations.length - 1]?.date || null;
    console.log(`[tradingeconomics] Parsed rows: ${uniqueObservations.length}`, {
      dateRange: minDate && maxDate ? `${minDate} → ${maxDate}` : 'N/A',
      minDate,
      maxDate,
    });

    return uniqueObservations;
  } catch (error) {
    console.error(`[tradingeconomics] Error fetching USPMI:`, error);
    throw error;
  }
}

// Alias de export para compatibilidad con imports existentes
export { fetchUSPMIFromTradingEconomics as fetchTradingEconomics };
