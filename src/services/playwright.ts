import { defineService } from '@andera-top/worker-core'
import { chromium, Browser, BrowserContext } from 'playwright'
import { config } from '../config'
import { log, warn, error } from '@andera-top/worker-core/dist/utils/logger'

// Playwright browser instance (shared)
let browser: Browser | null = null

// Context pool and status tracking
export const contexts: BrowserContext[] = []
export const contextStatus: ('free' | 'busy')[] = []
export const contextBusySince: (number | null)[] = []
export let browserVersion: string | null = null

export default defineService({
  config: { restartOnFailure: true },
  start: async () => {
    try {
      // Launch Chromium (Chrome for Testing)
      browser = await chromium.launch({ headless: true })

      // Create the context pool (slots)
      for (let i = 0; i < config.worker.slots; i++) {
        const contextOptions = {
          ...(config.htmlFetchWorkerSpecificConfig.allowIgnoreSslErrors ? { ignoreHTTPSErrors: true } : {}),
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
        const context = await browser.newContext(contextOptions)
        contexts.push(context)
        contextStatus.push('free')
        contextBusySince.push(null)
      }

      browserVersion = browser.version()
      log('[PLAYWRIGHT]', `${config.worker.slots} contexts opened and ready${config.htmlFetchWorkerSpecificConfig.allowIgnoreSslErrors ? ' (SSL errors ignored)' : ''}`)

      // Periodically force-release contexts that are stuck as busy for too long
      setInterval(() => {
        const now = Date.now()
        const timeoutLimit = config.worker.defaultTimeout ?? 30000
        for (let i = 0; i < contextStatus.length; i++) {
          if (contextStatus[i] === 'busy' && typeof contextBusySince[i] === 'number' && contextBusySince[i] !== null && Number.isFinite(contextBusySince[i])) {
            if (now - contextBusySince[i]! > timeoutLimit) {
              warn('[PLAYWRIGHT]', `Force-released context ${i} after ${now - contextBusySince[i]!}ms busy (since=${contextBusySince[i]!}, now=${now})`)
              contextStatus[i] = 'free'
              contextBusySince[i] = null
            }
          }
        }
      }, 10000)
    } catch (err: any) {
      error('[PLAYWRIGHT]', 'Failed to launch Playwright/Chromium:', err && err.stack ? err.stack : err)
      throw err
    }
  },
  stop: async () => {
    if (browser) await browser.close()
    browser = null
    contexts.length = 0
    contextStatus.length = 0
    contextBusySince.length = 0
    log('[PLAYWRIGHT]', 'Closed')
  },
  status: async () => ({
    browser: !!browser,
    freeContexts: contextStatus.filter(s => s === 'free').length,
    busyContexts: contextStatus.filter(s => s === 'busy').length,
  }),
}) as any

// Expose the browser for helpers
Object.defineProperty(exports.default, 'browser', {
  get() {
    return browser
  },
  enumerable: false,
})
