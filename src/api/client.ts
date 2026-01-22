import type { AxiosInstance } from 'axios'
import axios from 'axios'
import { loadConfig, updateConfig } from '../utils/config'
import { BaiduErrorCodes } from './types'

const BASE_URL = 'https://pan.baidu.com'
const OPENAPI_URL = 'https://openapi.baidu.com'

let currentAccessToken: string | null = null

/**
 * Get access token from env or config file
 * Priority: env > config file
 */
export function getAccessToken(): string {
  if (currentAccessToken) {
    return currentAccessToken
  }

  // First try environment variable
  const envToken = process.env.BAIDU_ACCESS_TOKEN
  if (envToken) {
    currentAccessToken = envToken
    return envToken
  }

  // Then try config file
  const config = loadConfig()
  if (config.access_token) {
    currentAccessToken = config.access_token
    return config.access_token
  }

  console.error('Error: Access token not found')
  console.error('Please run: baidupan-cli auth -k <app-key> -s <secret-key>')
  process.exit(1)
}

/**
 * Get refresh token from env or config file
 */
export function getRefreshToken(): string | null {
  return process.env.BAIDU_REFRESH_TOKEN || loadConfig().refresh_token || null
}

/**
 * Get app credentials from env or config file
 */
export function getAppCredentials(): { appKey: string | null, secretKey: string | null } {
  const config = loadConfig()
  return {
    appKey: process.env.BAIDU_APP_KEY || config.app_key || null,
    secretKey: process.env.BAIDU_SECRET_KEY || config.secret_key || null,
  }
}

interface RefreshTokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken()
  const { appKey, secretKey } = getAppCredentials()

  if (!refreshToken || !appKey || !secretKey) {
    return null
  }

  console.error('Access token expired, refreshing...')

  try {
    const response = await axios.get<RefreshTokenResponse>(`${OPENAPI_URL}/oauth/2.0/token`, {
      params: {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: appKey,
        client_secret: secretKey,
      },
      proxy: false,
    })

    if (response.data.access_token) {
      currentAccessToken = response.data.access_token

      // Auto-save new tokens to config file
      updateConfig({
        access_token: response.data.access_token,
        refresh_token: response.data.refresh_token,
        expires_at: Date.now() + response.data.expires_in * 1000,
      })

      console.error('Token refreshed and saved automatically!')
      return response.data.access_token
    }
  }
  catch (error) {
    console.error('Failed to refresh token:', error instanceof Error ? error.message : error)
    console.error('Please re-run: baidupan-cli auth -k <app-key> -s <secret-key>')
  }

  return null
}

function isTokenExpiredError(errno: number): boolean {
  // -6: Invalid access token
  // 111: Access token expired
  return errno === -6 || errno === 111
}

export function createClient(): AxiosInstance {
  const token = getAccessToken()

  const client = axios.create({
    baseURL: BASE_URL,
    timeout: 30000,
    params: {
      access_token: token,
    },
    proxy: false,
  })

  client.interceptors.response.use(
    (response) => {
      const data = response.data
      if (data && typeof data.errno === 'number' && data.errno !== 0) {
        const errorMsg = BaiduErrorCodes[data.errno] || `Unknown error: ${data.errno}`
        throw new Error(`Baidu API Error (${data.errno}): ${errorMsg}`)
      }
      return response
    },
    async (error) => {
      // Check if token expired and try to refresh
      if (error.response?.data?.errno && isTokenExpiredError(error.response.data.errno)) {
        const newToken = await refreshAccessToken()
        if (newToken) {
          // Retry the request with new token
          const config = error.config
          config.params = { ...config.params, access_token: newToken }
          return axios.request(config)
        }
      }

      if (error.response) {
        throw new Error(`HTTP Error: ${error.response.status} ${error.response.statusText}`)
      }
      throw error
    },
  )

  // Intercept request to use current token
  client.interceptors.request.use((config) => {
    if (currentAccessToken) {
      config.params = { ...config.params, access_token: currentAccessToken }
    }
    return config
  })

  return client
}

export function createOpenApiClient(): AxiosInstance {
  return axios.create({
    baseURL: OPENAPI_URL,
    timeout: 30000,
  })
}

export { BASE_URL, OPENAPI_URL }
