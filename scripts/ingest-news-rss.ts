/**
 * Script para ingerir noticias macroeconómicas desde RSS feeds
 * 
 * Fuentes:
 * - Bloomberg Economics RSS
 * - Reuters Business News RSS
 * - Financial Times RSS
 * 
 * Uso:
 *   APP_URL=https://tu-app.vercel.app INGEST_KEY=tu_key pnpm tsx scripts/ingest-news-rss.ts
 */

interface NewsItem {
  id_fuente: string
  fuente: string
  pais?: string
  tema?: string
  titulo: string
  impacto: 'low' | 'med' | 'high'
  published_at: string
  resumen?: string
  valor_publicado?: number
  valor_esperado?: number
}

// RSS feeds de noticias macroeconómicas
const RSS_FEEDS = [
  {
    url: 'https://www.bloomberg.com/feeds/markets/economics.rss',
    fuente: 'Bloomberg',
    keywords: {
      high: ['CPI', 'PPI', 'NFP', 'Nonfarm Payrolls', 'GDP', 'Fed', 'Federal Reserve', 'Interest Rate', 'Unemployment'],
      med: ['Retail Sales', 'Industrial Production', 'PMI', 'ISM', 'Jobless Claims'],
    },
  },
  {
    url: 'https://feeds.reuters.com/reuters/businessNews',
    fuente: 'Reuters',
    keywords: {
      high: ['CPI', 'PPI', 'NFP', 'Nonfarm Payrolls', 'GDP', 'Fed', 'Federal Reserve', 'Interest Rate', 'Unemployment'],
      med: ['Retail Sales', 'Industrial Production', 'PMI', 'ISM', 'Jobless Claims'],
    },
  },
  {
    url: 'https://www.ft.com/markets?format=rss',
    fuente: 'Financial Times',
    keywords: {
      high: ['CPI', 'PPI', 'NFP', 'Nonfarm Payrolls', 'GDP', 'Fed', 'Federal Reserve', 'Interest Rate', 'Unemployment'],
      med: ['Retail Sales', 'Industrial Production', 'PMI', 'ISM', 'Jobless Claims'],
    },
  },
]

// Keywords para identificar temas
const THEME_KEYWORDS: Record<string, string[]> = {
  'Inflación': ['CPI', 'PPI', 'PCE', 'inflation', 'deflator', 'price index'],
  'Empleo': ['NFP', 'Nonfarm Payrolls', 'unemployment', 'employment', 'jobless', 'jobs'],
  'Crecimiento': ['GDP', 'gross domestic product', 'economic growth', 'retail sales', 'industrial production'],
  'Política Monetaria': ['Fed', 'Federal Reserve', 'interest rate', 'monetary policy', 'FOMC'],
}

// Keywords para identificar países
const COUNTRY_KEYWORDS: Record<string, string[]> = {
  'US': ['US', 'United States', 'America', 'U.S.', 'USA'],
  'EU': ['EU', 'Europe', 'European', 'ECB', 'Eurozone'],
  'UK': ['UK', 'United Kingdom', 'Britain', 'Bank of England', 'BoE'],
  'JP': ['Japan', 'Japanese', 'BoJ', 'Bank of Japan'],
}

/**
 * Parse RSS feed
 */
async function parseRSSFeed(url: string): Promise<Array<{ title: string; link: string; pubDate: string; description: string }>> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    })
    
    if (!response.ok) {
      console.warn(`[ingest-news-rss] Failed to fetch RSS feed ${url}: ${response.status}`)
      return []
    }

    const text = await response.text()
    
    // Simple RSS parser (basic implementation)
    const items: Array<{ title: string; link: string; pubDate: string; description: string }> = []
    const itemMatches = text.matchAll(/<item[^>]*>([\s\S]*?)<\/item>/gi)
    
    for (const match of itemMatches) {
      const itemContent = match[1]
      const titleMatch = itemContent.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
      const linkMatch = itemContent.match(/<link[^>]*>([\s\S]*?)<\/link>/i)
      const pubDateMatch = itemContent.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)
      const descMatch = itemContent.match(/<description[^>]*>([\s\S]*?)<\/description>/i)
      
      if (titleMatch) {
        items.push({
          title: titleMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim(),
          link: linkMatch?.[1]?.replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim() || '',
          pubDate: pubDateMatch?.[1]?.replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim() || '',
          description: descMatch?.[1]?.replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim() || '',
        })
      }
    }
    
    return items
  } catch (error) {
    console.error(`[ingest-news-rss] Error parsing RSS feed ${url}:`, error)
    return []
  }
}

/**
 * Determine impact level based on keywords
 */
function determineImpact(title: string, description: string, keywords: { high: string[]; med: string[] }): 'high' | 'med' | 'low' {
  const text = `${title} ${description}`.toUpperCase()
  
  for (const keyword of keywords.high) {
    if (text.includes(keyword.toUpperCase())) {
      return 'high'
    }
  }
  
  for (const keyword of keywords.med) {
    if (text.includes(keyword.toUpperCase())) {
      return 'med'
    }
  }
  
  return 'low'
}

/**
 * Determine theme based on keywords
 */
function determineTheme(title: string, description: string): string | undefined {
  const text = `${title} ${description}`.toLowerCase()
  
  for (const [theme, keywords] of Object.entries(THEME_KEYWORDS)) {
    for (const keyword of keywords) {
      if (text.includes(keyword.toLowerCase())) {
        return theme
      }
    }
  }
  
  return undefined
}

