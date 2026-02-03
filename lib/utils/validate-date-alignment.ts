/**
 * Validación de alineación de fechas según frecuencia de serie
 * Previene guardar fechas "inventadas" (ej: 2025-12-11 para series monthly debería ser 2025-12-01)
 */

export type Frequency = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'

/**
 * Normaliza frecuencia desde formato abreviado (FRED) a formato completo
 */
export function normalizeFrequency(freq: string | null | undefined): Frequency {
  if (!freq) return 'monthly' // default
  const f = freq.toLowerCase().trim()
  if (f === 'd' || f === 'daily') return 'daily'
  if (f === 'w' || f === 'weekly') return 'weekly'
  if (f === 'm' || f === 'monthly') return 'monthly'
  if (f === 'q' || f === 'quarterly') return 'quarterly'
  if (f === 'a' || f === 'annual' || f === 'yearly') return 'yearly'
  return 'monthly' // default
}

/**
 * Valida que una fecha esté alineada con la frecuencia esperada
 * @param date Fecha en formato YYYY-MM-DD
 * @param frequency Frecuencia esperada
 * @returns true si la fecha es válida, false si no está alineada
 */
export function isValidDateForFrequency(date: string, frequency: Frequency): boolean {
  const d = new Date(date)
  if (!Number.isFinite(d.getTime())) {
    return false
  }

  const year = d.getFullYear()
  const month = d.getMonth() + 1 // 1-12
  const day = d.getDate()

  switch (frequency) {
    case 'daily':
      // Cualquier día es válido
      return true

    case 'weekly':
      // Para weekly, aceptamos cualquier día (la frecuencia es semanal, no importa el día exacto)
      return true

    case 'monthly':
      // Debe ser día 01
      return day === 1

    case 'quarterly':
      // Debe ser día 01 y mes ∈ {01, 04, 07, 10}
      return day === 1 && [1, 4, 7, 10].includes(month)

    case 'yearly':
      // Debe ser 01-01
      return day === 1 && month === 1

    default:
      // Si no conocemos la frecuencia, aceptamos cualquier fecha
      return true
  }
}

/**
 * Normaliza una fecha al formato esperado para su frecuencia
 * @param date Fecha en formato YYYY-MM-DD
 * @param frequency Frecuencia esperada
 * @returns Fecha normalizada (YYYY-MM-DD) o null si no se puede normalizar
 */
export function normalizeDateForFrequency(date: string, frequency: Frequency): string | null {
  const d = new Date(date)
  if (!Number.isFinite(d.getTime())) {
    return null
  }

  const year = d.getFullYear()
  const month = d.getMonth() + 1 // 1-12
  const day = d.getDate()

  switch (frequency) {
    case 'daily':
      // Mantener fecha original
      return date

    case 'weekly':
      // Mantener fecha original (no hay estándar para weekly)
      return date

    case 'monthly':
      // Normalizar a día 01
      return `${year}-${String(month).padStart(2, '0')}-01`

    case 'quarterly':
      // Normalizar a primer día del trimestre
      let quarterMonth: number
      if (month <= 3) quarterMonth = 1
      else if (month <= 6) quarterMonth = 4
      else if (month <= 9) quarterMonth = 7
      else quarterMonth = 10
      return `${year}-${String(quarterMonth).padStart(2, '0')}-01`

    case 'yearly':
      // Normalizar a 01-01
      return `${year}-01-01`

    default:
      // Mantener fecha original
      return date
  }
}

/**
 * Filtra y normaliza puntos de una serie según su frecuencia
 * @param points Array de puntos con fecha
 * @param frequency Frecuencia esperada
 * @returns Array filtrado y normalizado (sin duplicados)
 */
export function filterAndNormalizeSeriesDates<T extends { date: string }>(
  points: T[],
  frequency: Frequency,
): T[] {
  const seen = new Set<string>()
  const result: T[] = []

  for (const point of points) {
    const normalized = normalizeDateForFrequency(point.date, frequency)
    if (!normalized) {
      // Fecha inválida, saltar
      continue
    }

    // Si ya existe esta fecha normalizada, usar el último valor (deduplicación)
    if (seen.has(normalized)) {
      // Reemplazar el punto existente con este nuevo (mantener el más reciente)
      const existingIndex = result.findIndex(p => {
        const pNormalized = normalizeDateForFrequency(p.date, frequency)
        return pNormalized === normalized
      })
      if (existingIndex >= 0) {
        result[existingIndex] = { ...point, date: normalized }
      }
    } else {
      seen.add(normalized)
      result.push({ ...point, date: normalized })
    }
  }

  // Ordenar por fecha
  result.sort((a, b) => a.date.localeCompare(b.date))

  return result
}
