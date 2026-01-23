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

    logger.info(`正在查找: ${remotePath}`)

    const listResult = await api.listFiles(dir)
    const file = listResult.list.find(
      f => f.server_filename === fileName || f.path === remotePath,
    )

    if (!file) {
      throw new FileError(`文件不存在: ${remotePath}`)
    }

    // Handle directory download
    if (file.isdir) {
      if (!args.recursive) {
        throw new FileError('无法下载目录，请使用 -r 参数进行递归下载')
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
  logger.info(`正在下载目录: ${remotePath}`)

  // Get all files recursively
  const allFiles = await getAllRemoteFiles(api, remotePath)

  if (allFiles.length === 0) {
    logger.info('没有文件需要下载')
    return
  }

  logger.info(`发现 ${allFiles.length} 个文件待下载`)

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

    logger.info(`\n正在下载: ${relativePath}`)
    await downloadFile(api, file, localFilePath, true)

    downloaded++
    logger.info(`进度: ${downloaded}/${allFiles.length} 个文件`)
  }

  logger.success(`下载完成！共 ${downloaded} 个文件`)
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

  logger.info(`找到文件: ${file.server_filename} (${formatSize(file.size)})`)

  // Get download link
  logger.start('获取下载链接...')
  const metaResult = await api.getFileMetas([file.fs_id], true)

  if (!metaResult.list || metaResult.list.length === 0 || !metaResult.list[0].dlink) {
    throw new FileError('无法获取下载链接')
  }

  const dlink = metaResult.list[0].dlink
  const token = tokenManager.getAccessToken()

  logger.info(`下载到: ${finalLocalPath}`)

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
    process.stderr.write(`\r下载中: ${percent}% (${downloadedStr}/${totalStr})`)
  })

  // Use pipeline for proper stream handling
  await pipeline(response.data, writer)

  process.stderr.write('\n')
  logger.success('下载完成！')
  logger.info(`保存到: ${path.resolve(finalLocalPath)}`)
}
