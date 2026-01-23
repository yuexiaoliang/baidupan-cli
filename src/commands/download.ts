import type { FileItem } from '../api/types'
import fs from 'node:fs'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import { defineCommand } from 'citty'
import { createClient, http, tokenManager } from '../api/client'
import { BaiduPanApi } from '../api/file'
import { FileError } from '../errors'
import { logger } from '../logger'
import { formatSize, normalizePath } from '../utils'

export default defineCommand({
  meta: {
    name: 'download',
    description: 'Download file or directory from Baidu Pan',
  },
  args: {
    remote: {
      type: 'positional',
      description: 'Remote file/directory path on Baidu Pan',
      required: true,
    },
    local: {
      type: 'positional',
      description: 'Local save path (optional, defaults to current directory)',
    },
    recursive: {
      type: 'boolean',
      description: 'Download directory recursively',
      alias: 'r',
      default: false,
    },
  },
  async run({ args }) {
    const client = createClient()
    const api = new BaiduPanApi(client)

    const remotePath = normalizePath(args.remote)
    const localBasePath = args.local || '.'

    // First, get file list to find the file
    const dir = path.dirname(remotePath)
    const fileName = path.basename(remotePath)

    logger.info(`Looking for: ${remotePath}`)

    const listResult = await api.listFiles(dir)
    const file = listResult.list.find(
      f => f.server_filename === fileName || f.path === remotePath,
    )

    if (!file) {
      throw new FileError(`File not found: ${remotePath}`)
    }

    // Handle directory download
    if (file.isdir) {
      if (!args.recursive) {
        throw new FileError('Cannot download a directory. Use -r flag for recursive download.')
      }

      await downloadDirectory(api, remotePath, localBasePath)
      return
    }

    // Handle single file download
    await downloadFile(api, file, localBasePath)
  },
})

async function downloadDirectory(
  api: BaiduPanApi,
  remotePath: string,
  localBasePath: string,
): Promise<void> {
  logger.info(`Downloading directory: ${remotePath}`)

  // Get all files recursively
  const allFiles = await getAllRemoteFiles(api, remotePath)

  if (allFiles.length === 0) {
    logger.info('No files to download')
    return
  }

  logger.info(`Found ${allFiles.length} files to download`)

  let downloaded = 0
  for (const file of allFiles) {
    // Calculate relative path from remote base
    const relativePath = file.path.substring(remotePath.length + 1)
    const localFilePath = path.join(localBasePath, path.basename(remotePath), relativePath)

    // Create parent directory if needed
    const parentDir = path.dirname(localFilePath)
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true })
    }

    logger.info(`\nDownloading: ${relativePath}`)
    await downloadFile(api, file, localFilePath, true)

    downloaded++
    logger.info(`Progress: ${downloaded}/${allFiles.length} files`)
  }

  logger.success(`Done! Downloaded ${downloaded} files`)
}

async function getAllRemoteFiles(api: BaiduPanApi, remotePath: string): Promise<FileItem[]> {
  const result: FileItem[] = []
  const dirs: string[] = [remotePath]

  while (dirs.length > 0) {
    const currentDir = dirs.pop()!
    const listResult = await api.listFiles(currentDir)

    for (const item of listResult.list) {
      if (item.isdir) {
        dirs.push(item.path)
      }
      else {
        result.push(item)
      }
    }
  }

  return result
}

async function downloadFile(
  api: BaiduPanApi,
  file: FileItem,
  localPath: string,
  isExactPath: boolean = false,
): Promise<void> {
  // Determine final local path
  let finalLocalPath = localPath
  if (!isExactPath) {
    if (fs.existsSync(localPath) && fs.statSync(localPath).isDirectory()) {
      finalLocalPath = path.join(localPath, file.server_filename)
    }
    else if (!localPath || localPath === '.') {
      finalLocalPath = file.server_filename
    }
  }

  logger.info(`Found file: ${file.server_filename} (${formatSize(file.size)})`)

  // Get download link
  logger.start('Getting download link...')
  const metaResult = await api.getFileMetas([file.fs_id], true)

  if (!metaResult.list || metaResult.list.length === 0 || !metaResult.list[0].dlink) {
    throw new FileError('Could not get download link')
  }

  const dlink = metaResult.list[0].dlink
  const token = tokenManager.getAccessToken()

  logger.info(`Downloading to: ${finalLocalPath}`)

  // Stream download for large files
  const response = await http.get(`${dlink}&access_token=${token}`, {
    responseType: 'stream',
    timeout: 0, // No timeout for large file downloads
  })

  // Create write stream
  const writer = fs.createWriteStream(finalLocalPath)

  // Track progress
  let downloaded = 0
  const total = file.size

  response.data.on('data', (chunk: Buffer) => {
    downloaded += chunk.length
    const percent = Math.round((downloaded / total) * 100)
    const downloadedStr = formatSize(downloaded)
    const totalStr = formatSize(total)
    process.stderr.write(`\rDownloading: ${percent}% (${downloadedStr}/${totalStr})`)
  })

  // Use pipeline for proper stream handling
  await pipeline(response.data, writer)

  process.stderr.write('\n')
  logger.success('Download complete!')
  logger.info(`Saved to: ${path.resolve(finalLocalPath)}`)
}
