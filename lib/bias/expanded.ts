/**
 * Expanded macro narrative: monetary stance, cycle phase, blocks, risks
 */

import type { MacroBias, BiasInputs } from './types'

export interface ExpandedNarrative {
  monetaryStance: {
    label: 'Hawkish' | 'Neutral' | 'Dovish'
    reason: string
  }
  cyclePhase: {
    label: 'Expansión' | 'Desaceleración' | 'Contracción' | 'Recuperación'
    reason: string
  }
  blocks: Array<{
    region: string
    bias: string
    note: string
  }>
  nearTermRisks: Array<{
    name: string
    date: string
    impact: string
  }>
}

export function buildExpandedNarrative(
  bias: MacroBias,
  inputs: BiasInputs
): ExpandedNarrative {
  // Monetary stance
  let monetaryStance: ExpandedNarrative['monetaryStance'] = {
    label: 'Neutral',
    reason: 'Sin datos suficientes',
  }

  if (inputs.inflation_momentum > 0.2 && inputs.growth_momentum > 0.1) {
    monetaryStance = {
      label: 'Hawkish',
      reason: 'Inflación acelerando y crecimiento sólido sugieren postura restrictiva',
    }
  } else if (inputs.inflation_momentum < -0.2 && inputs.growth_momentum < -0.1) {
    monetaryStance = {
      label: 'Dovish',
      reason: 'Inflación desacelerando y crecimiento débil sugieren postura acomodaticia',
    }
  } else {
    monetaryStance = {
      label: 'Neutral',
      reason: 'Señales mixtas entre inflación y crecimiento',
    }
  }

  // Cycle phase
  let cyclePhase: ExpandedNarrative['cyclePhase'] = {
    label: 'Desaceleración',
    reason: 'Sin datos suficientes',
  }

  if (inputs.growth_momentum > 0.2 && inputs.inflation_momentum > 0) {
    cyclePhase = {
      label: 'Expansión',
      reason: 'Crecimiento acelerando con inflación presente',
    }
  } else if (inputs.growth_momentum < -0.2 && inputs.inflation_momentum < 0) {
    cyclePhase = {
      label: 'Contracción',
      reason: 'Crecimiento y inflación desacelerando',
    }
  } else if (inputs.growth_momentum > 0 && inputs.inflation_momentum < 0) {
    cyclePhase = {
      label: 'Recuperación',
      reason: 'Crecimiento positivo con inflación controlada',
    }
  } else {
    cyclePhase = {
      label: 'Desaceleración',
      reason: 'Crecimiento moderado o negativo',
    }
  }

  // Blocks (simplified - would need region-specific data)
  const blocks: ExpandedNarrative['blocks'] = [
    {
      region: 'USD',
      bias: inputs.usd_bias.direction === 'STRONG' ? 'Fuerte' : inputs.usd_bias.direction === 'WEAK' ? 'Débil' : 'Neutral',
      note: inputs.usd_bias.direction === 'STRONG' ? 'Condiciones monetarias restrictivas' : 'Condiciones monetarias acomodaticias',
    },
    {
      region: 'Europa',
      bias: bias.direction === 'long' ? 'Alcista' : bias.direction === 'short' ? 'Bajista' : 'Neutral',
      note: 'Sesgo basado en drivers macro',
    },
  ]

  // Near-term risks (placeholder - would come from calendar)
  const nearTermRisks: ExpandedNarrative['nearTermRisks'] = [
    // Would be populated from actual calendar data
  ]

  return {
    monetaryStance,
    cyclePhase,
    blocks,
    nearTermRisks,
  }
}







