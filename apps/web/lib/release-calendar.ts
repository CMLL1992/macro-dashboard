import { prisma } from "./prisma";

/**
 * Obtiene el próximo release de un indicador según su regla de calendario
 */
export async function getNextReleaseDate(indicatorId: string): Promise<Date | null> {
  const calendar = await prisma.releaseCalendar.findUnique({
    where: { indicatorId },
    include: { indicator: true },
  });

  if (!calendar) {
    return null;
  }

  // Si ya tenemos una fecha próxima calculada y no ha pasado, devolverla
  if (calendar.nextReleaseAt && calendar.nextReleaseAt > new Date()) {
    return calendar.nextReleaseAt;
  }

  // Calcular próxima fecha según regla textual
  const nextDate = calculateNextReleaseFromRule(calendar.ruleText, calendar.indicator.frequency);
  
  if (nextDate) {
    // Actualizar calendario
    await prisma.releaseCalendar.update({
      where: { indicatorId },
      data: {
        nextReleaseAt: nextDate,
        lastCheckedAt: new Date(),
      },
    });
  }

  return nextDate;
}

/**
 * Calcula la próxima fecha de release desde una regla textual
 * Ejemplos:
 * - "Primer viernes de cada mes, 8:30 ET"
 * - "Último martes de cada mes, 10:00 ET"
 * - "Cada día hábil ~18:00 ET"
 * - "Medio del mes, 8:30 ET"
 */
function calculateNextReleaseFromRule(ruleText: string, frequency: string): Date | null {
  const now = new Date();
  const etDate = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  
  // Reglas comunes
  if (ruleText.includes("Primer viernes")) {
    return getFirstFridayOfMonth(etDate);
  }
  
  if (ruleText.includes("Último martes")) {
    return getLastTuesdayOfMonth(etDate);
  }
  
  if (ruleText.includes("Cada día hábil")) {
    return getNextBusinessDay(etDate);
  }
  
  if (ruleText.includes("Medio del mes")) {
    return getMiddleOfMonth(etDate);
  }
  
  if (ruleText.includes("Última semana")) {
    return getLastWeekOfMonth(etDate);
  }
  
  if (ruleText.includes("Fines de enero, abril, julio, octubre")) {
    return getQuarterlyGDPDate(etDate);
  }
  
  // Por defecto, según frecuencia
  switch (frequency) {
    case "D":
      return getNextBusinessDay(etDate);
    case "W":
      return getNextFriday(etDate);
    case "M":
      return getNextMonthStart(etDate);
    case "Q":
      return getNextQuarterStart(etDate);
    default:
      return null;
  }
}

function getFirstFridayOfMonth(date: Date): Date {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  
  // Encontrar primer viernes
  let day = firstDay.getDay(); // 0 = domingo, 5 = viernes
  const daysUntilFriday = (5 - day + 7) % 7 || 7;
  const firstFriday = new Date(year, month, 1 + daysUntilFriday);
  
  // Si ya pasó este mes, buscar el siguiente
  if (firstFriday <= date) {
    const nextMonth = month + 1;
    return getFirstFridayOfMonth(new Date(year, nextMonth, 1));
  }
  
  return firstFriday;
}

function getLastTuesdayOfMonth(date: Date): Date {
  const year = date.getFullYear();
  const month = date.getMonth();
  const lastDay = new Date(year, month + 1, 0);
  
  // Encontrar último martes
  let day = lastDay.getDay();
  const daysUntilTuesday = (day - 2 + 7) % 7;
  const lastTuesday = new Date(year, month, lastDay.getDate() - daysUntilTuesday);
  
  if (lastTuesday <= date) {
    const nextMonth = month + 1;
    return getLastTuesdayOfMonth(new Date(year, nextMonth, 1));
  }
  
  return lastTuesday;
}

function getNextBusinessDay(date: Date): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + 1);
  
  // Saltar fines de semana
  while (next.getDay() === 0 || next.getDay() === 6) {
    next.setDate(next.getDate() + 1);
  }
  
  return next;
}

function getMiddleOfMonth(date: Date): Date {
  const year = date.getFullYear();
  const month = date.getMonth();
  const middle = new Date(year, month, 15);
  
  if (middle <= date) {
    const nextMonth = month + 1;
    return new Date(year, nextMonth, 15);
  }
  
  return middle;
}

function getLastWeekOfMonth(date: Date): Date {
  const year = date.getFullYear();
  const month = date.getMonth();
  const lastDay = new Date(year, month + 1, 0);
  const lastWeek = new Date(lastDay);
  lastWeek.setDate(lastWeek.getDate() - 6); // Inicio de última semana
  
  if (lastWeek <= date) {
    const nextMonth = month + 1;
    const nextLastDay = new Date(year, nextMonth + 1, 0);
    const nextLastWeek = new Date(nextLastDay);
    nextLastWeek.setDate(nextLastWeek.getDate() - 6);
    return nextLastWeek;
  }
  
  return lastWeek;
}

function getQuarterlyGDPDate(date: Date): Date {
  const year = date.getFullYear();
  const month = date.getMonth();
  
  // Fechas objetivo: fines de enero (30), abril (30), julio (30), octubre (30)
  const quarters = [
    { month: 0, day: 30 }, // Enero
    { month: 3, day: 30 }, // Abril
    { month: 6, day: 30 }, // Julio
    { month: 9, day: 30 }, // Octubre
  ];
  
  for (const q of quarters) {
    const targetDate = new Date(year, q.month, q.day);
    if (targetDate > date) {
      return targetDate;
    }
  }
  
  // Si ya pasó octubre, siguiente enero
  return new Date(year + 1, 0, 30);
}

function getNextFriday(date: Date): Date {
  const day = date.getDay();
  const daysUntilFriday = (5 - day + 7) % 7 || 7;
  const next = new Date(date);
  next.setDate(next.getDate() + daysUntilFriday);
  return next;
}

function getNextMonthStart(date: Date): Date {
  const next = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  return next;
}

function getNextQuarterStart(date: Date): Date {
  const quarter = Math.floor(date.getMonth() / 3);
  const nextQuarter = quarter + 1;
  const nextYear = date.getFullYear();
  const nextMonth = nextQuarter * 3;
  return new Date(nextYear, nextMonth, 1);
}

/**
 * Obtiene todos los próximos releases ordenados por fecha
 */
export async function getUpcomingReleases(limit: number = 10): Promise<Array<{
  indicatorId: string;
  indicatorName: string;
  nextReleaseAt: Date;
  ruleText: string;
}>> {
  const calendars = await prisma.releaseCalendar.findMany({
    include: { indicator: true },
  });

  const releases = await Promise.all(
    calendars.map(async (cal) => {
      const nextRelease = await getNextReleaseDate(cal.indicatorId);
      return {
        indicatorId: cal.indicatorId,
        indicatorName: cal.indicator.name,
        nextReleaseAt: nextRelease || cal.nextReleaseAt || new Date(),
        ruleText: cal.ruleText,
      };
    })
  );

  return releases
    .filter((r) => r.nextReleaseAt > new Date())
    .sort((a, b) => a.nextReleaseAt.getTime() - b.nextReleaseAt.getTime())
    .slice(0, limit);
}

