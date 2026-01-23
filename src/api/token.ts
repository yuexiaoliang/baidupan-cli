import { AuthError } from '../errors'
import { logger } from '../logger'
import { loadConfig, updateConfig } from '../utils/config'
import { http, OPENAPI_URL } from './http'

interface RefreshTokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
}

/**
 * Token manager class for handling Baidu API authentication
 */
class TokenManager {
  private currentAccessToken: string | null = null

  /**
   * Get access token from env or config file
   * Priority: env > config file
   */
  getAccessToken(): string {
    if (this.currentAccessToken) {
      return this.currentAccessToken
    }

    // First try environment variable
    const envToken = process.env.BAIDU_ACCESS_TOKEN
    if (envToken) {
      this.currentAccessToken = envToken
      return envToken
    }

    // Then try config file
    const config = loadConfig()
    if (config.access_token) {
      this.currentAccessToken = config.access_token
      return config.access_token
    }

    throw new AuthError(
      'Access token not found. Please run: baidupan-cli auth -k <app-key> -s <secret-key>',
    )
  }

  /**
   * Get refresh token from env or config file
   */
  getRefreshToken(): string | null {
    return process.env.BAIDU_REFRESH_TOKEN || loadConfig().refresh_token || null
  }

  /**
   * Get app credentials from env or config file
   */
  getAppCredentials(): { appKey: string | null, secretKey: string | null } {
    const config = loadConfig()
    return {
      appKey: process.env.BAIDU_APP_KEY || config.app_key || null,
      secretKey: process.env.BAIDU_SECRET_KEY || config.secret_key || null,
    }
  }

  /**
   * Check if error code indicates token expiration
   */
  isTokenExpiredError(errno: number): boolean {
    // -6: Invalid access token
    // 111: Access token expired
    return errno === -6 || errno === 111
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(): Promise<string | null> {
    const refreshToken = this.getRefreshToken()
    const { appKey, secretKey } = this.getAppCredentials()

    if (!refreshToken || !appKey || !secretKey) {
      return null
    }

    logger.info('Access token expired, refreshing...')

    try {
      const response = await http.get<RefreshTokenResponse>(`${OPENAPI_URL}/oauth/2.0/token`, {
        params: {
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: appKey,
          client_secret: secretKey,
        },
      })

      if (response.data.access_token) {
        this.currentAccessToken = response.data.access_token

        // Auto-save new tokens to config file
        updateConfig({
          access_token: response.data.access_token,
          refresh_token: response.data.refresh_token,
          expires_at: Date.now() + response.data.expires_in * 1000,
        })

        logger.success('Token refreshed and saved automatically!')
        return response.data.access_token
      }
    }
    catch (error) {
      logger.error('Failed to refresh token:', error instanceof Error ? error.message : error)
      logger.info('Please re-run: baidupan-cli auth -k <app-key> -s <secret-key>')
    }

    return null
  }

  /**
   * Set access token (used after successful authentication)
   */
  setAccessToken(token: string): void {
    this.currentAccessToken = token
  }

  /**
   * Clear cached token
   */
  clearToken(): void {
    this.currentAccessToken = null
  }
}

// Singleton instance
export const tokenManager = new TokenManager()
