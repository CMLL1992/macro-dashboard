import fs from 'node:fs/promises'
import path from 'node:path'
import MarkdownIt from 'markdown-it'
import slugify from 'slugify'

export type TocItem = { id: string; level: 2 | 3; title: string }

function mdWithToc(raw: string) {
  const md = new MarkdownIt({ html: false, linkify: true, breaks: false })
  const toc: TocItem[] = []
  const defaultRender = md.renderer.rules.heading_open || function (tokens, idx, options, env, self) {
    return self.renderToken(tokens, idx, options)
  }
  md.renderer.rules.heading_open = function (tokens, idx, options, env, self) {
    const token = tokens[idx]
    const level = Number(token.tag.slice(1))
    if (level === 2 || level === 3) {
      const title = tokens[idx + 1]?.content ?? ''
      const id = slugify(title, { lower: true, strict: true })
      token.attrSet('id', id)
      toc.push({ id, level: level as 2 | 3, title })
    }
    return defaultRender(tokens, idx, options, env, self)
  }
  const html = md.render(raw)
  return { html, toc, raw }
}

export async function loadDocsMarkdown(): Promise<{ html: string; toc: TocItem[]; raw: string }> {
  const docPath = path.join(process.cwd(), 'docs', 'dashboard_index.md')
  let raw: string
  try {
    raw = await fs.readFile(docPath, 'utf8')
  } catch {
    raw = '# Documentación no encontrada\nCrea docs/dashboard_index.md.'
  }
  return mdWithToc(raw)
}

export async function loadBothDocs() {
  const base = path.join(process.cwd(), 'docs')
  let techRaw = '# Documentación técnica no encontrada\nCrea docs/dashboard_index.md.'
  let eduRaw = '# Versión educativa no encontrada\nCrea docs/dashboard_guide_extended.md.'
  try { techRaw = await fs.readFile(path.join(base, 'dashboard_index.md'), 'utf8') } catch {}
  try { eduRaw = await fs.readFile(path.join(base, 'dashboard_guide_extended.md'), 'utf8') } catch {}
  const tech = mdWithToc(techRaw)
  const edu = mdWithToc(eduRaw)
  return { tech, edu }
}

