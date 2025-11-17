/**
 * Script para ingerir noticias económicas desde NewsAPI
 * 
 * API: https://newsapi.org/
 * Plan gratuito: 100 requests/día
 * 
 * Uso:
 *   APP_URL=https://tu-app.vercel.app \
 *   INGEST_KEY=tu_key \
 *   NEWSAPI_KEY=tu_newsapi_key \
 *   pnpm tsx scripts/ingest-newsapi.ts
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

const BASE_URL = process.env.APP_URL || 'http://localhost:3000'
const INGEST_KEY = process.env.INGEST_KEY
const NEWSAPI_KEY = process.env.NEWSAPI_KEY

if (!INGEST_KEY) {
  console.warn('[ingest-newsapi] INGEST_KEY not set, skipping API calls')
  process.exit(0)
}

if (!NEWSAPI_KEY) {
  console.warn('[ingest-newsapi] NEWSAPI_KEY not set, skipping NewsAPI ingestion')
  process.exit(0)
}

/**
 * Fetch financial news from NewsAPI
 */
async function fetchNewsAPINews(): Promise<NewsItem[]> {
  try {
    // Search for forex and economic news
    const queries = [
      'forex',
      'federal reserve',
      'interest rates',
      'inflation',
      'GDP',
      'employment',
      'nonfarm payrolls',
    ]
    
    const allNews: NewsItem[] = []
    
    for (const query of queries.slice(0, 3)) { // Limit to 3 queries to stay within free tier
      try {
        const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&sortBy=publishedAt&language=en&pageSize=20&apiKey=${NEWSAPI_KEY}`
        console.log(`[ingest-newsapi] Fetching news for query: ${query}...`)
        
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          },
          next: { revalidate: 0 },
        })

        if (!response.ok) {
          const errorText = await response.text()
          console.warn(`[ingest-newsapi] HTTP ${response.status} for query "${query}": ${errorText}`)
          continue
        }

        const data = await response.json()
        
        if (!data || !data.articles || !Array.isArray(data.articles)) {
          console.warn(`[ingest-newsapi] Unexpected response format for query "${query}"`)
          continue
        }

        // Filter for recent news (last 24 hours)
        const yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 1)
        
        const macroKeywords = ['fed', 'federal reserve', 'cpi', 'inflation', 'gdp', 'employment', 'nfp', 'payroll', 'interest rate', 'monetary policy', 'central bank', 'economy', 'economic']
        
        const news: NewsItem[] = data.articles
          .filter((item: any) => {
            if (!item || !item.title) return false
            const publishedDate = new Date(item.publishedAt)
            if (publishedDate < yesterday) return false
            
            const text = `${item.title} ${item.description || ''}`.toLowerCase()
            return macroKeywords.some(keyword => text.includes(keyword))
          })
          .map((item: any) => {
            // Parse date
            let published_at: string
            try {
              published_at = new Date(item.publishedAt).toISOString()
            } catch {
              published_at = new Date().toISOString()
            }

            // Determine impact
            let impacto: 'low' | 'med' | 'high' = 'low'
            const text = `${item.title} ${item.description || ''}`.toLowerCase()
            if (text.includes('cpi') || text.includes('nfp') || text.includes('gdp') || text.includes('fed rate')) {
              impacto = 'high'
            } else if (text.includes('retail sales') || text.includes('pmi') || text.includes('ism')) {
              impacto = 'med'
            }

            // Determine tema
            let tema: string | undefined
            if (text.includes('cpi') || text.includes('inflation') || text.includes('ppi')) {
              tema = 'Inflación'
            } else if (text.includes('gdp') || text.includes('growth')) {
              tema = 'Crecimiento'
            } else if (text.includes('employment') || text.includes('nfp') || text.includes('payroll')) {
              tema = 'Empleo'
            } else if (text.includes('rate') || text.includes('fed') || text.includes('interest')) {
              tema = 'Política Monetaria'
            }

            return {
              id_fuente: item.url || item.title?.slice(0, 100) || `newsapi-${Date.now()}-${Math.random()}`,
              fuente: item.source?.name || 'NewsAPI',
              pais: item.source?.country || 'USA',
              tema,
              titulo: item.title || 'Financial News',
              impacto,
              published_at,
              resumen: item.description || undefined,
            }
          })
        
        allNews.push(...news)
        
        // Rate limiting: wait 1 second between requests
        await new Promise(resolve => setTimeout(resolve, 1000))
      } catch (error) {
        console.error(`[ingest-newsapi] Error fetching news for query "${query}":`, error)
      }
    }

    // Remove duplicates based on title
    const uniqueNews = Array.from(
      new Map(allNews.map(item => [item.titulo.toLowerCase(), item])).values()
    )

    console.log(`[ingest-newsapi] Parsed ${uniqueNews.length} unique news items`)
    return uniqueNews
  } catch (error) {
    console.error('[ingest-newsapi] Error fetching NewsAPI news:', error)
    return []
  }
}

/**
 * Main ingestion function
 */
async function ingestFromNewsAPI() {
  console.log('[ingest-newsapi] Starting NewsAPI ingestion...')
  
  try {
    const newsItems = await fetchNewsAPINews()
    let inserted = 0
    let skipped = 0
    
    for (const news of newsItems) {
      try {
        const response = await fetch(`${BASE_URL}/api/news/insert`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-INGEST-KEY': INGEST_KEY || '',
          },
          body: JSON.stringify(news),
        })

        if (response.ok) {
          const result = await response.json()
          if (result.success && result.inserted) {
            inserted++
            console.log(`[ingest-newsapi] ✅ Inserted: ${news.titulo.slice(0, 50)}...`)
          } else {
            skipped++
          }
        } else {
          skipped++
        }
      } catch (error) {
        console.error(`[ingest-newsapi] Error inserting news:`, error)
        skipped++
      }
    }
    
    console.log(`[ingest-newsapi] Completed: ${inserted} inserted, ${skipped} skipped`)
    return { inserted, skipped }
  } catch (error) {
    console.error('[ingest-newsapi] Fatal error:', error)
    throw error
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}` || import.meta.url.endsWith(process.argv[1])) {
  ingestFromNewsAPI()
    .then(result => {
      console.log('✅ NewsAPI ingestion completed:', result)
      process.exit(0)
    })
    .catch(error => {
      console.error('❌ NewsAPI ingestion failed:', error)
      process.exit(1)
    })
}

export { ingestFromNewsAPI }




export {}
