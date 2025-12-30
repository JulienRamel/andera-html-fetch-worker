import { contexts, contextStatus, contextBusySince } from '../services/playwright'
import { warn } from '@andera-top/worker-core/dist/utils/logger'
import type { BrowserContext } from 'playwright'

// Track which slots are being released to avoid race conditions
const releaseInProgress = new Set<number>()

// Try to get a free Playwright context (slot) from the pool
export async function getFreeContext(): Promise<{ context: BrowserContext; index: number } | null> {
  for (let i = 0; i < contexts.length; i++) {
    if (contextStatus[i] === 'free') {
      contextStatus[i] = 'busy'
      contextBusySince[i] = Date.now()
      return { context: contexts[i], index: i }
    }
  }
  return null
}

// Release a Playwright context (slot) after use
export async function releaseContext(index: number) {
  if (releaseInProgress.has(index)) {
    warn('[PLAYWRIGHT]', `releaseContext already in progress for context ${index}, skipping.`)
    return
  }
  releaseInProgress.add(index)
  if (contextStatus[index] === 'busy') {
    try {
      await contexts[index].clearCookies()
      await contexts[index].clearPermissions()
    } catch (e) {
      warn('[PLAYWRIGHT]', `Failed to clean context ${index}: ${e}`)
    }
    contextStatus[index] = 'free'
    contextBusySince[index] = null
  }
  releaseInProgress.delete(index)
}
