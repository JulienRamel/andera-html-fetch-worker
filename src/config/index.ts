import { config as coreConfig } from '@andera-top/worker-core/dist/config'

interface HtmlFetchWorkerConfig {
  htmlFetchWorkerSpecificConfig: {
    allowIgnoreSslErrors: boolean
    scrapeDoApiKey: string | null
  }
  port: number
  websocketPort: number
  requestBodyLimit: string
}

export type Config = typeof coreConfig & HtmlFetchWorkerConfig

export const config: Config = {
  ...coreConfig,
  htmlFetchWorkerSpecificConfig: {
    allowIgnoreSslErrors: process.env.ALLOW_IGNORE_SSL_ERRORS === 'true',
    scrapeDoApiKey: process.env.SCRAPE_DO_API_KEY || null,
  },
  port: parseInt(process.env.PORT || '3000', 10),
  websocketPort: parseInt(process.env.WEBSOCKET_PORT || '3001', 10),
  requestBodyLimit: process.env.REQUEST_BODY_LIMIT || '10mb',
}
