# 示例脚本：MongoDB 自动备份到百度网盘

此目录包含一个示例脚本，用于自动备份 MongoDB 数据库到百度网盘。

## 包含的文件

- `backup_mongodb.sh` - 主备份脚本
- `setup_cron.sh` - 用于设置定时任务的脚本
- `backup_config.json` - 配置文件

## 功能说明

此脚本实现了以下功能：
1. 检查 mongodump 是否存在
2. 检查 Node.js 环境
3. 安装本项目
4. 执行 MongoDB 备份（连接参数通过命令行参数传入）
5. 上传到百度网盘
6. 支持每小时自动执行一次

## 使用说明

### 前置要求

1. 安装 Node.js
2. 安装 MongoDB 工具（特别是 `mongodump`）
3. 配置百度网盘 CLI 访问权限

### 配置百度网盘访问权限

在运行备份脚本之前，您需要先配置百度网盘访问权限：

```bash
# 如果还没有安装 CLI 工具
npm install -g baidupan-cli

# 或者使用 npx 临时运行
npx baidupan-cli auth -k <your_app_key> -s <your_secret_key>
```

### 手动运行备份

```bash
# 给脚本添加执行权限
chmod +x example/backup_mongodb.sh

# 运行备份脚本（使用方法：./backup_mongodb.sh <mongo_url> <remote_directory>）
./example/backup_mongodb.sh "mongodb://localhost:27017/mydb" "/backup/mongodb"
```

### 设置每小时自动运行

```bash
# 运行设置脚本，这将添加 cron 任务
chmod +x example/setup_cron.sh
./example/setup_cron.sh
```

### 验证定时任务

```bash
# 查看当前用户的 cron 任务
crontab -l
```

## 配置选项

使用方法：`./backup_mongodb.sh <mongo_url> <remote_directory>`

参数说明：
- `<mongo_url>`: MongoDB 连接字符串，例如 `mongodb://username:password@host:port/database`
- `<remote_directory>`: 百度网盘远程目录路径，例如 `/backup/mongodb`

示例：
```bash
# 备份整个 MongoDB 实例
./backup_mongodb.sh "mongodb://localhost:27017" "/backup/mongodb"

# 备份特定数据库
./backup_mongodb.sh "mongodb://localhost:27017/mydatabase" "/backup/mongodb"

# 备份带有认证信息的数据库
./backup_mongodb.sh "mongodb://username:password@localhost:27017/mydatabase" "/backup/mongodb"
```

## 日志文件

- 执行日志：`/tmp/mongodb_backup.log`

## 注意事项

1. 确保 MongoDB 服务正在运行
2. 确保有足够的磁盘空间进行备份
3. 确保网络连接稳定以上传备份文件
4. MongoDB 连接参数应根据实际情况修改（通过命令行参数传入）

## 故障排除

如果遇到问题，请检查：

1. Node.js 是否正确安装：`node --version`
2. MongoDB 工具是否可用：`mongodump --version`
3. 百度网盘 CLI 是否已配置：检查 `~/.baidupan-cli/config.json` 文件
4. MongoDB 连接参数是否正确（通过命令行参数传入）
5. 相关日志文件以获取更多信息
