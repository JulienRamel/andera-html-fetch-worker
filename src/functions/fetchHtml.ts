import { defineFunction } from '@andera-top/worker-core'
import { getFreeContext, releaseContext } from '../helpers/playwrightPool'
import { log, warn, error } from '@andera-top/worker-core/dist/utils/logger'
import { URL } from 'url'
import { config } from '../config'

// Validate that the provided URL is well-formed and uses http or https
function validateUrlBasic(urlString: string) {
  let url
  try {
    url = new URL(urlString)
  } catch {
    throw new Error('[FETCH_HTML] Invalid URL')
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('[FETCH_HTML] Only http and https are allowed')
  }
}

// Fetch HTML using scrape.do API as fallback for antibot-protected pages
async function fetchWithScrapeDo(url: string): Promise<string> {
  const apiKey = config.htmlFetchWorkerSpecificConfig.scrapeDoApiKey
  if (!apiKey) {
    throw new Error('[FETCH_HTML] SCRAPE_DO_API_KEY is not configured')
  }
  const scrapeDoUrl = `https://api.scrape.do/?token=${apiKey}&url=${encodeURIComponent(url)}&output=raw`
  log('[FETCH_HTML]', `Using scrape.do fallback for url=${url}`)
  
  const response = await fetch(scrapeDoUrl)
  if (!response.ok) {
    throw new Error(`[FETCH_HTML] scrape.do request failed with status ${response.status}`)
  }
  return await response.text()
}

export const fetchHtml = defineFunction({
  params: {
    url: { type: 'string', required: true },
    waitForSelector: { type: 'string', required: false },
    delay: { type: 'number', required: false },
    userAgent: { type: 'string', required: false },
    antibotFallback: { type: 'boolean', required: false },
  },
  config: {
    timeout: 30000,
    logResult: false,
  },
  handler: async (params, context) => {
    // Extract and validate input parameters
    const { url, waitForSelector, delay, userAgent, antibotFallback } = params
    validateUrlBasic(url)

    log('[FETCH_HTML]', `Fetching HTML: url=${url}, waitForSelector=${waitForSelector}, delay=${delay}, userAgent=${userAgent ? 'custom' : 'default'}, antibotFallback=${antibotFallback ?? false}`)

    // Get a free Playwright context (slot) from the pool
    const slot = await getFreeContext()
    if (!slot) throw new Error('[FETCH_HTML] No free Playwright context available')
    const { context: browserContext, index } = slot

    // Set up timeout management
    const timeoutMs = fetchHtml.config?.timeout ?? 30000
    let timeoutId: NodeJS.Timeout | null = null
    let finished = false

    try {
      // Optional delay before fetching
      if (delay && delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay))
      }

      // Race between the fetch logic and the global timeout
      return await Promise.race([
        (async () => {
          // Open a new page in the allocated context
          const page = await browserContext.newPage()

          try {
            // Set custom user agent if provided
            if (userAgent) {
              await page.setExtraHTTPHeaders({
                'User-Agent': userAgent,
              })
            }

            // Navigate to the target URL and capture the response
            const response = await page.goto(url, { waitUntil: 'networkidle', timeout: timeoutMs })
            const status = response?.status() ?? 0

            // Check if we need to use antibot fallback
            // Trigger fallback on non-2xx responses (except 404) when antibotFallback is enabled
            if (antibotFallback && status !== 404 && (status < 200 || status >= 300)) {
              warn('[FETCH_HTML]', `HTTP ${status} received, triggering scrape.do fallback for url=${url}`)
              await page.close()
              finished = true

              // Use scrape.do fallback
              const html = await fetchWithScrapeDo(url)
              return { html, url, antibotFallbackUsed: true }
            }

            // Optionally wait for a selector to appear
            if (waitForSelector) {
              await page.waitForSelector(waitForSelector, { timeout: timeoutMs })
            }

            // Get the HTML content
            const html = await page.content()

            finished = true
            await page.close()

            // Return the HTML content
            return { html, url }
          } catch (err: any) {
            // Check if this is a navigation error that could benefit from antibot fallback
            // Errors like timeout, blocked requests, etc. (but not 404-like scenarios)
            if (antibotFallback) {
              const errorMessage = err?.message ?? ''
              // Don't fallback for 404 errors, but do for other failures like blocked/timeout
              const is404Error = errorMessage.includes('404') || errorMessage.includes('Not Found')
              if (!is404Error) {
                warn('[FETCH_HTML]', `Navigation error, triggering scrape.do fallback for url=${url}:`, errorMessage)
                await page.close()
                finished = true

                try {
                  const html = await fetchWithScrapeDo(url)
                  return { html, url, antibotFallbackUsed: true }
                } catch (fallbackErr) {
                  error('[FETCH_HTML]', `scrape.do fallback also failed:`, fallbackErr)
                  throw fallbackErr
                }
              }
            }
            error('[FETCH_HTML]', `Error during page navigation:`, err)
            await page.close()
            throw err
          }
        })(),
        // Global timeout for the whole function
        new Promise((_, reject) => {
          timeoutId = setTimeout(async () => {
            if (!finished) {
              warn('[FETCH_HTML]', `Timeout reached for url=${url} (slot ${index}) - releasing context`)
              await releaseContext(index)
            }
            reject(new Error('[FETCH_HTML] Fetch timeout'))
          }, timeoutMs)
        }),
      ])
    } finally {
      if (timeoutId) clearTimeout(timeoutId)
      // Always release the context (slot) after use
      await releaseContext(index)
    }
  },
})
