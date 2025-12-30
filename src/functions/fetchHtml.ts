import { defineFunction } from '@andera-top/worker-core'
import { getFreeContext, releaseContext } from '../helpers/playwrightPool'
import { log, warn, error } from '@andera-top/worker-core/dist/utils/logger'
import { URL } from 'url'

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

export const fetchHtml = defineFunction({
  params: {
    url: { type: 'string', required: true },
    waitForSelector: { type: 'string', required: false },
    delay: { type: 'number', required: false },
    userAgent: { type: 'string', required: false },
  },
  config: {
    timeout: 30000,
    logResult: false,
  },
  handler: async (params, context) => {
    // Extract and validate input parameters
    const { url, waitForSelector, delay, userAgent } = params
    validateUrlBasic(url)

    log('[FETCH_HTML]', `Fetching HTML: url=${url}, waitForSelector=${waitForSelector}, delay=${delay}, userAgent=${userAgent ? 'custom' : 'default'}`)

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

            // Navigate to the target URL
            await page.goto(url, { waitUntil: 'networkidle', timeout: timeoutMs })

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
          } catch (err) {
            error('[FETCH_HTML]', `Error during page.content():`, err)
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
