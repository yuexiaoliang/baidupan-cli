import * as readline from 'node:readline'
import { URL } from 'node:url'
import { defineCommand } from 'citty'
import { http as httpClient, OPENAPI_URL } from '../api/http'
import { AuthError } from '../errors'
import { logger } from '../logger'
import { getConfigPath, saveConfig } from '../utils/config'

interface TokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  scope: string
}

export default defineCommand({
  meta: {
    name: 'auth',
    description: 'Authorize with Baidu Pan',
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
      description: 'Redirect URI configured in Baidu Pan (default: oob)',
      alias: 'r',
    },
  },
  async run({ args }) {
    const appKey = args.appKey || process.env.BAIDU_APP_KEY
    const secretKey = args.secretKey || process.env.BAIDU_SECRET_KEY
    // 使用 oob 作为默认 redirect_uri，这是百度支持的特殊值
    const redirectUri = args.redirectUri || 'oob'

    if (!appKey) {
      throw new AuthError(
        'App Key is required. Usage: baidupan-cli auth -k <app-key> -s <secret-key>\n'
        + 'Or set BAIDU_APP_KEY environment variable',
      )
    }

    if (!secretKey) {
      throw new AuthError(
        'Secret Key is required. Usage: baidupan-cli auth -k <app-key> -s <secret-key>\n'
        + 'Or set BAIDU_SECRET_KEY environment variable',
      )
    }

    // 生成授权 URL
    const authUrl = buildAuthUrl(appKey, redirectUri)

    logger.box('百度网盘授权')

    logger.info('请在浏览器中打开以下链接进行授权:')
    logger.info('')
    logger.info(authUrl)
    logger.info('')

    // 尝试自动打开浏览器
    openBrowser(authUrl)

    logger.info('授权完成后，你会被重定向到一个页面。')
    logger.info('请从浏览器地址栏或页面中复制 "code" 参数的值。')
    logger.info('')

    // 等待用户输入 code
    const code = await promptForCode()

    if (!code.trim()) {
      throw new AuthError('Authorization code cannot be empty')
    }

    logger.info('正在换取 Access Token...')

    const tokenData = await exchangeCodeForToken(appKey, secretKey, code.trim(), redirectUri)
    saveTokensAndPrintSuccess(tokenData, appKey, secretKey)
  },
})

function buildAuthUrl(appKey: string, redirectUri: string): string {
  const authUrl = new URL(`${OPENAPI_URL}/oauth/2.0/authorize`)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('client_id', appKey)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('scope', 'basic,netdisk')
  return authUrl.toString()
}

function promptForCode(): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    })

    rl.question('请输入授权码 (code): ', (answer) => {
      rl.close()
      resolve(answer)
    })
  })
}

async function exchangeCodeForToken(
  appKey: string,
  secretKey: string,
  code: string,
  redirectUri: string,
): Promise<TokenResponse> {
  const response = await httpClient.get<TokenResponse>(`${OPENAPI_URL}/oauth/2.0/token`, {
    params: {
      grant_type: 'authorization_code',
      code,
      client_id: appKey,
      client_secret: secretKey,
      redirect_uri: redirectUri,
    },
  }).catch((err) => {
    throw new AuthError(`Failed to exchange code for token: ${err.message}`)
  })

  if (!response.data.access_token) {
    // Check for error response
    const errorData = response.data as unknown as { error?: string, error_description?: string }
    if (errorData.error) {
      throw new AuthError(`${errorData.error}: ${errorData.error_description || 'Unknown error'}`)
    }
    throw new AuthError('Failed to get access token')
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
        logger.warn('无法自动打开浏览器，请手动复制上方链接')
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

  logger.box('授权成功!')
  logger.info(`Token 已保存到: ${configPath}`)
  logger.info(`Access Token 过期时间: ${expiresAt.toLocaleString()}`)
  logger.info('本机可直接使用，无需额外配置。')

  logger.info('\n如需在其他服务器使用，复制配置文件:')
  logger.info(`scp ${configPath} user@server:~/.baidupan-cli/config.json`)

  logger.info('\n或设置环境变量:')
  logger.info(`export BAIDU_ACCESS_TOKEN="${tokenData.access_token}"`)
  logger.info(`export BAIDU_REFRESH_TOKEN="${tokenData.refresh_token}"`)
  logger.info(`export BAIDU_APP_KEY="${appKey}"`)
  logger.info(`export BAIDU_SECRET_KEY="${secretKey}"`)

  logger.info('\n提示: Token 过期后会自动刷新并保存，无需手动操作')
}
