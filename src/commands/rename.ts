import { defineCommand } from 'citty'
import { createClient } from '../api/client'
import { BaiduPanApi } from '../api/file'
import { FileError } from '../errors'
import { logger } from '../logger'
import { normalizePath } from '../utils'

export default defineCommand({
  meta: {
    name: 'rename',
    description: 'Rename files or directories',
  },
  args: {
    path: {
      type: 'positional',
      description: 'Path to file/directory to rename',
      required: true,
    },
    newname: {
      type: 'positional',
      description: 'New name',
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

    const sourcePath = normalizePath(args.path)

    const fileList = [
      {
        path: sourcePath,
        newname: args.newname,
      },
    ]

    const result = await api.fileManager('rename', fileList, {
      async: args.async ? 2 : 0,
      ondup: args.ondup as 'fail' | 'newcopy' | 'overwrite' | 'skip',
    })

    if (args.json) {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
      return
    }

    if (result.errno !== 0) {
      throw new FileError(`Rename failed: ${result.errmsg || `error code ${result.errno}`}`)
    }

    // Check individual results
    const failures = result.info.filter(item => item.errno !== 0)
    if (failures.length > 0) {
      for (const failure of failures) {
        logger.error(`Failed to rename ${failure.path}: error code ${failure.errno}`)
      }
      throw new FileError(`Failed to rename ${failures.length} item(s)`)
    }

    if (args.async && result.taskid) {
      logger.success(`Rename task created (taskid: ${result.taskid})`)
    }
    else {
      logger.success(`Renamed: ${sourcePath} → ${args.newname}`)
    }
  },
})
