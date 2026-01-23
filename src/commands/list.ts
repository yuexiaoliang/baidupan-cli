import { defineCommand } from 'citty'
import { createClient } from '../api/client'
import { BaiduPanApi } from '../api/file'
import { logger } from '../logger'
import { formatDate, formatSize, normalizePath } from '../utils'

export default defineCommand({
  meta: {
    name: 'list',
    description: 'List files in directory',
  },
  args: {
    path: {
      type: 'positional',
      description: 'Directory path (default: /)',
      default: '/',
    },
    order: {
      type: 'string',
      description: 'Sort by: name, time, size',
      alias: 'o',
      default: 'name',
    },
    desc: {
      type: 'boolean',
      description: 'Sort in descending order',
      alias: 'd',
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

    const dir = normalizePath(args.path)
    const order = args.order as 'name' | 'time' | 'size'

    const result = await api.listFiles(dir, {
      order,
      desc: args.desc,
    })

    if (args.json) {
      // JSON output goes to stdout for piping
      process.stdout.write(`${JSON.stringify(result.list, null, 2)}\n`)
      return
    }

    if (result.list.length === 0) {
      logger.info('(empty directory)')
      return
    }

    // Print header
    logger.log('Type\tSize\t\tModified\t\t\tName')
    logger.log('----\t----\t\t--------\t\t\t----')

    for (const file of result.list) {
      const type = file.isdir ? 'DIR' : 'FILE'
      const size = file.isdir ? '-' : formatSize(file.size)
      const modified = formatDate(file.server_mtime)
      const name = file.server_filename

      logger.log(`${type}\t${size.padEnd(10)}\t${modified}\t${name}`)
    }

    logger.log('')
    logger.info(`Total: ${result.list.length} items`)
  },
})
