import { addDays, endOfMonth, isFriday, isSaturday, isSunday, startOfMonth } from 'date-fns'

export function toISO(d: Date) { return d.toISOString().slice(0, 10) }

function observedDate(d: Date): Date {
  // Si cae en sábado, observado viernes; si domingo, lunes
  if (isSaturday(d)) return addDays(d, -1)
  if (isSunday(d)) return addDays(d, 1)
  return d
}

export function nthWeekdayOfMonth(year: number, month0: number, weekday: number, n: number): Date {
  let d = startOfMonth(new Date(year, month0, 1))
  while (d.getDay() !== weekday) d = addDays(d, 1)
  for (let i = 1; i < n; i++) d = addDays(d, 7)
  return d
}

function lastWeekdayOfMonth(year: number, month0: number, weekday: number): Date {
  let d = endOfMonth(new Date(year, month0, 1))
  while (d.getDay() !== weekday) d = addDays(d, -1)
  return d
}

export function usHolidays(year: number): string[] {
  const out: string[] = []
  // New Year (Jan 1 observed)
  out.push(toISO(observedDate(new Date(year, 0, 1))))
  // MLK (3rd Mon Jan)
  out.push(toISO(nthWeekdayOfMonth(year, 0, 1, 3)))
  // Presidents (3rd Mon Feb)
  out.push(toISO(nthWeekdayOfMonth(year, 1, 1, 3)))
  // Memorial (last Mon May)
  out.push(toISO(lastWeekdayOfMonth(year, 4, 1)))
  // Juneteenth (Jun 19 observed)
  out.push(toISO(observedDate(new Date(year, 5, 19))))
  // Independence (Jul 4 observed)
  out.push(toISO(observedDate(new Date(year, 6, 4))))
  // Labor (1st Mon Sep)
  out.push(toISO(nthWeekdayOfMonth(year, 8, 1, 1)))
  // Columbus (2nd Mon Oct)
  out.push(toISO(nthWeekdayOfMonth(year, 9, 1, 2)))
  // Veterans (Nov 11 observed)
  out.push(toISO(observedDate(new Date(year, 10, 11))))
  // Thanksgiving (4th Thu Nov)
  out.push(toISO(nthWeekdayOfMonth(year, 10, 4, 4)))
  // Christmas (Dec 25 observed)
  out.push(toISO(observedDate(new Date(year, 11, 25))))
  return out
}

export function isBusinessDay(d: Date): boolean {
  const y = d.getFullYear(); const iso = toISO(d)
  if (isSaturday(d) || isSunday(d)) return false
  return !usHolidays(y).includes(iso)
}

export function nextBusinessDay(d: Date): Date {
  let t = d
  while (!isBusinessDay(t)) t = addDays(t, 1)
  return t
}

export function prevBusinessDay(d: Date): Date {
  let t = d
  while (!isBusinessDay(t)) t = addDays(t, -1)
  return t
}

export function nthBusinessDayOfMonth(year: number, month0: number, n: number): Date {
  let d = startOfMonth(new Date(year, month0, 1))
  let count = 0
  while (true) {
    if (isBusinessDay(d)) { count++; if (count === n) return d }
    d = addDays(d, 1)
  }
}

export function lastBusinessDayOfMonth(year: number, month0: number): Date {
  let d = endOfMonth(new Date(year, month0, 1))
  return prevBusinessDay(d)
}

export function firstFridayOfMonth(year: number, month0: number): Date {
  let d = startOfMonth(new Date(year, month0, 1))
  while (!isFriday(d)) d = addDays(d, 1)
  return nextBusinessDay(d)
}

export function lastTuesdayOfMonth(year: number, month0: number): Date {
  let d = endOfMonth(new Date(year, month0, 1))
  while (d.getDay() !== 2) d = addDays(d, -1)
  return nextBusinessDay(d)
}