/**
 * Determine country based on keywords
 */
function determineCountry(title: string, description: string): string | undefined {
  const text = `${title} ${description}`
  
  for (const [country, keywords] of Object.entries(COUNTRY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        return country
      }
    }
  }
  
  return 'US' // Default to US for economic news
}

/**
 * Extract numeric values from text (for published/expected values)
 */
function extractValues(text: string): { published?: number; expected?: number } {
  // Look for patterns like "3.5%", "0.3%", "increased by 0.5%", "consensus 0.3%"
  const percentPattern = /(\d+\.?\d*)\s*%/g
  const matches = Array.from(text.matchAll(percentPattern))
  
  if (matches.length === 0) return {}
  
  const values = matches.map(m => parseFloat(m[1])).filter(v => !isNaN(v))
  
  // If we find "consensus" or "expected", that's the expected value
  const consensusIndex = text.toLowerCase().indexOf('consensus')
  const expectedIndex = text.toLowerCase().indexOf('expected')
  
  if (consensusIndex > -1 || expectedIndex > -1) {
    // Try to find the value near "consensus" or "expected"
    const consensusText = text.substring(Math.max(0, Math.min(consensusIndex, expectedIndex) - 50), Math.min(text.length, Math.max(consensusIndex, expectedIndex) + 50))
    const consensusMatch = consensusText.match(/(\d+\.?\d*)\s*%/)
    if (consensusMatch) {
      return {
        published: values[0],
        expected: parseFloat(consensusMatch[1]),
      }
    }
  }
  
  return {
    published: values[0],
  }
}

/**
 * Parse date string to ISO format
 */
function parseDate(dateStr: string): string {
  try {
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) {
      // Try alternative formats
      return new Date().toISOString()
    }
    return date.toISOString()
  } catch {
    return new Date().toISOString()
  }
}

/**
 * Generate unique ID for news item
 */
function generateId(fuente: string, titulo: string, publishedAt: string): string {
  const date = new Date(publishedAt).toISOString().split('T')[0]
  const slug = titulo
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .substring(0, 50)
  return `${fuente.toLowerCase()}_${date}_${slug}`
}

/**
 * Main ingestion function
 */
async function ingestNewsFromRSS() {
  console.log('[ingest-news-rss] Starting RSS news ingestion...')
  
  const appUrl = process.env.APP_URL || 'http://localhost:3000'
  const ingestKey = process.env.INGEST_KEY
  
  if (!ingestKey) {
    console.warn('[ingest-news-rss] INGEST_KEY not set, skipping API calls')
    return { inserted: 0, skipped: 0 }
  }

  let totalInserted = 0
  let totalSkipped = 0
  
  // Only process news from last 24 hours to avoid duplicates
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  
  for (const feed of RSS_FEEDS) {
    try {
      console.log(`[ingest-news-rss] Fetching ${feed.fuente}...`)
      const items = await parseRSSFeed(feed.url)
      console.log(`[ingest-news-rss] Found ${items.length} items from ${feed.fuente}`)
      
      for (const item of items) {
        try {
          const publishedAt = parseDate(item.pubDate)
          const publishedDate = new Date(publishedAt)
          
          // Skip if older than 24 hours
          if (publishedDate < yesterday) {
            continue
          }
          
          const impacto = determineImpact(item.title, item.description, feed.keywords)
          
          // Only process high or medium impact news
          if (impacto === 'low') {
            continue
          }
          
          const tema = determineTheme(item.title, item.description)
          const pais = determineCountry(item.title, item.description)
          const values = extractValues(`${item.title} ${item.description}`)
          
          const newsItem: NewsItem = {
            id_fuente: generateId(feed.fuente, item.title, publishedAt),
            fuente: feed.fuente,
            pais,
            tema,
            titulo: item.title,
            impacto,
            published_at: publishedAt,
            resumen: item.description.substring(0, 500),
            valor_publicado: values.published,
            valor_esperado: values.expected,
          }
          
          // Send to API endpoint (API handles deduplication)
          const response = await fetch(`${appUrl}/api/news/insert`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-INGEST-KEY': ingestKey,
            },
            body: JSON.stringify(newsItem),
          })
          
          if (response.ok) {
            const result = await response.json()
            if (result.inserted) {
              totalInserted++
              console.log(`[ingest-news-rss] ✅ Inserted: ${item.title.substring(0, 60)}...`)
            } else {
              totalSkipped++
            }
          } else {
            const errorText = await response.text()
            console.warn(`[ingest-news-rss] API returned ${response.status}: ${errorText}`)
            totalSkipped++
          }
        } catch (error) {
          console.error(`[ingest-news-rss] ❌ Error processing item:`, error)
          totalSkipped++
        }
      }
    } catch (error) {
      console.error(`[ingest-news-rss] ❌ Error processing feed ${feed.fuente}:`, error)
    }
  }
  
  console.log(`[ingest-news-rss] Completed: ${totalInserted} inserted, ${totalSkipped} skipped`)
  return { inserted: totalInserted, skipped: totalSkipped }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}` || import.meta.url.endsWith(process.argv[1])) {
  ingestNewsFromRSS()
    .then(result => {
      console.log('✅ News ingestion completed:', result)
      process.exit(0)
    })
    .catch(error => {
      console.error('❌ News ingestion failed:', error)
      process.exit(1)
    })
}

export { ingestNewsFromRSS }

export {}
