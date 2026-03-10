import { defineCommand } from 'citty'
import { createClient } from '../api/client'
import { BaiduPanApi } from '../api/file'
import { FileError } from '../errors'
import { logger } from '../logger'
import { normalizePath } from '../utils'

export default defineCommand({
  meta: {
    name: 'copy',
    description: 'Copy files or directories',
  },
  args: {
    source: {
      type: 'positional',
      description: 'Source path',
      required: true,
    },
    dest: {
      type: 'positional',
      description: 'Destination path or directory',
      required: true,
    },
    ondup: {
      type: 'string',
      description: 'On duplicate: fail, newcopy, overwrite, skip',
      default: 'fail',
    },
    async: {
      type: 'boolean',
      description: 'Use async mode',
      alias: 'a',
      default: false,
    },
    json: {
      type: 'boolean',
      description: 'Output as JSON',
      alias: 'j',
      default: false,
    },
  },
  async run({ args }) {
    const client = createClient()
    const api = new BaiduPanApi(client)

    const sourcePath = normalizePath(args.source)
    const destPath = normalizePath(args.dest)

    // For copy operation, we need to extract destination directory and new name
    // dest can be either a directory (copy into) or a full path (copy and rename)
    const destDir = destPath.endsWith('/') ? destPath : destPath.substring(0, destPath.lastIndexOf('/') + 1) || '/'
    const newName = destPath.endsWith('/')
      ? sourcePath.substring(sourcePath.lastIndexOf('/') + 1)
      : destPath.substring(destPath.lastIndexOf('/') + 1)

    const fileList = [
      {
        path: sourcePath,
        dest: destDir,
        newname: newName,
      },
    ]

    const result = await api.fileManager('copy', fileList, {
      async: args.async ? 2 : 0,
      ondup: args.ondup as 'fail' | 'newcopy' | 'overwrite' | 'skip',
    })

    if (args.json) {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
      return
    }

    if (result.errno !== 0) {
      throw new FileError(`Copy failed: ${result.errmsg || `error code ${result.errno}`}`)
    }

    // Check individual results
    const failures = result.info.filter(item => item.errno !== 0)
    if (failures.length > 0) {
      for (const failure of failures) {
        logger.error(`Failed to copy ${failure.path}: error code ${failure.errno}`)
      }
      throw new FileError(`Failed to copy ${failures.length} item(s)`)
    }

    if (args.async && result.taskid) {
      logger.success(`Copy task created (taskid: ${result.taskid})`)
    }
    else {
      logger.success(`Copied: ${sourcePath} → ${destPath}`)
    }
  },
})
