import fs from 'node:fs'
import path from 'node:path'
import { defineCommand } from 'citty'
import { createClient } from '../api/client'
import { BaiduPanApi, splitIntoChunks } from '../api/file'
import { FileError } from '../errors'
import { logger } from '../logger'
import {
  formatSize,
  getAllFiles,
  isDirectory,
  normalizePath,
  printProgress,
  readFileAsBuffer,
  readStdin,
} from '../utils'

// Maximum concurrent chunk uploads
const MAX_CONCURRENT_UPLOADS = 3

export default defineCommand({
  meta: {
    name: 'upload',
    description: 'Upload file or directory to Baidu Pan',
  },
  args: {
    local: {
      type: 'positional',
      description: 'Local file/directory path (use "-" for stdin)',
      required: true,
    },
    remote: {
      type: 'positional',
      description: 'Remote path on Baidu Pan',
      required: true,
    },
    concurrency: {
      type: 'string',
      description: `Concurrent chunk uploads (default: ${MAX_CONCURRENT_UPLOADS})`,
      alias: 'c',
    },
  },
  async run({ args }) {
    const client = createClient()
    const api = new BaiduPanApi(client)

    const localPath = args.local
    const remotePath = normalizePath(args.remote)
    const concurrency = Number.parseInt(args.concurrency || String(MAX_CONCURRENT_UPLOADS), 10)

    // Handle stdin input
    if (localPath === '-') {
      logger.info('正在从标准输入读取...')
      const data = await readStdin()
      await uploadBuffer(api, data, remotePath, concurrency)
      return
    }

    // Check if local path exists
    if (!fs.existsSync(localPath)) {
      throw new FileError(`本地路径不存在: ${localPath}`)
    }

    // Handle directory upload
    if (isDirectory(localPath)) {
      const files = getAllFiles(localPath)

      if (files.length === 0) {
        logger.info('没有文件需要上传')
        return
      }

      logger.info(`发现 ${files.length} 个文件待上传`)

      let uploaded = 0
      for (const file of files) {
        const remoteFilePath = `${remotePath}/${file.relativePath}`
        logger.info(`\n正在上传: ${file.relativePath}`)

        const data = readFileAsBuffer(file.localPath)
        await uploadBuffer(api, data, remoteFilePath, concurrency)

        uploaded++
        logger.info(`进度: ${uploaded}/${files.length} 个文件`)
      }

      logger.success(`上传完成！共 ${uploaded} 个文件`)
      return
    }

    // Handle single file upload
    const data = readFileAsBuffer(localPath)
    const fileName = path.basename(localPath)
    const finalRemotePath = remotePath.endsWith('/')
      ? `${remotePath}${fileName}`
      : remotePath

    await uploadBuffer(api, data, finalRemotePath, concurrency)
  },
})

async function uploadBuffer(
  api: BaiduPanApi,
  data: Buffer,
  remotePath: string,
  concurrency: number,
): Promise<void> {
  logger.info(`上传目标: ${remotePath}`)
  logger.info(`文件大小: ${formatSize(data.length)}`)

  // Split into chunks and calculate MD5
  const { chunks, md5List } = splitIntoChunks(data)
  logger.debug(`分块数: ${chunks.length}`)

  // Step 1: Precreate
  logger.start('预创建文件...')
  const precreateResult = await api.precreate(remotePath, data.length, md5List)

  // Check if file already exists (return_type = 2)
  if (precreateResult.return_type === 2) {
    logger.success('秒传成功（文件已存在）')
    return
  }

  const uploadId = precreateResult.uploadid
  const blocksToUpload = precreateResult.block_list

  // Step 2: Upload chunks with concurrency
  logger.start('上传分块中...')
  const uploadedMd5List: string[] = [...md5List]
  let completed = 0

  // Process chunks in batches with concurrency limit
  for (let i = 0; i < blocksToUpload.length; i += concurrency) {
    const batch = blocksToUpload.slice(i, i + concurrency)

    const results = await Promise.all(
      batch.map(async (blockIndex) => {
        const chunk = chunks[blockIndex]
        const result = await api.uploadChunk(uploadId, remotePath, blockIndex, chunk)
        completed++
        printProgress(completed, blocksToUpload.length, '上传中: ')
        return { blockIndex, md5: result.md5 }
      }),
    )

    // Update MD5 list with results
    for (const { blockIndex, md5 } of results) {
      uploadedMd5List[blockIndex] = md5
    }
  }

  // Step 3: Create file
  logger.start('创建文件...')
  const createResult = await api.createFile(
    remotePath,
    data.length,
    uploadId,
    uploadedMd5List,
  )

  logger.success(`上传完成！fs_id: ${createResult.fs_id}`)
}
