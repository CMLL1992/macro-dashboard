/**
 * Build macro bias narratives using driver templates
 */

import driverTemplates from '@/config/bias.drivers.json'
import type { MacroBias, AssetMeta, BiasDriver } from './types'

export interface BiasNarrative {
  headline: string
  bullets: string[]
  confidence_note: string
}

function formatTemplate(template: string, context: Record<string, any>): string {
  return template.replace(/\{(.*?)\}/g, (_, key) => {
    const value = context[key]
    if (value === undefined || value === null) return ''
    return String(value)
  })
}

function getDriverTemplate(
  key: string,
  sign: BiasDriver['sign']
): string | null {
  const templates = (driverTemplates as Record<string, any>)[key]
  if (!templates) return null
  return templates[sign] || templates.neutral || null
}

function getSummaryTemplate(direction: string): string {
  const summary = (driverTemplates as Record<string, any>).summary
  if (!summary) return '{symbol}: {score}'
  if (direction === 'long') return summary.long
  if (direction === 'short') return summary.short
  return summary.neutral
}

function assetSideFromSign(sign: BiasDriver['sign']) {
  if (sign === 'positive') {
    return {
      asset_side: 'los largos',
      asset_side_opposite: 'los cortos',
    }
  }
  if (sign === 'negative') {
    return {
      asset_side: 'los cortos',
      asset_side_opposite: 'los largos',
    }
  }
  return {
    asset_side: 'el mercado',
    asset_side_opposite: 'el otro lado',
  }
}

function buildDriverBullet(
  driver: BiasDriver,
  bias: MacroBias,
  asset: AssetMeta
): string | null {
  const template = getDriverTemplate(driver.key, driver.sign)
  if (!template) return null

  const baseContext = {
    symbol: asset.symbol,
    score: bias.score.toFixed(0),
  }

  const sideContext = assetSideFromSign(driver.sign)

  const context = {
    ...baseContext,
    ...sideContext,
    ...driver.context,
  }

  return formatTemplate(template, context)
}

function confidenceLabel(coherence: number) {
  if (coherence >= 0.75) return 'alta'
  if (coherence >= 0.45) return 'media'
  return 'baja'
}

export function buildBiasNarrative(
  bias: MacroBias,
  asset: AssetMeta
): BiasNarrative {
  const summaryTemplate = getSummaryTemplate(bias.direction)
  const headline = formatTemplate(summaryTemplate, {
    symbol: asset.symbol,
    score: bias.score.toFixed(0),
  })

  const bullets: string[] = []

  bias.drivers
    .filter((driver) => Math.abs(driver.contribution) >= 5 && driver.weight > 0)
    .forEach((driver) => {
      const bullet = buildDriverBullet(driver, bias, asset)
      if (bullet && bullet.trim().length > 0) {
        bullets.push(bullet)
      }
    })

  if (bullets.length < 3) {
    bias.drivers
      .filter((driver) => driver.weight > 0)
      .slice(bullets.length)
      .some((driver) => {
        const bullet = buildDriverBullet(driver, bias, asset)
        if (bullet && bullet.trim().length > 0 && !bullets.includes(bullet)) {
          bullets.push(bullet)
        }
        return bullets.length >= 3
      })
  }

  const meta = bias.meta || {
    coverage: 0,
    coherence: 0.5,
    drivers_total: bias.drivers.length,
    drivers_used: bias.drivers.filter((d) => d.weight > 0).length,
  }

  const coherenceText = confidenceLabel(meta.coherence)
  const confidenceNote = `Confianza ${bias.confidence.toFixed(
    2
  )} por coherencia ${coherenceText} y cobertura ${meta.drivers_used} de ${meta.drivers_total} drivers.`

  return {
    headline,
    bullets,
    confidence_note: confidenceNote,
  }
}

