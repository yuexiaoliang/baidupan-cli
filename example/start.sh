#!/bin/bash

# MongoDB 定时备份启动脚本
# 使用方法: ./start.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/ecosystem.config.cjs"

echo "检查 PM2..."
if ! command -v pm2 &> /dev/null; then
    echo "安装 PM2..."
    npm install -g pm2
fi

echo "启动定时备份任务..."
pm2 start "$CONFIG_FILE"

echo "设置开机自启..."
pm2 save
pm2 startup

echo ""
echo "启动完成！"
echo "查看状态: pm2 status"
echo "查看日志: pm2 logs mongodb-backup"
