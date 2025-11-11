import { prisma } from "./prisma";
import { 
  findLatestAvailableValue, 
  calculateYoYTransformation, 
  calculateMonthlyChange,
  type LatestAvailableValue,
  type Frequency,
} from "@macro-dashboard/core";
import { computePosture } from "@macro-dashboard/core";
import type { Observation } from "@macro-dashboard/types";

/**
 * Mapea frecuencia del indicador a código de frecuencia LAV
 */
function mapFrequencyToLAV(frequency: string): Frequency {
  const freq = frequency.toUpperCase();
  if (freq.includes("DAILY") || freq === "D") return "D";
  if (freq.includes("WEEKLY") || freq === "W") return "W";
  if (freq.includes("QUARTERLY") || freq === "Q") return "Q";
  return "M"; // Default: mensual
}

/**
 * Obtiene el Latest Available Value para un indicador
 * Incluye transformaciones y cálculo de postura
 */
export async function getLatestAvailableValueForIndicator(
  indicatorId: string,
): Promise<{
  lav: LatestAvailableValue | null;
  posture: string | null;
  numeric_value: number | null;
  transformed_value: number | null;
  excluded_reason?: string;
}> {
  const indicator = await prisma.indicator.findUnique({
    where: { id: indicatorId },
    include: {
      observations: {
        orderBy: { date: "desc" },
        take: 100, // Aumentar a 100 para tener más histórico para transformaciones
      },
      postureRules: {
        take: 1,
      },
    },
  });

  if (!indicator) {
    return { lav: null, posture: null, numeric_value: null, transformed_value: null, excluded_reason: "Indicador no encontrado" };
  }

  // Verificar que haya observaciones en los últimos 24 meses
  const today = new Date();
  const twoYearsAgo = new Date(today);
  twoYearsAgo.setMonth(twoYearsAgo.getMonth() - 24);

  const recentObservations = indicator.observations.filter(
    (obs) => new Date(obs.date) >= twoYearsAgo
  );

  // Si no hay observaciones recientes, intentar con todas las observaciones disponibles
  const observationsToUse = recentObservations.length > 0 
    ? recentObservations 
    : indicator.observations;

  if (observationsToUse.length === 0) {
    return { 
      lav: null, 
      posture: null, 
      numeric_value: null, 
      transformed_value: null, 
      excluded_reason: "Sin datos disponibles" 
    };
  }

  // Obtener LAV según frecuencia
  const frequency = mapFrequencyToLAV(indicator.frequency);
  const lav = findLatestAvailableValue(observationsToUse as Observation[], frequency, today);

  if (!lav) {
    return { 
      lav: null, 
      posture: null, 
      numeric_value: null, 
      transformed_value: null, 
      excluded_reason: "No se encontró LAV válido" 
    };
  }

  // Aplicar transformaciones según regla de postura
  let transformedValue = lav.observation.value;
  let finalValue = transformedValue;

  if (indicator.postureRules.length > 0) {
    const rule = indicator.postureRules[0];
    if (rule) {
      const bands = typeof rule.bandsJson === "string" 
        ? JSON.parse(rule.bandsJson) 
        : rule.bandsJson;
      const numericMap = typeof rule.numericMap === "string"
        ? JSON.parse(rule.numericMap)
        : rule.numericMap;
      const thresholds = { bands, numericMap, transform: rule.transform };

      // Aplicar transformación si es necesaria
      if (rule.transform && typeof rule.transform === "string") {
        const transformType = rule.transform;
        
        if (transformType === "YoY_percent" || transformType === "YoY_percent_from_price_index") {
          const yoy = calculateYoYTransformation(
            lav.observation.value,
            lav.last_date,
            observationsToUse as Observation[]
          );
          if (yoy !== null) {
            transformedValue = yoy;
            finalValue = yoy;
          }
        } else if (transformType === "monthly_change_from_level") {
          const monthlyChange = calculateMonthlyChange(
            lav.observation.value,
            lav.last_date,
            observationsToUse as Observation[]
          );
          if (monthlyChange !== null) {
            // Convertir a miles si es NFP
            transformedValue = monthlyChange / 1000;
            finalValue = transformedValue;
          }
        }
      }

      // Calcular postura
      const snapshot = computePosture(
        {
        indicator_id: indicatorId,
        date: lav.last_date,
        value: finalValue,
        source_url: lav.source_url || "",
        released_at: lav.released_at || new Date().toISOString(),
      },
      { indicator_id: indicatorId, thresholds },
      );

      return {
        lav,
        posture: snapshot.posture,
        numeric_value: snapshot.numeric_value,
        transformed_value: transformedValue,
      };
    }
  }

  return {
    lav,
    posture: null,
    numeric_value: null,
    transformed_value: transformedValue,
  };
}

