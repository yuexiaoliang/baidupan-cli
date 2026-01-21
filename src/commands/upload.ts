import fs from 'node:fs'
import path from 'node:path'
import { defineCommand } from 'citty'
import { createClient } from '../api/client'
import { BaiduPanApi, splitIntoChunks } from '../api/file'
import {
  formatSize,
  getAllFiles,
  isDirectory,
  normalizePath,
  printProgress,
  readFileAsBuffer,
  readStdin,
} from '../utils'

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
  },
  async run({ args }) {
    const client = createClient()
    const api = new BaiduPanApi(client)

    const localPath = args.local
    const remotePath = normalizePath(args.remote)

    try {
      // Handle stdin input
      if (localPath === '-') {
        console.log('Reading from stdin...')
        const data = await readStdin()
        await uploadBuffer(api, data, remotePath)
        return
      }

      // Check if local path exists
      if (!fs.existsSync(localPath)) {
        console.error(`Error: Local path does not exist: ${localPath}`)
        process.exit(1)
      }

      // Handle directory upload
      if (isDirectory(localPath)) {
        const files = getAllFiles(localPath)

        if (files.length === 0) {
          console.log('No files to upload')
          return
        }

        console.log(`Found ${files.length} files to upload`)

        let uploaded = 0
        for (const file of files) {
          const remoteFilePath = `${remotePath}/${file.relativePath}`
          console.log(`\nUploading: ${file.relativePath}`)

          const data = readFileAsBuffer(file.localPath)
          await uploadBuffer(api, data, remoteFilePath)

          uploaded++
          console.log(`Progress: ${uploaded}/${files.length} files`)
        }

        console.log(`\nDone! Uploaded ${uploaded} files`)
        return
      }

      // Handle single file upload
      const data = readFileAsBuffer(localPath)
      const fileName = path.basename(localPath)
      const finalRemotePath = remotePath.endsWith('/')
        ? `${remotePath}${fileName}`
        : remotePath

      await uploadBuffer(api, data, finalRemotePath)
    }
    catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error)
      process.exit(1)
    }
  },
})

async function uploadBuffer(api: BaiduPanApi, data: Buffer, remotePath: string): Promise<void> {
  console.log(`Uploading to: ${remotePath}`)
  console.log(`File size: ${formatSize(data.length)}`)

  // Split into chunks and calculate MD5
  const { chunks, md5List } = splitIntoChunks(data)
  console.log(`Chunks: ${chunks.length}`)

  // Step 1: Precreate
  console.log('Precreating file...')
  const precreateResult = await api.precreate(remotePath, data.length, md5List)

  // Check if file already exists (return_type = 2)
  if (precreateResult.return_type === 2) {
    console.log('File already exists on server (rapid upload)')
    return
  }

  const uploadId = precreateResult.uploadid
  const blocksToUpload = precreateResult.block_list

  // Step 2: Upload chunks
  console.log('Uploading chunks...')
  const uploadedMd5List: string[] = [...md5List]

  for (let i = 0; i < blocksToUpload.length; i++) {
    const blockIndex = blocksToUpload[i]
    const chunk = chunks[blockIndex]

    printProgress(i + 1, blocksToUpload.length, 'Uploading: ')

    const result = await api.uploadChunk(uploadId, remotePath, blockIndex, chunk)
    uploadedMd5List[blockIndex] = result.md5
  }

  // Step 3: Create file
  console.log('Creating file...')
  const createResult = await api.createFile(
    remotePath,
    data.length,
    uploadId,
    uploadedMd5List,
  )

  console.log(`Upload complete! fs_id: ${createResult.fs_id}`)
}
