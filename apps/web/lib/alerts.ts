import { prisma } from "./prisma";
import { ingestIndicator } from "./ingest";
import { getLatestAvailableValueForIndicator } from "./lav";

/**
 * Verifica si hay nuevos releases disponibles y dispara ingesta
 */
export async function checkForNewReleases(): Promise<Array<{
  indicatorId: string;
  indicatorName: string;
  ingested: boolean;
  error?: string;
}>> {
  const calendars = await prisma.releaseCalendar.findMany({
    include: { indicator: true },
    where: {
      nextReleaseAt: {
        lte: new Date(), // Fecha de release ya pasó
      },
    },
  });

  const results = [];

  for (const cal of calendars) {
    try {
      // Intentar ingesta
      const result = await ingestIndicator(cal.indicatorId);
      
      if (result.success) {
        // Actualizar próxima fecha de release
        await updateNextReleaseDate(cal.indicatorId);
        
        // Recalcular postura y score si es necesario
        await recalculatePostureAndScore(cal.indicatorId);
      }

      results.push({
        indicatorId: cal.indicatorId,
        indicatorName: cal.indicator.name,
        ingested: result.success,
        error: result.error,
      });
    } catch (error) {
      results.push({
        indicatorId: cal.indicatorId,
        indicatorName: cal.indicator.name,
        ingested: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return results;
}

/**
 * Actualiza la próxima fecha de release después de una ingesta exitosa
 */
async function updateNextReleaseDate(indicatorId: string): Promise<void> {
  const calendar = await prisma.releaseCalendar.findUnique({
    where: { indicatorId },
    include: { indicator: true },
  });

  if (!calendar) {
    return;
  }

  // Recalcular próxima fecha desde la regla
  const { getNextReleaseDate } = await import("./release-calendar");
  const nextRelease = await getNextReleaseDate(indicatorId);

  if (nextRelease) {
    await prisma.releaseCalendar.update({
      where: { indicatorId },
      data: {
        nextReleaseAt: nextRelease,
        lastCheckedAt: new Date(),
      },
    });
  }
}

/**
 * Recalcula postura y score después de una nueva ingesta
 */
async function recalculatePostureAndScore(indicatorId: string): Promise<void> {
  // Obtener LAV para el indicador
  const lavResult = await getLatestAvailableValueForIndicator(indicatorId);
  
  if (!lavResult.lav || !lavResult.posture) {
    return;
  }

  // Guardar/actualizar PostureSnapshot
  const snapshot = await prisma.postureSnapshot.upsert({
    where: {
      indicatorId_date: {
        indicatorId,
        date: new Date(lavResult.lav.last_date),
      },
    },
    create: {
      indicatorId,
      date: new Date(lavResult.lav.last_date),
      posture: lavResult.posture as "DOVISH" | "NEUTRAL" | "HAWKISH",
      numericValue: lavResult.numeric_value as number,
    },
    update: {
      posture: lavResult.posture as "DOVISH" | "NEUTRAL" | "HAWKISH",
      numericValue: lavResult.numeric_value as number,
    },
  });

  // Recalcular MacroScore (llamar al endpoint o función correspondiente)
  // Por ahora, solo logueamos - el score se recalculará en el próximo request
  console.log(`✅ Postura recalculada para ${indicatorId}: ${snapshot.posture} (${snapshot.numericValue})`);
}

/**
 * Obtiene alertas de nuevos datos disponibles
 */
export async function getNewDataAlerts(limit: number = 5): Promise<Array<{
  indicatorId: string;
  indicatorName: string;
  releasedAt: Date;
  value: number;
}>> {
  // Buscar observaciones recientes (últimas 24 horas)
  const yesterday = new Date();
  yesterday.setHours(yesterday.getHours() - 24);

  const recentObservations = await prisma.observation.findMany({
    where: {
      releasedAt: {
        gte: yesterday,
      },
    },
    include: {
      indicator: true,
    },
    orderBy: {
      releasedAt: "desc",
    },
    take: limit,
  });

  return recentObservations.map((obs) => ({
    indicatorId: obs.indicatorId,
    indicatorName: obs.indicator.name,
    releasedAt: obs.releasedAt || obs.date,
    value: obs.value,
  }));
}

