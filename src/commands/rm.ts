import { defineCommand } from 'citty'
import { createClient } from '../api/client'
import { BaiduPanApi } from '../api/file'
import { FileError } from '../errors'
import { logger } from '../logger'
import { normalizePath } from '../utils'

export default defineCommand({
  meta: {
    name: 'delete',
    description: 'Delete files or directories',
  },
  args: {
    paths: {
      type: 'positional',
      description: 'Path(s) to delete',
      required: true,
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

    // Handle multiple paths (space-separated)
    const paths = Array.isArray(args.paths) ? args.paths : [args.paths]
    const normalizedPaths = paths.map((p: string) => normalizePath(p))

    const fileList = normalizedPaths.map((path: string) => ({ path }))

    const result = await api.fileManager('delete', fileList, {
      async: args.async ? 2 : 0,
    })

    if (args.json) {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
      return
    }

    if (result.errno !== 0) {
      throw new FileError(`Delete failed: ${result.errmsg || `error code ${result.errno}`}`)
    }

    // Check individual results
    const failures = result.info.filter(item => item.errno !== 0)
    if (failures.length > 0) {
      for (const failure of failures) {
        logger.error(`Failed to delete ${failure.path}: error code ${failure.errno}`)
      }
      throw new FileError(`Failed to delete ${failures.length} item(s)`)
    }

    if (args.async && result.taskid) {
      logger.success(`Delete task created (taskid: ${result.taskid})`)
    }
    else {
      logger.success(`Deleted ${normalizedPaths.length} item(s)`)
    }
  },
})
