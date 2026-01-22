#!/bin/bash

# 设置每小时执行一次备份的 cron 任务

EXAMPLE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_SCRIPT="$EXAMPLE_DIR/backup_mongodb.sh"
LOG_FILE="/tmp/mongodb_backup.log"
CRON_JOB="0 * * * * cd $EXAMPLE_DIR && $BACKUP_SCRIPT >> $LOG_FILE 2>&1"

echo "设置每小时执行一次的 MongoDB 备份任务..."

# 添加 cron 任务
(crontab -l 2>/dev/null | grep -v "$BACKUP_SCRIPT"; echo "$CRON_JOB") | crontab -

echo "定时任务已设置完成！"
echo "备份脚本将每小时自动执行一次"
echo "日志将保存到 $LOG_FILE"