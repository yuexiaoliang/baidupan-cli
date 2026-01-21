import { defineCommand } from 'citty'
import { createClient } from '../api/client'
import { BaiduPanApi } from '../api/file'
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

    try {
      const result = await api.listFiles(dir, {
        order,
        desc: args.desc,
      })

      if (args.json) {
        console.log(JSON.stringify(result.list, null, 2))
        return
      }

      if (result.list.length === 0) {
        console.log('(empty directory)')
        return
      }

      // Print header
      console.log('Type\tSize\t\tModified\t\t\tName')
      console.log('----\t----\t\t--------\t\t\t----')

      for (const file of result.list) {
        const type = file.isdir ? 'DIR' : 'FILE'
        const size = file.isdir ? '-' : formatSize(file.size)
        const modified = formatDate(file.server_mtime)
        const name = file.server_filename

        console.log(`${type}\t${size.padEnd(10)}\t${modified}\t${name}`)
      }

      console.log('')
      console.log(`Total: ${result.list.length} items`)
    }
    catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error)
      process.exit(1)
    }
  },
})
