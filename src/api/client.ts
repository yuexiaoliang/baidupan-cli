import type { AxiosInstance } from 'axios'
import { ApiError } from '../errors'
import { BASE_URL, createHttpClient, http, OPENAPI_URL } from './http'
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
    (response) => {
      const data = response.data
      if (data && typeof data.errno === 'number' && data.errno !== 0) {
        const errorMsg = BaiduErrorCodes[data.errno] || `Unknown error: ${data.errno}`
        throw new ApiError(`Baidu API Error (${data.errno}): ${errorMsg}`, data.errno)
      }
      return response
    },
    async (error) => {
      // Check if token expired and try to refresh
      if (error.response?.data?.errno && tokenManager.isTokenExpiredError(error.response.data.errno)) {
        const newToken = await tokenManager.refreshAccessToken()
        if (newToken) {
          // Retry the request with new token
          const config = error.config
          config.params = { ...config.params, access_token: newToken }
          return http.request(config)
        }
      }

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
