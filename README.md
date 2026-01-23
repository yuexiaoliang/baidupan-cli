# baidupan-cli

[English](#english) | [中文](#中文)

---

## English

A command-line tool for managing Baidu Pan (Baidu Netdisk), supporting upload, download, and file listing.

### Installation

```bash
# Global install
npm install -g baidupan-cli

# Or using pnpm
pnpm add -g baidupan-cli
```

### Getting Started

#### 1. Get Baidu Developer Credentials

1. Visit [Baidu Pan Open Platform](https://pan.baidu.com/union/console/applist)
2. Create an application and get `App Key` and `Secret Key`
3. Add a redirect URI in app settings (not required if using default `oob` mode)

#### 2. Authorization

```bash
# Option 1: Via arguments
baidupan-cli auth -k <app-key> -s <secret-key>

# Option 2: Via environment variables
export BAIDU_APP_KEY=<app-key>
export BAIDU_SECRET_KEY=<secret-key>
baidupan-cli auth
```

Authorization flow:
1. The program displays an authorization URL and opens the browser
2. Complete authorization on Baidu's page
3. Copy the `code` parameter from the browser
4. Enter the authorization code in the terminal

After successful authentication, the token is automatically saved locally.

### Commands

#### Global Options

All commands support the following global options:

| Option | Alias | Description |
|--------|-------|-------------|
| `--quiet` | `-q` | Quiet mode, reduce output |
| `--verbose` | `-v` | Verbose mode, show debug info |

#### list - List Files

List files and directories in Baidu Pan.

```bash
# List root directory
baidupan-cli list

# List specific directory
baidupan-cli list /path/to/directory

# Sort by modification time (descending)
baidupan-cli list / -o time -d

# Sort by size (ascending)
baidupan-cli list / -o size

# Output as JSON (for piping)
baidupan-cli list / --json
```

**Options:**

| Option | Alias | Description | Default |
|--------|-------|-------------|---------|
| `path` | - | Directory path (positional) | `/` |
| `--order` | `-o` | Sort by: name, time, size | `name` |
| `--desc` | `-d` | Descending order | `false` |
| `--json` | `-j` | Output as JSON | `false` |

#### upload - Upload Files

Upload local files or directories to Baidu Pan.

```bash
# Upload a single file
baidupan-cli upload ./file.txt /remote/file.txt

# Upload to a directory
baidupan-cli upload ./file.txt /remote/path/

# Upload entire directory
baidupan-cli upload ./local-dir /remote/backup/

# Upload from stdin
echo "hello" | baidupan-cli upload - /remote/hello.txt
cat data.json | baidupan-cli upload - /remote/data.json

# Set concurrency (for faster large file uploads)
baidupan-cli upload ./large-file.zip /remote/ -c 5
```

**Options:**

| Option | Alias | Description | Default |
|--------|-------|-------------|---------|
| `local` | - | Local path (positional), use `-` for stdin | Required |
| `remote` | - | Remote path (positional) | Required |
| `--concurrency` | `-c` | Concurrent chunk uploads | `3` |

#### download - Download Files

Download files or directories from Baidu Pan.

```bash
# Download to current directory
baidupan-cli download /remote/file.txt

# Download to specific path
baidupan-cli download /remote/file.txt ./local-file.txt

# Download to specific directory
baidupan-cli download /remote/file.txt ./downloads/

# Download directory recursively
baidupan-cli download /remote/directory ./local-dir -r
```

**Options:**

| Option | Alias | Description | Default |
|--------|-------|-------------|---------|
| `remote` | - | Remote path (positional) | Required |
| `local` | - | Local save path (positional) | `.` |
| `--recursive` | `-r` | Download directory recursively | `false` |

#### auth - Authorization

Authorize with Baidu Pan.

```bash
baidupan-cli auth -k <app-key> -s <secret-key>

# With custom redirect URI
baidupan-cli auth -k <app-key> -s <secret-key> -r https://example.com/callback
```

**Options:**

| Option | Alias | Description | Default |
|--------|-------|-------------|---------|
| `--appKey` | `-k` | Baidu App Key | Env var |
| `--secretKey` | `-s` | Baidu Secret Key | Env var |
| `--redirectUri` | `-r` | Redirect URI | `oob` |

### Command Aliases

| Alias | Command |
|-------|---------|
| `ls` | `list` |
| `up` | `upload` |
| `dl` | `download` |

### Environment Variables

| Variable | Description |
|----------|-------------|
| `BAIDU_APP_KEY` | Baidu App Key |
| `BAIDU_SECRET_KEY` | Baidu Secret Key |
| `BAIDU_ACCESS_TOKEN` | Access Token (optional, takes priority over config) |
| `BAIDU_REFRESH_TOKEN` | Refresh Token (optional) |

### Config File

Credentials are saved at:

- **Windows**: `%USERPROFILE%\.baidupan-cli\config.json`
- **macOS/Linux**: `~/.baidupan-cli/config.json`

Config format:

```json
{
  "access_token": "...",
  "refresh_token": "...",
  "app_key": "...",
  "secret_key": "...",
  "expires_at": 1234567890000
}
```

Tokens are automatically refreshed when expired.

### Examples

#### Backup local directory

```bash
# Backup project
baidupan-cli upload ./my-project /backup/my-project/

# Scheduled backup (with cron)
0 2 * * * baidupan-cli upload /data/backup /backup/daily/
```

#### Download directory

```bash
baidupan-cli download /photos/2024 ./photos -r
```

#### Pipe operations

```bash
# Backup database and upload
mysqldump -u root mydb | baidupan-cli upload - /backup/mydb.sql

# List files and process with jq
baidupan-cli list /path --json | jq '.[] | select(.size > 1000000)'
```

### Troubleshooting

#### Authorization Issues
- Verify App Key and Secret Key are correct
- If using custom redirect URI, ensure it's added in Baidu Open Platform

#### Network Issues
- Ensure Baidu Pan API is accessible
- Auto-retry is enabled (3 retries with exponential backoff)

#### File Operations
- Remote paths must start with `/`
- Large files are automatically chunked
- Rapid upload supported (identical files skip upload)

---

## 中文

基于命令行的百度网盘管理工具，支持上传、下载、列出文件等操作。

### 安装

```bash
# 全局安装
npm install -g baidupan-cli

# 或使用 pnpm
pnpm add -g baidupan-cli
```

### 首次配置

#### 1. 获取百度开发者凭证

1. 访问 [百度网盘开放平台](https://pan.baidu.com/union/console/applist)
2. 创建应用并获取 `App Key` 和 `Secret Key`
3. 在应用设置中添加回调地址（如使用默认 `oob` 模式则无需配置）

#### 2. 授权认证

```bash
# 方式 1：通过参数指定
baidupan-cli auth -k <app-key> -s <secret-key>

# 方式 2：通过环境变量
export BAIDU_APP_KEY=<app-key>
export BAIDU_SECRET_KEY=<secret-key>
baidupan-cli auth
```

授权流程：
1. 程序会显示授权链接并自动打开浏览器
2. 在百度页面完成授权
3. 从浏览器复制 `code` 参数值
4. 在终端中输入授权码完成认证

认证成功后，Token 会自动保存到本地配置文件，后续操作无需重复认证。

### 命令说明

#### 全局参数

所有命令都支持以下全局参数：

| 参数 | 别名 | 说明 |
|------|------|------|
| `--quiet` | `-q` | 安静模式，减少输出 |
| `--verbose` | `-v` | 详细模式，显示调试信息 |

#### list - 列出文件

列出百度网盘中的文件和目录。

```bash
# 列出根目录
baidupan-cli list

# 列出指定目录
baidupan-cli list /path/to/directory

# 按修改时间降序排列
baidupan-cli list / -o time -d

# 按大小升序排列
baidupan-cli list / -o size

# 输出 JSON 格式（便于管道处理）
baidupan-cli list / --json
```

**参数：**

| 参数 | 别名 | 说明 | 默认值 |
|------|------|------|--------|
| `path` | - | 目录路径（位置参数） | `/` |
| `--order` | `-o` | 排序方式：name, time, size | `name` |
| `--desc` | `-d` | 降序排列 | `false` |
| `--json` | `-j` | 输出 JSON 格式 | `false` |

#### upload - 上传文件

将本地文件或目录上传到百度网盘。

```bash
# 上传单个文件
baidupan-cli upload ./file.txt /remote/file.txt

# 上传到指定目录
baidupan-cli upload ./file.txt /remote/path/

# 上传整个目录
baidupan-cli upload ./local-dir /remote/backup/

# 从标准输入读取并上传
echo "hello" | baidupan-cli upload - /remote/hello.txt
cat data.json | baidupan-cli upload - /remote/data.json

# 指定并发数（提升大文件上传速度）
baidupan-cli upload ./large-file.zip /remote/ -c 5
```

**参数：**

| 参数 | 别名 | 说明 | 默认值 |
|------|------|------|--------|
| `local` | - | 本地路径（位置参数），使用 `-` 表示 stdin | 必填 |
| `remote` | - | 远程路径（位置参数） | 必填 |
| `--concurrency` | `-c` | 分块上传并发数 | `3` |

#### download - 下载文件

从百度网盘下载文件或目录到本地。

```bash
# 下载文件到当前目录
baidupan-cli download /remote/file.txt

# 下载文件到指定路径
baidupan-cli download /remote/file.txt ./local-file.txt

# 下载到指定目录
baidupan-cli download /remote/file.txt ./downloads/

# 递归下载整个目录
baidupan-cli download /remote/directory ./local-dir -r
```

**参数：**

| 参数 | 别名 | 说明 | 默认值 |
|------|------|------|--------|
| `remote` | - | 远程路径（位置参数） | 必填 |
| `local` | - | 本地保存路径（位置参数） | `.` |
| `--recursive` | `-r` | 递归下载目录 | `false` |

#### auth - 授权认证

获取百度网盘授权。

```bash
baidupan-cli auth -k <app-key> -s <secret-key>

# 使用自定义回调地址
baidupan-cli auth -k <app-key> -s <secret-key> -r https://example.com/callback
```

**参数：**

| 参数 | 别名 | 说明 | 默认值 |
|------|------|------|--------|
| `--appKey` | `-k` | 百度 App Key | 环境变量 |
| `--secretKey` | `-s` | 百度 Secret Key | 环境变量 |
| `--redirectUri` | `-r` | 回调地址 | `oob` |

### 命令别名

| 别名 | 完整命令 |
|------|----------|
| `ls` | `list` |
| `up` | `upload` |
| `dl` | `download` |

### 环境变量

| 变量名 | 说明 |
|--------|------|
| `BAIDU_APP_KEY` | 百度 App Key |
| `BAIDU_SECRET_KEY` | 百度 Secret Key |
| `BAIDU_ACCESS_TOKEN` | Access Token（可选，优先级高于配置文件） |
| `BAIDU_REFRESH_TOKEN` | Refresh Token（可选） |

### 配置文件

认证信息默认保存在：

- **Windows**: `%USERPROFILE%\.baidupan-cli\config.json`
- **macOS/Linux**: `~/.baidupan-cli/config.json`

配置文件格式：

```json
{
  "access_token": "...",
  "refresh_token": "...",
  "app_key": "...",
  "secret_key": "...",
  "expires_at": 1234567890000
}
```

Token 过期后会自动刷新并保存。

### 使用示例

#### 备份本地目录到网盘

```bash
# 备份项目目录
baidupan-cli upload ./my-project /备份/my-project/

# 定时备份（配合 cron）
0 2 * * * baidupan-cli upload /data/backup /备份/daily/
```

#### 从网盘下载目录

```bash
# 下载整个目录
baidupan-cli download /照片/2024 ./photos -r
```

#### 管道操作

```bash
# 备份数据库并上传
mysqldump -u root mydb | baidupan-cli upload - /备份/mydb.sql

# 列出文件并用 jq 处理
baidupan-cli list /path --json | jq '.[] | select(.size > 1000000)'
```

### 故障排除

#### 授权问题

- 确认 App Key 和 Secret Key 正确
- 如使用自定义回调地址，确保已在百度开放平台添加

#### 网络问题

- 确认能正常访问百度网盘 API
- 工具已配置自动重试机制（3 次重试，指数退避）

#### 文件操作

- 远程路径需以 `/` 开头
- 大文件上传会自动分块，请耐心等待
- 支持秒传（相同文件无需重复上传）

## License

MIT
