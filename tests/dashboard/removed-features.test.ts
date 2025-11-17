/**
 * Test: Campos deshabilitados eliminados
 * Asegura que no quedan restos de funcionalidades eliminadas
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { glob } from 'glob'

describe('Campos deshabilitados eliminados', () => {
  it('No debe existir columna "Próxima fecha" en el código del dashboard', () => {
    const dashboardPath = join(process.cwd(), 'app', 'dashboard', 'page.tsx')
    if (existsSync(dashboardPath)) {
      const content = readFileSync(dashboardPath, 'utf8')
      expect(content).not.toMatch(/Próxima fecha|próxima fecha|next.*date|nextRelease/i)
    }
  })

  it('No debe existir sección "Próximas Noticias"', () => {
    const dashboardPath = join(process.cwd(), 'app', 'dashboard', 'page.tsx')
    if (existsSync(dashboardPath)) {
      const content = readFileSync(dashboardPath, 'utf8')
      expect(content).not.toMatch(/Próximas Noticias|próximas noticias|upcoming.*news/i)
    }
  })

  it('No debe existir endpoint /api/narrative', () => {
    const narrativePath = join(process.cwd(), 'app', 'api', 'narrative')
    expect(existsSync(narrativePath)).toBe(false)
  })

  it('No debe existir endpoint /api/narratives', () => {
    const narrativesPath = join(process.cwd(), 'app', 'api', 'narratives')
    expect(existsSync(narrativesPath)).toBe(false)
  })

  it('No debe existir endpoint /api/alerts', () => {
    const alertsPath = join(process.cwd(), 'app', 'api', 'alerts')
    expect(existsSync(alertsPath)).toBe(false)
  })

  it('No debe existir job:signals:d en package.json', () => {
    const packagePath = join(process.cwd(), 'package.json')
    const content = readFileSync(packagePath, 'utf8')
    expect(content).not.toMatch(/job:signals:d|job:signals:h4|job:confirm/i)
  })

  it('No debe existir job:qa/report en package.json', () => {
    const packagePath = join(process.cwd(), 'package.json')
    const content = readFileSync(packagePath, 'utf8')
    expect(content).not.toMatch(/job:qa.*report|qa.*report/i)
  })

  it('No debe existir módulo lib/notify/telegram', () => {
    const telegramPath = join(process.cwd(), 'lib', 'notify', 'telegram.ts')
    expect(existsSync(telegramPath)).toBe(false)
  })

  it('No debe existir módulo lib/notify/discord', () => {
    const discordPath = join(process.cwd(), 'lib', 'notify', 'discord.ts')
    expect(existsSync(discordPath)).toBe(false)
  })

  it('No debe existir página /settings/notify', () => {
    const notifyPath = join(process.cwd(), 'app', 'settings', 'notify')
    expect(existsSync(notifyPath)).toBe(false)
  })

  it('No debe existir página /info (manual)', () => {
    const infoPath = join(process.cwd(), 'app', 'info')
    expect(existsSync(infoPath)).toBe(false)
  })

  it('No debe existir página /narratives', () => {
    const narrativesPath = join(process.cwd(), 'app', 'narratives')
    expect(existsSync(narrativesPath)).toBe(false)
  })

  it('No debe existir módulo lib/tech/', () => {
    const techPath = join(process.cwd(), 'lib', 'tech')
    expect(existsSync(techPath)).toBe(false)
  })

  it('No debe existir módulo lib/signals/', () => {
    const signalsPath = join(process.cwd(), 'lib', 'signals')
    expect(existsSync(signalsPath)).toBe(false)
  })

  it('No debe existir endpoint /api/signals/', () => {
    const signalsApiPath = join(process.cwd(), 'app', 'api', 'signals')
    expect(existsSync(signalsApiPath)).toBe(false)
  })

  it('No debe haber referencias a "narrative" en el código del dashboard', () => {
    const dashboardPath = join(process.cwd(), 'app', 'dashboard', 'page.tsx')
    if (existsSync(dashboardPath)) {
      const content = readFileSync(dashboardPath, 'utf8')
      // Permitir comentarios pero no código activo
      const activeCode = content.split('\n').filter(line => !line.trim().startsWith('//') && !line.trim().startsWith('*'))
      const narrativeRefs = activeCode.filter(line => 
        line.includes('narrative') && 
        !line.includes('//') && 
        !line.includes('*')
      )
      expect(narrativeRefs.length).toBe(0)
    }
  })

  it('No debe haber referencias a "alert" en el código del dashboard', () => {
    const dashboardPath = join(process.cwd(), 'app', 'dashboard', 'page.tsx')
    if (existsSync(dashboardPath)) {
      const content = readFileSync(dashboardPath, 'utf8')
      const activeCode = content.split('\n').filter(line => !line.trim().startsWith('//') && !line.trim().startsWith('*'))
      const alertRefs = activeCode.filter(line => 
        line.includes('alert') && 
        !line.includes('//') && 
        !line.includes('*') &&
        !line.includes('getAllLatest') // Permitir getAllLatest
      )
      expect(alertRefs.length).toBe(0)
    }
  })
})





