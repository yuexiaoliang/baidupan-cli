#!/bin/bash

# 简化版 MongoDB 备份脚本
# 使用方法: ./backup_mongodb.sh <mongo_url> <remote_directory>
# 或者: MONGO_URL=<mongo_url> REMOTE_DIR=<remote_directory> ./backup_mongodb.sh
# 例如: ./backup_mongodb.sh "mongodb://localhost:27017/mydb" "/backup/mongodb"

set -e  # 遇到错误立即退出
set +H  # 禁用历史扩展，防止特殊字符被解释

# 检查是否通过环境变量提供了参数
if [ -n "$MONGO_URL" ] && [ -n "$REMOTE_DIR" ]; then
    # 使用环境变量提供的参数
    echo "使用环境变量中的参数"
elif [ $# -eq 2 ]; then
    # 使用命令行参数
    MONGO_URL="$1"
    REMOTE_DIR="$2"
else
    echo "用法: $0 <mongo_url> <remote_directory>"
    echo "或者设置环境变量后运行: MONGO_URL=<mongo_url> REMOTE_DIR=<remote_directory> $0"
    echo "示例: $0 \"mongodb://localhost:27017/mydb\" \"/backup/mongodb\""
    echo "      MONGO_URL=\"mongodb://user:p@ss!word@host:port/db\" REMOTE_DIR=\"/backup\" $0"
    echo ""
    echo "注意: 如果 URL 包含特殊字符（如 ! @ # $ % ^ & *），请确保使用引号包围整个 URL"
    echo "      或者通过环境变量传递参数以避免 shell 解释特殊字符，例如:"
    echo "      MONGO_URL='mongodb://user:p@ss!word@host:port/db' REMOTE_DIR='/backup' ./backup_mongodb.sh"
    exit 1
fi

echo "检查 mongodump..."
if ! command -v mongodump &> /dev/null; then
    echo "错误: 未找到 mongodump，请安装 MongoDB 工具"
    exit 1
fi

echo "检查 Node.js 环境..."
if ! command -v node &> /dev/null; then
    echo "错误: 未找到 Node.js，请安装 Node.js"
    exit 1
fi

# 本地备份地址由程序处理
BACKUP_DIR="/tmp/mongodb_backups_$$"
echo "创建备份目录..."
mkdir -p "$BACKUP_DIR"

echo "生成备份文件名..."
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_NAME="mongodb_backup_$TIMESTAMP"
BACKUP_PATH="$BACKUP_DIR/$BACKUP_NAME"

# 使用 mongodump 直接通过 URL
echo "开始备份 MongoDB 数据..."
mongodump --uri "$MONGO_URL" --out "$BACKUP_PATH"

if [ $? -eq 0 ]; then
    echo "MongoDB 备份完成: $BACKUP_PATH"

    # 压缩备份
    echo "压缩备份文件..."
    cd "$BACKUP_DIR"
    tar -czf "${BACKUP_NAME}.tar.gz" "$BACKUP_NAME"
    echo "备份已压缩: ${BACKUP_NAME}.tar.gz"

    # 清理未压缩的备份目录
    rm -rf "$BACKUP_PATH"

    # 上传到百度网盘
    BACKUP_FILE="${BACKUP_NAME}.tar.gz"
    echo "上传备份到百度网盘..."
    npx --yes baidupan-cli upload "$BACKUP_DIR/$BACKUP_FILE" "$REMOTE_DIR/$BACKUP_FILE"

    if [ $? -eq 0 ]; then
        echo "备份已成功上传到百度网盘: $REMOTE_DIR/$BACKUP_FILE"
        # 清理本地备份文件
        rm -f "$BACKUP_DIR/$BACKUP_FILE"
        echo "本地备份文件已清理"
    else
        echo "上传失败"
        exit 1
    fi

    # 清理临时备份目录
    rmdir "$BACKUP_DIR"
else
    echo "MongoDB 备份失败"
    exit 1
fi

echo "备份任务完成！"