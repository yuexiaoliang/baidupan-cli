/**
 * PM2 定时备份配置
 *
 * 使用方法:
 *   1. 修改下方的 MONGO_URL 和 REMOTE_DIR
 *   2. 运行: pm2 start ecosystem.config.cjs
 *   3. 查看日志: pm2 logs mongodb-backup
 *   4. 停止: pm2 stop mongodb-backup
 */

module.exports = {
  apps: [{
    name: 'mongodb-backup',
    script: './backup_mongodb.mjs',
    cwd: __dirname,
    cron_restart: '0 * * * *', // 每小时执行一次
    autorestart: false, // 执行完毕后不自动重启（等待 cron 触发）
    env: {
      MONGO_URL: 'mongodb://localhost:27017', // 修改为你的 MongoDB 地址
      REMOTE_DIR: '/backup/local/mongodb', // 修改为你的网盘目录
    },
  }],
}
