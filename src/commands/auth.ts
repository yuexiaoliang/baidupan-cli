import http from 'node:http'
import { URL } from 'node:url'
import axios from 'axios'
import { defineCommand } from 'citty'
import { OPENAPI_URL } from '../api/client'
import { getConfigPath, saveConfig } from '../utils/config'

const DEFAULT_PORT = 9876
const DEFAULT_HOST = 'localhost'
const DEFAULT_REDIRECT_PATH = '/callback'

interface TokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  scope: string
}

export default defineCommand({
  meta: {
    name: 'auth',
    description: 'Authorize with Baidu Pan (auto open browser)',
  },
  args: {
    appKey: {
      type: 'string',
      description: 'Baidu Pan App Key',
      alias: 'k',
    },
    secretKey: {
      type: 'string',
      description: 'Baidu Pan Secret Key',
      alias: 's',
    },
    redirectUri: {
      type: 'string',
      description: 'Custom redirect URI (e.g., https://example.com/callback)',
      alias: 'r',
    },
    port: {
      type: 'string',
      description: `Local server port (default: ${DEFAULT_PORT})`,
      alias: 'p',
    },
  },
  async run({ args }) {
    const appKey = args.appKey || process.env.BAIDU_APP_KEY
    const secretKey = args.secretKey || process.env.BAIDU_SECRET_KEY
    const port = Number.parseInt(args.port || String(DEFAULT_PORT), 10)

    if (!appKey) {
      console.error('Error: App Key is required')
      console.error('Usage: baidupan-cli auth -k <app-key> -s <secret-key>')
      console.error('Or set BAIDU_APP_KEY environment variable')
      process.exit(1)
    }

    if (!secretKey) {
      console.error('Error: Secret Key is required')
      console.error('Usage: baidupan-cli auth -k <app-key> -s <secret-key>')
      console.error('Or set BAIDU_SECRET_KEY environment variable')
      process.exit(1)
    }

    // Support custom redirect URI or use default localhost
    const redirectUri = args.redirectUri || `http://${DEFAULT_HOST}:${port}${DEFAULT_REDIRECT_PATH}`
    const redirectPath = args.redirectUri ? new URL(args.redirectUri).pathname : DEFAULT_REDIRECT_PATH

    console.log('Starting local server for OAuth callback...')
    console.log(`Callback URL: ${redirectUri}`)
    console.log('')
    console.log('IMPORTANT: Make sure this URL is added to your app\'s redirect URI list')
    console.log('in Baidu Pan Open Platform: https://pan.baidu.com/union/console/applist')
    console.log('')

    try {
      const code = await startServerAndWaitForCode(port, appKey, redirectUri, redirectPath)
      console.log('\nAuthorization code received!')
      console.log('Exchanging code for access token...')

      const tokenData = await exchangeCodeForToken(appKey, secretKey, code, redirectUri)
      console.log(`🚀 > tokenData:`, tokenData)

      saveTokensAndPrintSuccess(tokenData, appKey, secretKey)
    }
    catch (error) {
      console.log(`🚀 > error:`, error.config)
      console.error('Error:', error instanceof Error ? error.message : error)
      process.exit(1)
    }
  },
})

