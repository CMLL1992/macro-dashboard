import dataSourcesConfig from "../../../data/data_sources.json";

export interface DataSourceConfig {
  indicator_id: string;
  primary_api: string;
  primary_endpoint: string;
  fallback_api: string | null;
  fallback_endpoint: string | null;
  frequency: "D" | "W" | "M" | "Q";
  notes?: string;
}

export interface DataSources {
  sources: DataSourceConfig[];
}

const config = dataSourcesConfig as DataSources;

/**
 * Obtiene la configuración de fuente de datos para un indicador
 */
export function getDataSourceConfig(indicatorId: string): DataSourceConfig | null {
  const source = config.sources.find((s) => s.indicator_id === indicatorId);
  return source || null;
}

/**
 * Obtiene todas las configuraciones de fuentes
 */
export function getAllDataSourceConfigs(): DataSourceConfig[] {
  return config.sources;
}

/**
 * Obtiene configuraciones por API
 */
export function getConfigsByApi(api: string): DataSourceConfig[] {
  return config.sources.filter(
    (s) => s.primary_api === api || s.fallback_api === api
  );
}

