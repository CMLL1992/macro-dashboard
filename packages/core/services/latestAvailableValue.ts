import type { DataPoint } from "@/lib/types/macro";

type Observation = DataPoint & {
  released_at?: string;
  source_url?: string;
};

export type Frequency = "D" | "W" | "M" | "Q";
export type FreshnessStatus = "fresh" | "stale" | "old";

export interface FreshnessPolicy {
  frequency: Frequency;
  max_age_days: number;
  description: string;
}

export interface LatestAvailableValue {
  observation: Observation;
  transformed_value: number;
  last_date: string; // YYYY-MM-DD
  released_at: string; // ISO datetime
  source_url: string;
  freshness_status: FreshnessStatus;
  age_days: number;
  next_release_at?: string;
}

/**
 * Políticas de frescura por frecuencia según especificación
 */
export const FRESHNESS_POLICIES: Record<Frequency, FreshnessPolicy> = {
  D: {
    frequency: "D",
    max_age_days: 7,
    description: "Diario: último día hábil ≤ hoy",
  },
  W: {
    frequency: "W",
    max_age_days: 21,
    description: "Semanal: último dato de semana cerrada",
  },
  M: {
    frequency: "M",
    max_age_days: 75,
    description: "Mensual: último mes publicado",
  },
  Q: {
    frequency: "Q",
    max_age_days: 140,
    description: "Trimestral: último trimestre publicado",
  },
};

/**
 * Calcula el estado de frescura según días de antigüedad
 */
export function calculateFreshnessStatus(ageDays: number, maxAgeDays: number): FreshnessStatus {
  const ratio = ageDays / maxAgeDays;
  if (ratio < 0.5) return "fresh"; // <50% del max_age
  if (ratio < 1.0) return "stale"; // 50-100% del max_age
  return "old"; // >100% del max_age
}

/**
 * Encuentra el Latest Available Value para un indicador
 * según su frecuencia y política de frescura
 */
export function findLatestAvailableValue(
  observations: Observation[],
  frequency: Frequency,
  today: Date = new Date(),
): LatestAvailableValue | null {
  if (observations.length === 0) return null;

  const policy = FRESHNESS_POLICIES[frequency];
  
  // Ordenar por fecha descendente (más reciente primero)
  const sorted = [...observations].sort((a, b) => {
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    return dateB.getTime() - dateA.getTime();
  });

  // Encontrar el último dato válido según frecuencia
  let latestObs: Observation | null = null;

  for (const obs of sorted) {
    const obsDate = new Date(obs.date);
    const ageDays = Math.floor((today.getTime() - obsDate.getTime()) / (1000 * 60 * 60 * 24));

    // Verificar que no sea futuro (error de origen)
    if (obsDate > today) continue;

    // Para frecuencia mensual, buscar último mes publicado
    if (frequency === "M") {
      // Aceptar si es del mes actual o anterior
      const obsMonth = obsDate.getMonth();
      const obsYear = obsDate.getFullYear();
      const todayMonth = today.getMonth();
      const todayYear = today.getFullYear();
      
      // Si el mes actual no existe, usar el anterior
      if (obsYear < todayYear || (obsYear === todayYear && obsMonth < todayMonth) || obsMonth === todayMonth) {
        latestObs = obs;
        break;
      }
    }
    // Para frecuencia trimestral
    else if (frequency === "Q") {
      const obsQuarter = Math.floor(obsDate.getMonth() / 3);
      const obsYear = obsDate.getFullYear();
      const todayQuarter = Math.floor(today.getMonth() / 3);
      const todayYear = today.getFullYear();
      
      if (obsYear < todayYear || (obsYear === todayYear && obsQuarter <= todayQuarter)) {
        latestObs = obs;
        break;
      }
    }
    // Para frecuencia semanal
    else if (frequency === "W") {
      // Aceptar último dato de semana cerrada
      latestObs = obs;
      break;
    }
    // Para frecuencia diaria
    else {
      // Aceptar último día hábil
      latestObs = obs;
      break;
    }
  }

  if (!latestObs) return null;

  const obsDate = new Date(latestObs.date);
  const ageDays = Math.floor((today.getTime() - obsDate.getTime()) / (1000 * 60 * 60 * 24));
  const freshnessStatus = calculateFreshnessStatus(ageDays, policy.max_age_days);

  return {
    observation: latestObs,
    transformed_value: latestObs.value ?? 0, // Se calculará transformación después si es necesario
    last_date: obsDate.toISOString().split("T")[0],
    released_at: latestObs.released_at ?? '',
    source_url: latestObs.source_url ?? '',
    freshness_status: freshnessStatus,
    age_days: ageDays,
  };
}

/**
 * Calcula transformación YoY para un valor dado
 * Busca el valor de hace 12 meses (o el más cercano)
 */
export function calculateYoYTransformation(
  currentValue: number,
  currentDate: string,
  observations: Observation[],
): number | null {
  const currentDateObj = new Date(currentDate);
  const targetDate = new Date(currentDateObj);
  targetDate.setMonth(targetDate.getMonth() - 12);

  // Buscar observación más cercana a hace 12 meses (tolerancia de 30 días)
  const prevObs = observations.find((obs) => {
    const obsDate = new Date(obs.date);
    const diff = Math.abs(obsDate.getTime() - targetDate.getTime());
    return diff < 30 * 24 * 60 * 60 * 1000; // ~30 días de tolerancia
  });

  if (!prevObs || prevObs.value == null || prevObs.value <= 0) return null;

  return ((currentValue / prevObs.value) - 1) * 100;
}

/**
 * Calcula cambio mensual (Δ mensual)
 */
export function calculateMonthlyChange(
  currentValue: number,
  currentDate: string,
  observations: Observation[],
): number | null {
  const currentDateObj = new Date(currentDate);
  const targetDate = new Date(currentDateObj);
  targetDate.setMonth(targetDate.getMonth() - 1);

  const prevObs = observations.find((obs) => {
    const obsDate = new Date(obs.date);
    const diff = Math.abs(obsDate.getTime() - targetDate.getTime());
    return diff < 15 * 24 * 60 * 60 * 1000; // ~15 días de tolerancia
  });

  if (!prevObs || prevObs.value == null) return null;

  return currentValue - prevObs.value;
}

