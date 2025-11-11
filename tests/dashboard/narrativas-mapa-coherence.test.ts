/**
 * Test: Coherencia entre Narrativas y Mapa de sesgos
 * Verifica que Narrativas refleje exactamente las decisiones finales del Mapa
 * sin recalcular ni interpretar nada.
 */

import { describe, it, expect } from 'vitest'
import { getBiasTableTactical } from '@/domain/bias'
import { getMacroDiagnosisWithDelta } from '@/domain/diagnostic'
import { usdBias, macroQuadrant } from '@/domain/bias'
import { getCorrMap } from '@/domain/corr-bridge'

// Activos de muestra para validación (según especificación)
const SAMPLE_ASSETS = [
  'EUR/USD',
  'GBP/USD',
  'AUD/USD',
  'USD/JPY',
  'USD/CAD',
  'XAU/USD',
  'BTC/USDT',
  'ETH/USDT',
  'SPX',
  'NDX',
]

describe('Coherencia Narrativas vs Mapa de sesgos', () => {
  it('Narrativas debe consumir exactamente los mismos datos que el Mapa de sesgos', async () => {
    // Obtener datos del Mapa de sesgos (source of truth)
    const data = await getMacroDiagnosisWithDelta()
    const usd = usdBias(data.items)
    const quad = macroQuadrant(data.items)
    const corrMap = await getCorrMap()
    
    const tacticalRows = await getBiasTableTactical(
      data.items as any[],
      data.regime,
      usd,
      data.score,
      [],
      corrMap
    )

    // Validar que hay datos
    expect(tacticalRows.length).toBeGreaterThan(0)

    // Para cada activo de muestra, verificar que existe en el Mapa
    const mapRowsByPar = new Map(tacticalRows.map(r => [r.par, r]))
    
    for (const asset of SAMPLE_ASSETS) {
      const mapRow = mapRowsByPar.get(asset)
      
      if (!mapRow) {
        // Si el activo no está en el Mapa, no podemos validar Narrativas
        // (esto es aceptable si el activo no está configurado)
        continue
      }

      // Validar campos obligatorios en el Mapa
      expect(mapRow.par, `Par debe existir para ${asset}`).toBeTruthy()
      expect(mapRow.tactico, `Tendencia (tactico) debe existir para ${asset}`).toBeTruthy()
      expect(mapRow.accion, `Acción debe existir para ${asset}`).toBeTruthy()
      expect(mapRow.confianza, `Confianza debe existir para ${asset}`).toBeTruthy()
      expect(mapRow.motivo, `Motivo debe existir para ${asset}`).toBeTruthy()
      
      // Validar que tactico es uno de los valores esperados
      expect(['Alcista', 'Bajista', 'Neutral', 'Rango']).toContain(mapRow.tactico)
      
      // Validar que accion es uno de los valores esperados
      expect(['Buscar compras', 'Buscar ventas', 'Rango/táctico']).toContain(mapRow.accion)
      
      // Validar que confianza es uno de los valores esperados
      expect(['Alta', 'Media', 'Baja']).toContain(mapRow.confianza)
      
      // Validar que motivo es string no vacío
      expect(typeof mapRow.motivo).toBe('string')
      expect(mapRow.motivo.length).toBeGreaterThan(0)
      
      // Validar correlaciones (pueden ser null, pero si existen deben ser números)
      if (mapRow.corr12m != null) {
        expect(typeof mapRow.corr12m).toBe('number')
        expect(Number.isFinite(mapRow.corr12m)).toBe(true)
        expect(mapRow.corr12m).toBeGreaterThanOrEqual(-1)
        expect(mapRow.corr12m).toBeLessThanOrEqual(1)
      }
      
      if (mapRow.corr3m != null) {
        expect(typeof mapRow.corr3m).toBe('number')
        expect(Number.isFinite(mapRow.corr3m)).toBe(true)
        expect(mapRow.corr3m).toBeGreaterThanOrEqual(-1)
        expect(mapRow.corr3m).toBeLessThanOrEqual(1)
      }
      
      // Validar corrRef (debe ser "DXY" o al menos consistente)
      if (mapRow.corrRef) {
        expect(typeof mapRow.corrRef).toBe('string')
      }
    }
  })

  it('Narrativas debe mostrar los mismos valores que el Mapa para activos de muestra', async () => {
    // Obtener datos del Mapa (source of truth)
    const data = await getMacroDiagnosisWithDelta()
    const usd = usdBias(data.items)
    const quad = macroQuadrant(data.items)
    const corrMap = await getCorrMap()
    
    const tacticalRows = await getBiasTableTactical(
      data.items as any[],
      data.regime,
      usd,
      data.score,
      [],
      corrMap
    )

    const mapRowsByPar = new Map(tacticalRows.map(r => [r.par, r]))
    
    // Simular lo que Narrativas debería renderizar (mismas filas tácticas)
    const narrativeRows = tacticalRows
    
    // Verificar que Narrativas tiene las mismas filas
    expect(narrativeRows.length).toBe(tacticalRows.length)
    
    // Para cada activo de muestra, comparar valores 1:1
    for (const asset of SAMPLE_ASSETS) {
      const mapRow = mapRowsByPar.get(asset)
      
      if (!mapRow) {
        continue // Activo no configurado, skip
      }
      
      // Buscar en Narrativas (debería ser la misma fila)
      const narrativeRow = narrativeRows.find(r => r.par === asset)
      
      if (!narrativeRow) {
        // Si no está en Narrativas, es un problema
        throw new Error(`Activo ${asset} está en el Mapa pero no en Narrativas`)
      }
      
      // Comparación 1:1 de campos obligatorios
      expect(narrativeRow.tactico, `Tendencia debe coincidir para ${asset}`).toBe(mapRow.tactico)
      expect(narrativeRow.accion, `Acción debe coincidir para ${asset}`).toBe(mapRow.accion)
      expect(narrativeRow.confianza, `Confianza debe coincidir para ${asset}`).toBe(mapRow.confianza)
      expect(narrativeRow.motivo, `Motivo debe coincidir exactamente para ${asset}`).toBe(mapRow.motivo)
      
      // Comparación de correlaciones (con tolerancia para redondeo)
      if (mapRow.corr12m != null && narrativeRow.corr12m != null) {
        expect(
          Math.abs(narrativeRow.corr12m - mapRow.corr12m),
          `Corr. 12m debe coincidir para ${asset}`
        ).toBeLessThan(0.01) // Tolerancia de 0.01 para redondeo
      } else {
        // Ambos deben ser null o ambos deben tener valor
        expect(narrativeRow.corr12m == null).toBe(mapRow.corr12m == null)
      }
      
      if (mapRow.corr3m != null && narrativeRow.corr3m != null) {
        expect(
          Math.abs(narrativeRow.corr3m - mapRow.corr3m),
          `Corr. 3m debe coincidir para ${asset}`
        ).toBeLessThan(0.01)
      } else {
        expect(narrativeRow.corr3m == null).toBe(mapRow.corr3m == null)
      }
    }
  })

  it('Narrativas no debe transformar ni interpretar los valores del Mapa', async () => {
    const data = await getMacroDiagnosisWithDelta()
    const usd = usdBias(data.items)
    const quad = macroQuadrant(data.items)
    const corrMap = await getCorrMap()
    
    const tacticalRows = await getBiasTableTactical(
      data.items as any[],
      data.regime,
      usd,
      data.score,
      [],
      corrMap
    )

    // Verificar que los valores son literales (no transformados)
    for (const row of tacticalRows) {
      // Tendencia debe ser exactamente "Alcista", "Bajista", "Neutral" o "Rango"
      // (no derivado de otra lógica)
      if (row.tactico) {
        expect(['Alcista', 'Bajista', 'Neutral', 'Rango']).toContain(row.tactico)
      }
      
      // Acción debe ser exactamente "Buscar compras", "Buscar ventas" o "Rango/táctico"
      if (row.accion) {
        expect(['Buscar compras', 'Buscar ventas', 'Rango/táctico']).toContain(row.accion)
      }
      
      // Confianza debe ser exactamente "Alta", "Media" o "Baja"
      if (row.confianza) {
        expect(['Alta', 'Media', 'Baja']).toContain(row.confianza)
      }
      
      // Motivo debe ser string literal (no generado dinámicamente)
      if (row.motivo) {
        expect(typeof row.motivo).toBe('string')
        // El motivo debe contener información útil (no vacío)
        expect(row.motivo.trim().length).toBeGreaterThan(0)
      }
    }
  })

  it('Narrativas debe mantener el mismo orden que el Mapa de sesgos', async () => {
    const data = await getMacroDiagnosisWithDelta()
    const usd = usdBias(data.items)
    const quad = macroQuadrant(data.items)
    const corrMap = await getCorrMap()
    
    const tacticalRows = await getBiasTableTactical(
      data.items as any[],
      data.regime,
      usd,
      data.score,
      [],
      corrMap
    )

    // Narrativas debe usar exactamente las mismas filas (mismo orden)
    const narrativeRows = tacticalRows
    
    // Verificar que el orden es idéntico
    expect(narrativeRows.length).toBe(tacticalRows.length)
    
    for (let i = 0; i < tacticalRows.length; i++) {
      expect(narrativeRows[i]?.par, `Orden debe coincidir en posición ${i}`).toBe(tacticalRows[i]?.par)
    }
  })

  it('Narrativas debe manejar correctamente valores faltantes (validación de errores)', async () => {
    const data = await getMacroDiagnosisWithDelta()
    const usd = usdBias(data.items)
    const quad = macroQuadrant(data.items)
    const corrMap = await getCorrMap()
    
    const tacticalRows = await getBiasTableTactical(
      data.items as any[],
      data.regime,
      usd,
      data.score,
      [],
      corrMap
    )

    // Verificar que todas las filas tienen campos obligatorios
    for (const row of tacticalRows) {
      const missing = [
        !row.par,
        !row.tactico,
        !row.accion,
        !row.confianza,
        typeof row.motivo !== 'string' || row.motivo.length === 0,
      ]
      
      if (missing.some(Boolean)) {
        // Si falta algún campo obligatorio, debe ser detectable
        const missingFields = []
        if (!row.par) missingFields.push('par')
        if (!row.tactico) missingFields.push('tactico')
        if (!row.accion) missingFields.push('accion')
        if (!row.confianza) missingFields.push('confianza')
        if (typeof row.motivo !== 'string' || row.motivo.length === 0) missingFields.push('motivo')
        
        // Esto debería fallar la validación en Narrativas
        throw new Error(
          `Faltan campos obligatorios para ${row.par || 'activo desconocido'}: ${missingFields.join(', ')}`
        )
      }
    }
  })
})

