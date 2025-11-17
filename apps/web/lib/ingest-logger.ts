import { prisma } from "./prisma";

export interface IngestionAttempt {
  indicator_id: string;
  source_api: string;
  success: boolean;
  error?: string;
  observation_count?: number;
  timestamp: Date;
}

/**
 * Registra un intento de ingesta de datos
 */
export async function logIngestionAttempt(
  indicatorId: string,
  sourceApi: string,
  success: boolean,
  error?: string,
  observationCount?: number
): Promise<void> {
  try {
    // Guardar en AuditLog para trazabilidad
    await prisma.auditLog.create({
      data: {
        actorId: "system", // Sistema automático
        action: `INGEST_ATTEMPT_${sourceApi}`,
        meta: JSON.stringify({
          indicator_id: indicatorId,
          source_api: sourceApi,
          success,
          error: error || null,
          observation_count: observationCount || 0,
          timestamp: new Date().toISOString(),
        }),
      },
    });
  } catch (err) {
    // No fallar si el logging falla
    console.error("Failed to log ingestion attempt:", err);
  }
}

/**
 * Obtiene el historial de intentos de ingesta para un indicador
 */
export async function getIngestionHistory(indicatorId: string): Promise<IngestionAttempt[]> {
  try {
    const logs = await prisma.auditLog.findMany({
      where: {
        action: {
          startsWith: "INGEST_ATTEMPT_",
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 50, // Obtener más logs para filtrar después
    });

    return logs
      .map((log) => {
        const meta = typeof log.meta === "string" ? JSON.parse(log.meta) : log.meta;
        // Filtrar por indicator_id en el meta
        if (meta?.indicator_id !== indicatorId) {
          return null;
        }
        return {
          indicator_id: indicatorId,
          source_api: meta.source_api || "unknown",
          success: meta.success || false,
          error: meta.error,
          observation_count: meta.observation_count,
          timestamp: log.createdAt,
        };
      })
      .filter((item): item is IngestionAttempt => item !== null)
      .slice(0, 10); // Limitar a 10 más recientes
  } catch (err) {
    console.error("Failed to get ingestion history:", err);
    return [];
  }
}

