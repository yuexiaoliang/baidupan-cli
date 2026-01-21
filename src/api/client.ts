import type { AxiosInstance } from 'axios'
import axios from 'axios'
import { BaiduErrorCodes } from './types'

const BASE_URL = 'https://pan.baidu.com'
const OPENAPI_URL = 'https://openapi.baidu.com'

export function getAccessToken(): string {
  const token = process.env.BAIDU_ACCESS_TOKEN
  if (!token) {
    console.error('Error: BAIDU_ACCESS_TOKEN environment variable is not set')
    console.error('Please set it with: export BAIDU_ACCESS_TOKEN=your_token')
    process.exit(1)
  }
  return token
}

export function createClient(): AxiosInstance {
  const token = getAccessToken()

  const client = axios.create({
    baseURL: BASE_URL,
    timeout: 30000,
    params: {
      access_token: token,
    },
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
    (error) => {
      if (error.response) {
        throw new Error(`HTTP Error: ${error.response.status} ${error.response.statusText}`)
      }
      throw error
    },
  )

  return client
}

export function createOpenApiClient(): AxiosInstance {
  return axios.create({
    baseURL: OPENAPI_URL,
    timeout: 30000,
  })
}

export { BASE_URL, OPENAPI_URL }
