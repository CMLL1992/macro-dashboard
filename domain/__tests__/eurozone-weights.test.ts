/**
 * Test: Verificar que todos los indicadores eu_ tienen peso > 0 y están en sección EUROZONA
 * Este test rompe el build si algún indicador eu_ vuelve a tener peso 0 o sección incorrecta
 */

import { describe, it, expect } from 'vitest'
import { WEIGHTS } from '../posture'
import { MAP_KEY_TO_WEIGHT_KEY } from '../diagnostic'
import { getDashboardData } from '@/lib/dashboard-data'

describe('Indicadores Eurozona en dashboard', () => {
  // Lista de todos los indicadores EU esperados
  const expectedEUIndicators = [
    'eu_gdp_yoy',
    'eu_gdp_qoq',
    'eu_industrial_production_yoy',
    'eu_retail_sales_yoy',
    'eu_consumer_confidence',
    'eu_pmi_composite',
    'eu_pmi_manufacturing',
    'eu_pmi_services',
    'eu_unemployment',
    'eu_cpi_yoy',
    'eu_cpi_core_yoy',
    'eu_zew_sentiment',
    'eu_ecb_rate',
  ]

  it('todos los indicadores eu_ tienen weight > 0 en config/weights.json', () => {
    const invalid: Array<{ key: string; weightKey: string; weight: number | undefined }> = []

    for (const key of expectedEUIndicators) {
      const weightKey = MAP_KEY_TO_WEIGHT_KEY[key]
      if (!weightKey) {
        invalid.push({ key, weightKey: 'NOT_FOUND', weight: undefined })
        continue
      }

      const weight = WEIGHTS[weightKey]
      if (!weight || weight <= 0) {
        invalid.push({ key, weightKey, weight })
      }
    }

    expect(invalid).toEqual([])
  })

  it('todos los indicadores eu_ están mapeados en MAP_KEY_TO_WEIGHT_KEY', () => {
    const missing = expectedEUIndicators.filter(
      (key) => !MAP_KEY_TO_WEIGHT_KEY[key]
    )

    expect(missing).toEqual([])
  })

  it('todos los indicadores eu_ tienen sección EUROZONA en getDashboardData()', async () => {
    const dashboard = await getDashboardData()
    const euIndicators = dashboard.indicators.filter((i) =>
      (i.originalKey ?? i.key ?? '').toString().startsWith('eu_')
    )

    const invalid = euIndicators.filter(
      (i) => (i.section ?? '').toUpperCase() !== 'EUROZONA'
    )

    expect(invalid).toEqual([])
  })

  it('todos los indicadores eu_ con datos tienen weight > 0', async () => {
    const dashboard = await getDashboardData()
    const euIndicators = dashboard.indicators.filter(
      (i) =>
        (i.originalKey ?? i.key ?? '').toString().startsWith('eu_') &&
        i.value !== null &&
        i.value !== undefined
    )

    const invalid = euIndicators.filter(
      (i) => !i.weight || i.weight <= 0
    )

    expect(invalid).toEqual([])
  })
})

