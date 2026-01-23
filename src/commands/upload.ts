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
      logger.info('Reading from stdin...')
      const data = await readStdin()
      await uploadBuffer(api, data, remotePath, concurrency)
      return
    }

    // Check if local path exists
    if (!fs.existsSync(localPath)) {
      throw new FileError(`Local path does not exist: ${localPath}`)
    }

    // Handle directory upload
    if (isDirectory(localPath)) {
      const files = getAllFiles(localPath)

      if (files.length === 0) {
        logger.info('No files to upload')
        return
      }

      logger.info(`Found ${files.length} files to upload`)

      let uploaded = 0
      for (const file of files) {
        const remoteFilePath = `${remotePath}/${file.relativePath}`
        logger.info(`\nUploading: ${file.relativePath}`)

        const data = readFileAsBuffer(file.localPath)
        await uploadBuffer(api, data, remoteFilePath, concurrency)

        uploaded++
        logger.info(`Progress: ${uploaded}/${files.length} files`)
      }

      logger.success(`Done! Uploaded ${uploaded} files`)
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
  logger.info(`Uploading to: ${remotePath}`)
  logger.info(`File size: ${formatSize(data.length)}`)

  // Split into chunks and calculate MD5
  const { chunks, md5List } = splitIntoChunks(data)
  logger.debug(`Chunks: ${chunks.length}`)

  // Step 1: Precreate
  logger.start('Precreating file...')
  const precreateResult = await api.precreate(remotePath, data.length, md5List)

  // Check if file already exists (return_type = 2)
  if (precreateResult.return_type === 2) {
    logger.success('File already exists on server (rapid upload)')
    return
  }

  const uploadId = precreateResult.uploadid
  const blocksToUpload = precreateResult.block_list

  // Step 2: Upload chunks with concurrency
  logger.start('Uploading chunks...')
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
        printProgress(completed, blocksToUpload.length, 'Uploading: ')
        return { blockIndex, md5: result.md5 }
      }),
    )

    // Update MD5 list with results
    for (const { blockIndex, md5 } of results) {
      uploadedMd5List[blockIndex] = md5
    }
  }

  // Step 3: Create file
  logger.start('Creating file...')
  const createResult = await api.createFile(
    remotePath,
    data.length,
    uploadId,
    uploadedMd5List,
  )

  logger.success(`Upload complete! fs_id: ${createResult.fs_id}`)
}
