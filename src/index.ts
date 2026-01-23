#!/usr/bin/env node
import { createRequire } from 'node:module'
import { defineCommand, runMain } from 'citty'
import authCommand from './commands/auth'
import downloadCommand from './commands/download'
import listCommand from './commands/list'
import uploadCommand from './commands/upload'
import { handleError } from './errors'
import { setLogLevel } from './logger'

const require = createRequire(import.meta.url)
const { version } = require('../package.json') as { version: string }

const main = defineCommand({
  meta: {
    name: 'baidupan-cli',
    version,
    description: 'CLI tool for Baidu Pan file management',
  },
  args: {
    quiet: {
      type: 'boolean',
      description: 'Suppress all output except errors',
      alias: 'q',
      default: false,
    },
    verbose: {
      type: 'boolean',
      description: 'Show debug information',
      alias: 'v',
      default: false,
    },
  },
  setup({ args }) {
    setLogLevel({ quiet: args.quiet, verbose: args.verbose })
  },
  subCommands: {
    auth: authCommand,
    list: listCommand,
    ls: listCommand,
    upload: uploadCommand,
    up: uploadCommand,
    download: downloadCommand,
    dl: downloadCommand,
  },
})

runMain(main).catch(handleError)
