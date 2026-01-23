import type { AxiosInstance } from 'axios'
import { ApiError } from '../errors'
import { BASE_URL, createHttpClient, OPENAPI_URL } from './http'
import { tokenManager } from './token'
import { BaiduErrorCodes } from './types'

/**
 * Create authenticated client for Baidu Pan API
 */
export function createClient(): AxiosInstance {
  const token = tokenManager.getAccessToken()

  const client = createHttpClient(BASE_URL)

  // Add default access_token param
  client.defaults.params = {
    access_token: token,
  }

  // Response interceptor for error handling and token refresh
  client.interceptors.response.use(
    async (response) => {
      const data = response.data

      // Check for API errors in response body (HTTP 200 but errno !== 0)
      if (data && typeof data.errno === 'number' && data.errno !== 0) {
        // Check if token expired and try to refresh
        if (tokenManager.isTokenExpiredError(data.errno)) {
          const newToken = await tokenManager.refreshAccessToken()
          if (newToken) {
            // Retry the request with new token
            const config = response.config
            config.params = { ...config.params, access_token: newToken }
            return client.request(config)
          }
        }

        const errorMsg = BaiduErrorCodes[data.errno] || `Unknown error: ${data.errno}`
        throw new ApiError(`Baidu API Error (${data.errno}): ${errorMsg}`, data.errno)
      }
      return response
    },
    async (error) => {
      // Handle HTTP errors (4xx/5xx)
      if (error.response) {
        throw new ApiError(`HTTP Error: ${error.response.status} ${error.response.statusText}`)
      }
      throw error
    },
  )

  // Request interceptor to use current token
  client.interceptors.request.use((config) => {
    const currentToken = tokenManager.getAccessToken()
    config.params = { ...config.params, access_token: currentToken }
    return config
  })

  return client
}

/**
 * Create client for Baidu OpenAPI (OAuth)
 */
export function createOpenApiClient(): AxiosInstance {
  return createHttpClient(OPENAPI_URL)
}

// Re-export for convenience
export { BASE_URL, http, OPENAPI_URL } from './http'
export { tokenManager } from './token'
