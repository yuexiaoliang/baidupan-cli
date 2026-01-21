#!/usr/bin/env node
import { defineCommand, runMain } from 'citty'
import authCommand from './commands/auth'
import downloadCommand from './commands/download'
import listCommand from './commands/list'
import uploadCommand from './commands/upload'

const main = defineCommand({
  meta: {
    name: 'baidupan-cli',
    version: '0.1.0',
    description: 'CLI tool for Baidu Pan file management',
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

runMain(main)