export function nextMonthlyRule(today = new Date(), f: (y: number, m: number) => Date): string {
  const y = today.getFullYear(), m = today.getMonth()
  let d = f(y, m)
  if (d <= today) {
    const ny = m === 11 ? y + 1 : y
    const nm = m === 11 ? 0 : m + 1
    d = f(ny, nm)
  }
  return toISO(d)
}

export function nextReleaseFor(key: string, today = new Date()): string | null {
  const y = today.getFullYear(), m = today.getMonth()
  switch (key) {
    case 'T10Y2Y': case 'T10Y3M': case 'T5YIE': return null
    case 'ICSA': {
      let d = new Date(today)
      while (d.getDay() !== 4) d = addDays(d, 1)
      return toISO(nextBusinessDay(d))
    }
    case 'PCEPI': case 'PCEPILFE':
      return nextMonthlyRule(today, (Y, M) => lastBusinessDayOfMonth(Y, M))
    case 'CPIAUCSL': case 'CPILFESL':
      return nextMonthlyRule(today, (Y, M) => nthBusinessDayOfMonth(Y, M, 12))
    case 'PPIACO':
      return nextMonthlyRule(today, (Y, M) => nthBusinessDayOfMonth(Y, M, 10))
    case 'PAYEMS': case 'UNRATE':
      return nextMonthlyRule(today, (Y, M) => firstFridayOfMonth(Y, M))
    case 'INDPRO': case 'TCU':
      return nextMonthlyRule(today, (Y, M) => nthBusinessDayOfMonth(Y, M, 12))
    case 'RSXFS':
      return nextMonthlyRule(today, (Y, M) => nthBusinessDayOfMonth(Y, M, 8))
    case 'DGEXFI':
      return nextMonthlyRule(today, (Y, M) => lastBusinessDayOfMonth(Y, M))
    case 'HOUST':
      return nextMonthlyRule(today, (Y, M) => nthBusinessDayOfMonth(Y, M, 10))
    case 'NAHB':
      return nextMonthlyRule(today, (Y, M) => nthWeekdayOfMonth(Y, M, 1, 3))
    case 'UMCSENT':
      return nextMonthlyRule(today, (Y, M) => nthWeekdayOfMonth(Y, M, 5, 3))
    case 'NFCI': {
      let d = new Date(today)
      while (d.getDay() !== 5) d = addDays(d, 1)
      return toISO(nextBusinessDay(d))
    }
    case 'DTWEXBGS':
      return nextMonthlyRule(today, (Y, M) => nthBusinessDayOfMonth(Y, M, 3))
    case 'GDPC1': {
      const quarters = [0, 3, 6, 9]
      let yy = y, mm = m
      const nextQ = quarters.find(q => q >= m)
      if (nextQ === undefined) { yy = y + 1; mm = 0 } else { mm = nextQ }
      const d = lastBusinessDayOfMonth(yy, mm)
      return toISO(d)
    }
    case 'USPMI':
      return nextMonthlyRule(today, (Y, M) => nthBusinessDayOfMonth(Y, M, 1))
    case 'CONCCONF':
      return nextMonthlyRule(today, (Y, M) => lastTuesdayOfMonth(Y, M))
    case 'USSLIND':
      return nextMonthlyRule(today, (Y, M) => nthWeekdayOfMonth(Y, M, 4, 3))
    case 'U6RATE':
      return nextMonthlyRule(today, (Y, M) => firstFridayOfMonth(Y, M))
    default:
      return null
  }
}

export type EventMeta = { name: string; category: 'Empleo' | 'Inflación' | 'Actividad' | 'Confianza' | 'Política monetaria' | 'Financiero' | 'Vivienda' | 'Otro'; importance: 'alta' | 'media' | 'baja' }

