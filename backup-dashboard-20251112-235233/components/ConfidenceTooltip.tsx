'use client'

import SmartTooltip from './SmartTooltip'

type ConfidenceTooltipProps = {
  pair: string
  confianza: 'Alta' | 'Media' | 'Baja'
  usdBias: 'Fuerte' | 'Débil' | 'Neutral'
  corr12m: number | null
  corr3m: number | null
  children: React.ReactNode
}

export function generateConfidenceTooltipText(
  pair: string,
  confianza: 'Alta' | 'Media' | 'Baja',
  usdBias: 'Fuerte' | 'Débil' | 'Neutral',
  corr12m: number | null,
  corr3m: number | null
): string {
  const abs12 = Math.abs(corr12m ?? 0)
  const abs3 = Math.abs(corr3m ?? 0)
  const sign12 = corr12m != null && corr12m < 0 ? 'inversa' : corr12m != null && corr12m > 0 ? 'directa' : 'débil'
  const sign3 = corr3m != null && corr3m < 0 ? 'inversa' : corr3m != null && corr3m > 0 ? 'directa' : 'débil'
  const sameSign = (corr12m ?? 0) * (corr3m ?? 0) >= 0

  // Definición según nivel
  let definicion = ''
  if (confianza === 'Alta') {
    definicion = 'Régimen claro y relación estable con el USD.'
  } else if (confianza === 'Media') {
    definicion = 'Contexto favorable pero con señales mixtas o sensibilidad moderada.'
  } else {
    definicion = 'Contexto indefinido o sensibilidad débil; preferir rango/táctico.'
  }

  // Métricas
  const corr12mStr = corr12m != null ? Math.abs(corr12m).toFixed(2) : '—'
  const corr3mStr = corr3m != null ? Math.abs(corr3m).toFixed(2) : '—'
  const corr12mSign = corr12m != null && corr12m < 0 ? '-' : corr12m != null && corr12m > 0 ? '+' : ''
  const corr3mSign = corr3m != null && corr3m < 0 ? '-' : corr3m != null && corr3m > 0 ? '+' : ''
  const corr12mColor = corr12m != null && corr12m < 0 ? '🔴' : corr12m != null && corr12m > 0 ? '🟢' : '⚪'
  const corr3mColor = corr3m != null && corr3m < 0 ? '🔴' : corr3m != null && corr3m > 0 ? '🟢' : '⚪'

  // Interpretación según signo
  let interpretacion = ''
  if (corr12m != null && corr12m < -0.10) {
    interpretacion = 'Relación inversa con el USD.'
  } else if (corr12m != null && corr12m > 0.10) {
    interpretacion = 'Relación directa con el USD.'
  } else {
    interpretacion = 'Relación débil con el USD.'
  }

  // Ejemplo aplicado al par
  let ejemplo = ''
  if (abs12 >= 0.30) {
    if (corr12m! < 0) {
      if (usdBias === 'Débil') {
        ejemplo = `Si USD está **${usdBias}**, ${pair} tiende a **subir**.`
      } else if (usdBias === 'Fuerte') {
        ejemplo = `Si USD está **${usdBias}**, ${pair} tiende a **caer**.`
      } else {
        ejemplo = `Relación inversa: cuando USD sube, ${pair} tiende a caer, y viceversa.`
      }
    } else {
      if (usdBias === 'Fuerte') {
        ejemplo = `Si USD está **${usdBias}**, ${pair} tiende a **subir**.`
      } else if (usdBias === 'Débil') {
        ejemplo = `Si USD está **${usdBias}**, ${pair} tiende a **caer**.`
      } else {
        ejemplo = `Relación directa: cuando USD sube, ${pair} tiende a subir, y viceversa.`
      }
    }
  } else {
    ejemplo = 'Sensibilidad baja al USD; prioriza drivers propios y price action.'
  }

  // Nota sobre divergencia
  let notaDivergencia = ''
  if (corr12m != null && corr3m != null && !sameSign && abs12 >= 0.30 && abs3 >= 0.30) {
    notaDivergencia = '\n⚠️ Ojo: divergencia entre 12m y 3m. Reduce confianza.'
  } else if (abs12 >= 0.50 && abs3 < 0.30) {
    notaDivergencia = '\n⚠️ Ojo: 3m débil aunque 12m fuerte. Validar con PA.'
  } else if (abs12 < 0.30 && abs3 >= 0.50) {
    notaDivergencia = '\n⚠️ Ojo: 3m fuerte pero 12m débil. Puede ser temporal.'
  }

  // Microcopy según nivel
  let microcopy = ''
  if (confianza === 'Alta') {
    microcopy = '\n\n💡 Correlaciones estables y USD claro. Direccionalidad operable (swing 3–10 días).'
  } else if (confianza === 'Media') {
    microcopy = '\n\n💡 Contexto favorable pero con señales mixtas. Ajusta tamaño y espera confirmación PA.'
  } else {
    microcopy = '\n\n💡 Contexto indefinido o sensibilidad débil al USD. Preferible rango/táctico.'
  }

  return `Confianza ${confianza}\n\n${definicion}\n\nMétricas:\nCorr. 12m: ${corr12mSign}${corr12mStr} · 3m: ${corr3mSign}${corr3mStr}\n\n${interpretacion}\n\nEjemplo: ${ejemplo}${notaDivergencia}${microcopy}`
}

export default function ConfidenceTooltip({
  pair,
  confianza,
  usdBias,
  corr12m,
  corr3m,
  children,
}: ConfidenceTooltipProps) {
  const tooltipText = generateConfidenceTooltipText(pair, confianza, usdBias, corr12m, corr3m)

  return (
    <SmartTooltip
      content={tooltipText}
      placement="top"
      maxWidth={320}
      id={`confidence-tooltip-${pair}`}
    >
      {children}
    </SmartTooltip>
  )
}

