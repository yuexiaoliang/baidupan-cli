import type { AxiosInstance } from 'axios'
import axios from 'axios'
import axiosRetry from 'axios-retry'
import { logger } from '../logger'

export const BASE_URL = 'https://pan.baidu.com'
export const OPENAPI_URL = 'https://openapi.baidu.com'

const DEFAULT_TIMEOUT = 30000
const DEFAULT_USER_AGENT = 'pan.baidu.com'

/**
 * Base axios instance with common configuration
 */
export const http = axios.create({
  timeout: DEFAULT_TIMEOUT,
  proxy: false,
  headers: {
    'User-Agent': DEFAULT_USER_AGENT,
  },
})

// Configure retry behavior
axiosRetry(http, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) => {
    // Retry on network errors or 5xx errors or rate limiting
    return axiosRetry.isNetworkOrIdempotentRequestError(error)
      || error.response?.status === 429
      || (error.response?.status ?? 0) >= 500
  },
  onRetry: (retryCount, error) => {
    logger.warn(`Request failed, retry attempt ${retryCount}: ${error.message}`)
  },
})

/**
 * Create a new axios instance with base configuration
 */
export function createHttpClient(baseURL?: string): AxiosInstance {
  const client = axios.create({
    baseURL,
    timeout: DEFAULT_TIMEOUT,
    proxy: false,
    headers: {
      'User-Agent': DEFAULT_USER_AGENT,
    },
  })

  axiosRetry(client, {
    retries: 3,
    retryDelay: axiosRetry.exponentialDelay,
    retryCondition: (error) => {
      return axiosRetry.isNetworkOrIdempotentRequestError(error)
        || error.response?.status === 429
        || (error.response?.status ?? 0) >= 500
    },
    onRetry: (retryCount, error) => {
      logger.warn(`Request failed, retry attempt ${retryCount}: ${error.message}`)
    },
  })

  return client
}
