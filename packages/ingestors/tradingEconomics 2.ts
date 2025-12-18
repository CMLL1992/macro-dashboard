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

type TradingEconomicsPoint = { date: string; value: number };

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
 * Normalize date to YYYY-MM-01 format (helper for generic function)
 */
function normalizeToMonthStart(dateStr: string): string | null {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

/**
 * Fetch with timeout helper (wrapper for generic function)
 */
async function fetchWithTimeoutGeneric(url: string, ms = 20000): Promise<Response> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(new Error("fetch timeout")), ms);
  try {
    return await fetch(url, { signal: ac.signal });
  } finally {
    clearTimeout(t);
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
/**
 * Fetch US ISM Manufacturing PMI from Trading Economics
 * Uses the generic fetchTradingEconomics function for consistency
 * 
 * @param apiKey Trading Economics API key
 * @returns Array of observations with normalized dates (YYYY-MM-01) and values
 */
export async function fetchUSPMIFromTradingEconomics(
  apiKey: string
): Promise<TradingEconomicsObservation[]> {
  return fetchTradingEconomics("ISM Manufacturing PMI", apiKey, "United States");
}

/**
 * Generic Trading Economics fetcher.
 * @param indicator - e.g. "ISM Manufacturing PMI"
 * @param apiKey - TE key or credentials string
 * @param country - e.g. "United States" or "japan" or "united kingdom"
 * @returns Array of observations with normalized dates (YYYY-MM-01) and values
 */
export async function fetchTradingEconomics(
  indicator: string,
  apiKey: string,
  country: string
): Promise<TradingEconomicsPoint[]> {
  if (!apiKey) throw new Error("TRADING_ECONOMICS_API_KEY missing");
  if (!indicator) throw new Error("TradingEconomics indicator missing");
  if (!country) throw new Error("TradingEconomics country missing");

  const countryEnc = encodeURIComponent(country);
  const indicatorEnc = encodeURIComponent(indicator);

  // Most common TE historical endpoint pattern used in your implementation:
  const url = `${TE_BASE}/historical/country/${countryEnc}/${indicatorEnc}?c=${encodeURIComponent(apiKey)}`;

  console.log("[tradingeconomics] Fetching", { country, indicator, url: url.replace(apiKey, "***") });

  const res = await fetchWithTimeoutGeneric(url, 20000);
  const contentType = res.headers.get("content-type") || "";

  const text = await res.text();
  const preview = text.slice(0, 300);

  console.log("[tradingeconomics] Response", {
    status: res.status,
    contentType,
    bodyPreview: preview,
  });

  if (!res.ok) {
    // surface TE errors clearly
    throw new Error(`TradingEconomics HTTP ${res.status}: ${preview}`);
  }

  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`TradingEconomics invalid JSON: ${preview}`);
  }

  if (!Array.isArray(json)) {
    throw new Error(`TradingEconomics unexpected payload: ${preview}`);
  }

  const points: TradingEconomicsPoint[] = [];
  for (const row of json) {
    const rawDate = row?.DateTime ?? row?.Date ?? row?.dateTime ?? row?.date;
    const rawVal = row?.Value ?? row?.value;

    const date = rawDate ? normalizeToMonthStart(String(rawDate)) : null;
    const value = Number(rawVal);

    if (!date) continue;
    if (!Number.isFinite(value)) continue;

    points.push({ date, value });
  }

  // sort ascending
  points.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  console.log("[tradingeconomics] Parsed points", {
    count: points.length,
    first: points[0]?.date,
    last: points[points.length - 1]?.date,
  });

  return points;
}
