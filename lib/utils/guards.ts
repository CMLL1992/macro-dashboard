/**
 * Type guards and safe helpers to prevent runtime crashes
 * 
 * Rule of thumb: Almost all "ALTA" crashes are:
 * - .map/.filter/.reduce on non-arrays
 * - Object.entries on undefined/null
 * - toFixed with invalid decimals
 * - new Date(x) with invalid date and then .toISOString() or .toLocale...
 * - Chained property access without checking structure
 * 
 * These helpers provide safe defaults and type guards without adding new features.
 */

/**
 * Type guard: checks if value is a record (object, not array, not null)
 */
export const isRecord = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);

/**
 * Type guard: checks if value is an array
 */
export const isArray = <T = unknown>(v: unknown): v is T[] => Array.isArray(v);

/**
 * Type guard: checks if value is a finite number (not NaN, not Infinity)
 */
export const isFiniteNumber = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);

/**
 * Safe array: returns array if valid, empty array otherwise
 */
export const safeArray = <T = unknown>(v: unknown): T[] =>
  Array.isArray(v) ? (v as T[]) : [];

/**
 * Safe record: returns record if valid, empty object otherwise
 */
export const safeRecord = (v: unknown): Record<string, unknown> =>
  isRecord(v) ? v : {};

/**
 * Checks if value can be converted to a valid Date
 */
export const isValidDateValue = (v: unknown): boolean => {
  if (v === null || v === undefined) return false;
  const d = v instanceof Date ? v : new Date(v as any);
  return !Number.isNaN(d.getTime());
};

/**
 * Safe date: returns Date if valid, null otherwise
 */
export const safeDate = (v: unknown): Date | null =>
  isValidDateValue(v) ? new Date(v as any) : null;

/**
 * Safe string: returns string if valid, empty string otherwise
 */
export const safeString = (v: unknown): string =>
  typeof v === "string" ? v : "";

/**
 * Safe number: returns number if valid, 0 otherwise
 */
export const safeNumber = (v: unknown): number =>
  isFiniteNumber(v) ? v : 0;
