# 示例脚本：MongoDB 自动备份到百度网盘

此目录包含 Node.js 示例脚本，用于自动备份 MongoDB 数据库到百度网盘。

## 包含的文件

- `backup_mongodb.mjs` - 备份脚本
- `ecosystem.config.cjs` - PM2 定时任务配置

## 功能说明

1. 检查 mongodump 是否存在
2. 执行 MongoDB 备份
3. 压缩备份文件
4. 上传到百度网盘
5. 清理本地临时文件

## 使用说明

### 前置要求

1. Node.js 18+
2. MongoDB 工具（`mongodump`）
3. 配置百度网盘访问权限

### 配置百度网盘访问权限

```bash
# 安装 CLI 工具
npm install -g baidupan-cli

# 授权
baidupan-cli auth -k <your_app_key> -s <your_secret_key>
```

### 手动运行备份

```bash
# 方式 1：通过命令行参数
node example/backup_mongodb.mjs "mongodb://localhost:27017/mydb" "/backup/mongodb"

# 方式 2：通过环境变量
MONGO_URL="mongodb://localhost:27017/mydb" REMOTE_DIR="/backup/mongodb" node example/backup_mongodb.mjs
```

### 使用 PM2 定时备份

```bash
# 安装 PM2
npm install -g pm2

# 修改配置文件中的 MONGO_URL 和 REMOTE_DIR
vim example/ecosystem.config.cjs

# 启动定时任务（每小时执行一次）
pm2 start example/ecosystem.config.cjs

# 查看状态
pm2 status

# 查看日志
pm2 logs mongodb-backup

# 立即触发一次备份
pm2 restart mongodb-backup

# 停止任务
pm2 stop mongodb-backup

# 删除任务
pm2 delete mongodb-backup

# 设置开机自启
pm2 save
pm2 startup
```

### 自定义定时规则

修改 `ecosystem.config.cjs` 中的 `cron_restart` 字段：

```javascript
cron_restart: '0 * * * *' // 每小时
cron_restart: '0 2 * * *' // 每天凌晨 2 点
cron_restart: '0 */6 * * *' // 每 6 小时
cron_restart: '0 0 * * 0' // 每周日零点
```

## 配置选项

| 参数 | 环境变量 | 说明 |
|------|----------|------|
| 第 1 个参数 | `MONGO_URL` | MongoDB 连接字符串 |
| 第 2 个参数 | `REMOTE_DIR` | 百度网盘远程目录 |

## 注意事项

1. 确保 MongoDB 服务正在运行
2. 确保有足够的磁盘空间进行备份
3. 确保网络连接稳定以上传备份文件
4. PM2 需要保持运行，建议配合 `pm2 startup` 设置开机自启

## 故障排除

如果遇到问题，请检查：

1. Node.js 版本：`node --version`（需要 18+）
2. MongoDB 工具：`mongodump --version`
3. 百度网盘配置：检查 `~/.baidupan-cli/config.json`
4. PM2 日志：`pm2 logs mongodb-backup`
