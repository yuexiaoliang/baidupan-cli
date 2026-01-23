#!/usr/bin/env node

/**
 * MongoDB 备份脚本
 *
 * 使用方法:
 *   node backup_mongodb.mjs <mongo_url> <remote_directory>
 *   或设置环境变量: MONGO_URL=<url> REMOTE_DIR=<dir> node backup_mongodb.mjs
 *
 * 示例:
 *   node backup_mongodb.mjs "mongodb://localhost:27017/database" "backup/mongodb"
 */

import { execSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// 获取参数
const mongoUrl = process.env.MONGO_URL || process.argv[2]
const remoteDir = process.env.REMOTE_DIR || process.argv[3]

if (!mongoUrl || !remoteDir) {
  console.log(`用法: node backup_mongodb.mjs <mongo_url> <remote_directory>
或者设置环境变量后运行: MONGO_URL=<url> REMOTE_DIR=<dir> node backup_mongodb.mjs

示例:
  node backup_mongodb.mjs "mongodb://localhost:27017/mydb" "/backup/mongodb"
  MONGO_URL="mongodb://user:pass@host:port/db" REMOTE_DIR="/backup" node backup_mongodb.mjs

注意: 如果 URL 包含特殊字符，请使用引号包围`)
  process.exit(1)
}

// 检查 mongodump
console.log('检查 mongodump...')
try {
  execSync('mongodump --version', { stdio: 'ignore' })
}
catch {
  console.error('错误: 未找到 mongodump，请安装 MongoDB 工具')
  process.exit(1)
}

// 创建备份目录
const backupDir = join(tmpdir(), `mongodb_backups_${process.pid}`)
console.log('创建备份目录...')
mkdirSync(backupDir, { recursive: true })

// 生成备份文件名
const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '_').slice(0, 15)
const backupName = `mongodb_backup_${timestamp}`
const backupPath = join(backupDir, backupName)

try {
  // 执行 mongodump
  console.log('开始备份 MongoDB 数据...')
  execSync(`mongodump --uri "${mongoUrl}" --out "${backupPath}"`, { stdio: 'inherit' })
  console.log(`MongoDB 备份完成: ${backupPath}`)

  // 压缩备份
  console.log('压缩备份文件...')
  const tarFile = `${backupName}.tar.gz`
  execSync(`tar -czf "${tarFile}" "${backupName}"`, { cwd: backupDir, stdio: 'inherit' })
  console.log(`备份已压缩: ${tarFile}`)

  // 清理未压缩的备份目录
  rmSync(backupPath, { recursive: true, force: true })

  // 上传到百度网盘
  const backupFile = join(backupDir, tarFile)
  const remotePath = `${remoteDir}/${tarFile}`
  console.log('上传备份到百度网盘...')

  const result = spawnSync('npx', ['--yes', 'baidupan-cli@latest', 'upload', backupFile, remotePath], {
    stdio: 'inherit',
    shell: true,
  })

  if (result.status === 0) {
    console.log(`备份已成功上传到百度网盘: ${remotePath}`)
    // 清理本地备份文件
    rmSync(backupFile, { force: true })
    console.log('本地备份文件已清理')
  }
  else {
    console.error('上传失败')
    process.exit(1)
  }

  // 清理临时目录
  rmSync(backupDir, { recursive: true, force: true })
}
catch (error) {
  console.error('备份失败:', error.message)
  // 清理临时目录
  if (existsSync(backupDir)) {
    rmSync(backupDir, { recursive: true, force: true })
  }
  process.exit(1)
}

console.log('备份任务完成！')