export const EVENT_META: Record<string, EventMeta> = {
  // Empleo
  PAYEMS: { name: 'Nonfarm Payrolls (NFP)', category: 'Empleo', importance: 'alta' },
  UNRATE: { name: 'Unemployment rate (U3)', category: 'Empleo', importance: 'alta' },
  U6RATE: { name: 'Underemployment (U6)', category: 'Empleo', importance: 'media' },
  ICSA: { name: 'Jobless Claims (4W avg)', category: 'Empleo', importance: 'media' },
  JTSJOL: { name: 'JOLTS Job Openings', category: 'Empleo', importance: 'media' },
  JTSQUR: { name: 'Quits Rate', category: 'Empleo', importance: 'media' },
  // Inflación
  CPIAUCSL: { name: 'CPI (YoY)', category: 'Inflación', importance: 'alta' },
  CPILFESL: { name: 'Core CPI (YoY)', category: 'Inflación', importance: 'alta' },
  PCEPI: { name: 'PCE (YoY)', category: 'Inflación', importance: 'alta' },
  PCEPILFE: { name: 'Core PCE (YoY)', category: 'Inflación', importance: 'alta' },
  PPIACO: { name: 'PPI (YoY)', category: 'Inflación', importance: 'media' },
  // Actividad
  GDPC1: { name: 'Real GDP (YoY)', category: 'Actividad', importance: 'alta' },
  INDPRO: { name: 'Industrial Production (YoY)', category: 'Actividad', importance: 'media' },
  RSXFS: { name: 'Retail Sales (YoY)', category: 'Actividad', importance: 'media' },
  DGEXFI: { name: 'Durable Goods Orders (YoY)', category: 'Actividad', importance: 'media' },
  USSLIND: { name: 'Leading Index (LEI) (YoY)', category: 'Actividad', importance: 'media' },
  // Vivienda
  HOUST: { name: 'Housing Starts (YoY)', category: 'Vivienda', importance: 'media' },
  NAHB: { name: 'NAHB Index', category: 'Vivienda', importance: 'media' },
  // Confianza
  UMCSENT: { name: 'U. Michigan Sentiment', category: 'Confianza', importance: 'media' },
  CONCCONF: { name: 'Consumer Confidence (Conference Board)', category: 'Confianza', importance: 'media' },
  // Financieros / Divisa
  T10Y2Y: { name: 'Yield Curve 10Y–2Y', category: 'Financiero', importance: 'media' },
  T10Y3M: { name: 'Yield Curve 10Y–3M', category: 'Financiero', importance: 'media' },
  T5YIE: { name: 'Breakeven 5Y (infl. implícita)', category: 'Financiero', importance: 'media' },
  NFCI: { name: 'Chicago Fed NFCI', category: 'Financiero', importance: 'media' },
  DTWEXBGS: { name: 'USD Broad Index', category: 'Financiero', importance: 'media' },
  // Placeholders
  USPMI: { name: 'S&P Global PMI Manufacturing', category: 'Actividad', importance: 'media' },
  PMI_SERV: { name: 'S&P Global PMI Services', category: 'Actividad', importance: 'media' },
}

export type UpcomingEvent = { key: string; name: string; date: string; category: string; importance: 'alta' | 'media' | 'baja' }

export function getUpcomingWindow(items: { key: string }[], today = new Date(), days = 14): UpcomingEvent[] {
  const out: UpcomingEvent[] = []
  for (const it of items) {
    const next = nextReleaseFor(it.key, today)
    if (!next) continue
    const dt = new Date(next)
    const diff = (dt.getTime() - today.getTime()) / 86400000
    if (diff >= 0 && diff <= days) {
      const meta = EVENT_META[it.key] ?? { name: it.key, category: 'Otro', importance: 'baja' as const }
      out.push({ key: it.key, name: meta.name, date: next, category: meta.category, importance: meta.importance })
    }
  }
  const rank: Record<'alta' | 'media' | 'baja', number> = { alta: 0, media: 1, baja: 2 }
  out.sort((a, b) => (rank[a.importance] - rank[b.importance]) || a.date.localeCompare(b.date))
  return out
}


