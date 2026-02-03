/**
 * Calcula la postura monetaria (Hawkish/Neutral/Dovish/Strongly Dovish)
 * basada en indicadores macro: tipos de interés, inflación y crecimiento
 * 
 * Lógica macro (NO trading):
 * - Inflación alta + tipos altos → Hawkish
 * - Inflación bajando + tipos estables → Neutral
 * - Inflación baja + recortes → Dovish
 * - Inflación muy baja + recortes agresivos → Strongly Dovish
 */

export type MonetaryStance = 'Hawkish' | 'Neutral' | 'Dovish' | 'Strongly Dovish'

interface MonetaryStanceInput {
  monetaryScore: number // Score de política monetaria (-1 a +1)
  inflationScore: number // Score de inflación (-1 a +1)
  growthScore: number // Score de crecimiento (-1 a +1)
  laborScore?: number // Score de empleo (-1 a +1), opcional
}

/**
 * Calcula la postura monetaria basada en scores macro con ponderaciones específicas
 * Ponderaciones: Types 40%, Inflation 30%, Growth 20%, Employment 10%
 */
export function calculateMonetaryStance(input: MonetaryStanceInput): MonetaryStance {
  const { monetaryScore, inflationScore, growthScore, laborScore = 0 } = input

  // Aplicar ponderaciones específicas según especificación
  // Types: 40%, Inflation: 30%, Growth: 20%, Employment: 10%
  const weightedScore = 
    (monetaryScore * 0.4) + 
    (inflationScore * 0.3) + 
    (growthScore * 0.2) + 
    (laborScore * 0.1)

  // Determinar postura basada en score ponderado
  // Strongly Dovish: score muy negativo (< -0.5)
  if (weightedScore <= -0.5) {
    return 'Strongly Dovish'
  }

  // Dovish: score negativo pero no extremo (-0.5 a -0.15)
  if (weightedScore < -0.15) {
    return 'Dovish'
  }

  // Hawkish: score positivo alto (> +0.15)
  if (weightedScore > 0.15) {
    return 'Hawkish'
  }

  // Neutral: resto de casos (-0.15 a +0.15)
  return 'Neutral'
}

/**
 * Obtiene el color para la postura monetaria
 */
export function getMonetaryStanceColor(stance: MonetaryStance): string {
  switch (stance) {
    case 'Hawkish':
      return 'bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/50'
    case 'Dovish':
      return 'bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/50'
    case 'Strongly Dovish':
      return 'bg-purple-500/20 text-purple-700 dark:text-purple-400 border-purple-500/50'
    default:
      return 'bg-gray-500/20 text-gray-700 dark:text-gray-400 border-gray-500/50'
  }
}
