import dotenv from 'dotenv'
dotenv.config()

import { bootstrap } from '@andera-top/worker-core/dist/app'
import { config } from './config'
import path from 'path'
import { error } from '@andera-top/worker-core/dist/utils/logger'

async function startHtmlFetchWorker() {
  try {
    await bootstrap(config, path.resolve(__dirname))
  } catch (error_) {
    error('[WORKER]', 'Failed to start the worker:', error_)
    process.exit(1)
  }
}

startHtmlFetchWorker()
