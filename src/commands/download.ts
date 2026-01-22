import fs from 'node:fs'
import path from 'node:path'
import axios from 'axios'
import { defineCommand } from 'citty'
import { createClient, getAccessToken } from '../api/client'
import { BaiduPanApi } from '../api/file'
import { formatSize, normalizePath } from '../utils'

export default defineCommand({
  meta: {
    name: 'download',
    description: 'Download file from Baidu Pan',
  },
  args: {
    remote: {
      type: 'positional',
      description: 'Remote file path on Baidu Pan',
      required: true,
    },
    local: {
      type: 'positional',
      description: 'Local save path (optional, defaults to current directory)',
    },
  },
  async run({ args }) {
    const client = createClient()
    const api = new BaiduPanApi(client)

    const remotePath = normalizePath(args.remote)

    try {
      // First, get file list to find the file
      const dir = path.dirname(remotePath)
      const fileName = path.basename(remotePath)

      console.log(`Looking for: ${remotePath}`)

      const listResult = await api.listFiles(dir)
      const file = listResult.list.find(
        f => f.server_filename === fileName || f.path === remotePath,
      )

      if (!file) {
        console.error(`Error: File not found: ${remotePath}`)
        process.exit(1)
      }

      if (file.isdir) {
        console.error('Error: Cannot download a directory')
        process.exit(1)
      }

      console.log(`Found file: ${file.server_filename} (${formatSize(file.size)})`)

      // Get download link
      console.log('Getting download link...')
      const metaResult = await api.getFileMetas([file.fs_id], true)

      if (!metaResult.list || metaResult.list.length === 0 || !metaResult.list[0].dlink) {
        console.error('Error: Could not get download link')
        process.exit(1)
      }

      const dlink = metaResult.list[0].dlink
      const token = getAccessToken()

      // Determine local path
      let localPath = args.local
      if (!localPath) {
        localPath = file.server_filename
      }
      else if (fs.existsSync(localPath) && fs.statSync(localPath).isDirectory()) {
        localPath = path.join(localPath, file.server_filename)
      }

      console.log(`Downloading to: ${localPath}`)

      // Download file
      const response = await axios.get(`${dlink}&access_token=${token}`, {
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': 'pan.baidu.com',
        },
        proxy: false,
        onDownloadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percent = Math.round((progressEvent.loaded / progressEvent.total) * 100)
            process.stderr.write(`\rDownloading: ${percent}%`)
          }
        },
      })

      // Save file
      fs.writeFileSync(localPath, Buffer.from(response.data))
      console.log('\nDownload complete!')
      console.log(`Saved to: ${path.resolve(localPath)}`)
    }
    catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error)
      process.exit(1)
    }
  },
})