function startServerAndWaitForCode(port: number, appKey: string, redirectUri: string, redirectPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url || '/', `http://localhost:${port}`)

      if (url.pathname === redirectPath) {
        const code = url.searchParams.get('code')
        const error = url.searchParams.get('error')

        if (error) {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
          res.end(`<html><body><h1>授权失败</h1><p>${error}</p></body></html>`)
          server.close()
          reject(new Error(`Authorization failed: ${error}`))
          return
        }

        if (code) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
          res.end(`
            <html>
              <body style="font-family: sans-serif; text-align: center; padding-top: 50px;">
                <h1>✓ 授权成功</h1>
                <p>请返回终端查看结果，可以关闭此页面。</p>
              </body>
            </html>
          `)
          server.close()
          resolve(code)
          return
        }
      }

      res.writeHead(404)
      res.end('Not Found')
    })

    server.listen(port, () => {
      const authUrl = new URL(`${OPENAPI_URL}/oauth/2.0/authorize`)
      authUrl.searchParams.set('response_type', 'code')
      authUrl.searchParams.set('client_id', appKey)
      authUrl.searchParams.set('redirect_uri', redirectUri)
      authUrl.searchParams.set('scope', 'basic,netdisk')

      console.log('Opening browser for authorization...')
      console.log('')

      // Open browser
      openBrowser(authUrl.toString())

      console.log('If browser does not open automatically, visit:')
      console.log(authUrl.toString())
      console.log('')
      console.log('Waiting for authorization...')
    })

    server.on('error', (err) => {
      reject(new Error(`Failed to start server on port ${port}: ${err.message}`))
    })

    // Timeout after 5 minutes
    setTimeout(() => {
      server.close()
      reject(new Error('Authorization timeout (5 minutes)'))
    }, 5 * 60 * 1000)
  })
}

async function exchangeCodeForToken(
  appKey: string,
  secretKey: string,
  code: string,
  redirectUri: string,
): Promise<TokenResponse> {
  const response = await axios.get<TokenResponse>(`${OPENAPI_URL}/oauth/2.0/token`, {
    params: {
      grant_type: 'authorization_code',
      code,
      client_id: appKey,
      client_secret: secretKey,
      redirect_uri: redirectUri,
    },
    timeout: 10000,
    headers: {
      'User-Agent': 'pan.baidu.com',
    },
    proxy: false,
  })

  if (!response.data.access_token) {
    // Check for error response
    const errorData = response.data as unknown as { error?: string, error_description?: string }
    if (errorData.error) {
      throw new Error(`${errorData.error}: ${errorData.error_description || 'Unknown error'}`)
    }
    throw new Error('Failed to get access token')
  }

  return response.data
}

function openBrowser(url: string): void {
  const { platform } = process
  let command: string

  switch (platform) {
    case 'darwin':
      command = `open "${url}"`
      break
    case 'win32':
      command = `start "" "${url}"`
      break
    default:
      command = `xdg-open "${url}"`
  }

  import('node:child_process').then(({ exec }) => {
    exec(command, (error) => {
      if (error) {
        console.error('Could not open browser automatically')
      }
    })
  })
}

function saveTokensAndPrintSuccess(tokenData: TokenResponse, appKey: string, secretKey: string): void {
  const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000)

  // Save to config file
  saveConfig({
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    app_key: appKey,
    secret_key: secretKey,
    expires_at: expiresAt.getTime(),
  })

  const configPath = getConfigPath()

  console.log('')
  console.log('='.repeat(60))
  console.log('授权成功！')
  console.log('='.repeat(60))
  console.log('')
  console.log(`Token 已保存到: ${configPath}`)
  console.log(`Access Token 过期时间: ${expiresAt.toLocaleString()}`)
  console.log('')
  console.log('本机可直接使用，无需额外配置。')
  console.log('')
  console.log('如需在其他服务器使用，复制配置文件:')
  console.log('-'.repeat(60))
  console.log(`scp ${configPath} user@server:~/.baidupan-cli/config.json`)
  console.log('-'.repeat(60))
  console.log('')
  console.log('或设置环境变量:')
  console.log('-'.repeat(60))
  console.log(`export BAIDU_ACCESS_TOKEN="${tokenData.access_token}"`)
  console.log(`export BAIDU_REFRESH_TOKEN="${tokenData.refresh_token}"`)
  console.log(`export BAIDU_APP_KEY="${appKey}"`)
  console.log(`export BAIDU_SECRET_KEY="${secretKey}"`)
  console.log('-'.repeat(60))
  console.log('')
  console.log('提示: Token 过期后会自动刷新并保存，无需手动操作')
  console.log('')
}
