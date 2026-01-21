import { defineCommand } from 'citty'
import { OPENAPI_URL } from '../api/client'

export default defineCommand({
  meta: {
    name: 'auth',
    description: 'Generate Baidu Pan authorization URL',
  },
  args: {
    appKey: {
      type: 'string',
      description: 'Your Baidu Pan App Key',
      alias: 'k',
    },
  },
  run({ args }) {
    const appKey = args.appKey || process.env.BAIDU_APP_KEY

    if (!appKey) {
      console.error('Error: App Key is required')
      console.error('Usage: baidupan-cli auth --app-key <your-app-key>')
      console.error('Or set BAIDU_APP_KEY environment variable')
      process.exit(1)
    }

    const authUrl = new URL(`${OPENAPI_URL}/oauth/2.0/authorize`)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('client_id', appKey)
    authUrl.searchParams.set('redirect_uri', 'oob')
    authUrl.searchParams.set('scope', 'basic,netdisk')

    console.log('Please visit the following URL to authorize:')
    console.log('')
    console.log(authUrl.toString())
    console.log('')
    console.log('After authorization, you will get an authorization code.')
    console.log('Then use the following command to get access token:')
    console.log('')
    console.log(`curl "${OPENAPI_URL}/oauth/2.0/token?grant_type=authorization_code&code=<CODE>&client_id=${appKey}&client_secret=<SECRET_KEY>&redirect_uri=oob"`)
    console.log('')
    console.log('Finally, set the access token:')
    console.log('export BAIDU_ACCESS_TOKEN=<your_access_token>')
  },
})
