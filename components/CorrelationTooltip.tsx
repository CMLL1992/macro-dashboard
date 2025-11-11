'use client'

import SmartTooltip from './SmartTooltip'

type CorrelationTooltipProps = {
  correlation: number | null | undefined
  symbol: string
  window: '3m' | '6m' | '12m' | '24m'
  usdBias: 'Fuerte' | 'Débil' | 'Neutral'
  children: React.ReactNode
  corr12m?: number | null // Para detectar divergencias
  corr3m?: number | null
}

export function generateCorrelationTooltipText(
  correlation: number | null | undefined,
  symbol: string,
  window: '3m' | '6m' | '12m' | '24m',
  usdBias: 'Fuerte' | 'Débil' | 'Neutral',
  corr12m?: number | null,
  corr3m?: number | null
): string {
  if (correlation == null || !Number.isFinite(correlation)) {
    return 'Correlación no disponible o datos insuficientes.'
  }

  const absCorr = Math.abs(correlation)
  const isPositive = correlation > 0
  const isNegative = correlation < 0

  // Clasificar sensibilidad
  let sensitivity: string
  let signalType: string
  if (absCorr >= 0.60) {
    sensitivity = 'Alta'
    signalType = isPositive ? 'Positiva' : 'Negativa'
  } else if (absCorr >= 0.30) {
    sensitivity = 'Media'
    signalType = isPositive ? 'Positiva' : 'Negativa'
  } else {
    sensitivity = 'Baja'
    signalType = absCorr > 0.10 ? (isPositive ? 'Positiva' : 'Negativa') : 'Casi neutra'
  }

  // Ventana temporal
  const windowLabel = window === '3m' ? '3 meses' 
    : window === '6m' ? '6 meses'
    : window === '12m' ? '12 meses'
    : '24 meses'

  // Interpretación de la relación
  let interpretacion = ''
  if (isNegative && absCorr >= 0.10) {
    interpretacion = 'Relación inversa con el USD.'
  } else if (isPositive && absCorr >= 0.10) {
    interpretacion = 'Relación directa con el USD.'
  } else {
    interpretacion = 'Relación débil con el USD (ruido).'
  }

  // Ejemplo dinámico con par
  let ejemplo = ''
  if (absCorr >= 0.30) {
    if (isNegative) {
      ejemplo = `USD fuerte → ${symbol} tiende a **caer** · USD débil → **subir**.`
    } else {
      ejemplo = `USD fuerte → ${symbol} tiende a **subir** · USD débil → **caer**.`
    }
  } else {
    ejemplo = 'Sensibilidad baja; prioriza drivers propios.'
  }

  // Nota sobre divergencia (solo para 3m y 12m)
  let notaDivergencia = ''
  if ((window === '3m' || window === '12m') && corr12m != null && corr3m != null) {
    const abs12 = Math.abs(corr12m)
    const abs3 = Math.abs(corr3m)
    const sameSign = corr12m * corr3m >= 0
    
    if (!sameSign && abs12 >= 0.30 && abs3 >= 0.30) {
      const otraVentana = window === '3m' ? '12m' : '3m'
      notaDivergencia = `\n\n⚠️ Ojo: divergencia con ${otraVentana}. Reduce confianza.`
    } else if (window === '3m' && abs12 >= 0.50 && abs3 < 0.30) {
      notaDivergencia = '\n\n⚠️ Ojo: 3m débil aunque 12m fuerte. Validar con PA.'
    } else if (window === '12m' && abs3 >= 0.50 && abs12 < 0.30) {
      notaDivergencia = '\n\n⚠️ Ojo: 12m débil aunque 3m fuerte. Puede ser temporal.'
    }
  }

  return `Sensibilidad ${sensitivity} · ${signalType}\n\nVentana: ${windowLabel}\n\n${interpretacion}\n\n${ejemplo}${notaDivergencia}`
}

export default function CorrelationTooltip({ 
  correlation, 
  symbol, 
  window, 
  usdBias, 
  children,
  corr12m,
  corr3m,
}: CorrelationTooltipProps) {
  const tooltipText = generateCorrelationTooltipText(correlation, symbol, window, usdBias, corr12m, corr3m)

  return (
    <SmartTooltip
      content={tooltipText}
      placement="top"
      maxWidth={320}
      id={`corr-tooltip-${symbol}-${window}`}
    >
      {children}
    </SmartTooltip>
  )
}
