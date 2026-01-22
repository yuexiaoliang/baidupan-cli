# 百度网盘管理器使用文档

## 概述

这是一个基于命令行的百度网盘管理工具，允许您通过命令行界面上传、下载、列出和管理您的百度网盘文件。

## 安装

```bash
# 全局安装
npm install -g baidupan-cli

# 或者使用 pnpm
pnpm add -g baidupan-cli
```

## 首次配置

在使用该工具前，您需要先进行授权认证。

### 获取百度开发者凭证

1. 访问 [百度网盘开放平台](https://pan.baidu.com/union/console/applist)
2. 创建应用并获取 `App Key` 和 `Secret Key`
3. 在应用设置中添加重定向 URL：`http://localhost:9876/callback`

### 授权认证

使用以下命令进行首次授权：

```bash
# 方式1：通过参数指定
baidupan-cli auth -k <your-app-key> -s <your-secret-key>

# 方式2：通过环境变量
export BAIDU_APP_KEY=<your-app-key>
export BAIDU_SECRET_KEY=<your-secret-key>
baidupan-cli auth
```

认证成功后，访问令牌会被自动保存到本地配置文件中，后续操作无需重复认证。

## 命令说明

### 1. 列出文件 (list)

列出百度网盘中的文件和目录。

```bash
# 列出根目录
baidupan-cli list

# 列出指定目录
baidupan-cli list /path/to/directory

# 按修改时间排序（降序）
baidupan-cli list / -o time -d

# 按大小排序（升序）
baidupan-cli list / -o size

# 输出为 JSON 格式
baidupan-cli list / --json
```

参数说明：
- `path`: 目录路径，默认为 `/`
- `-o, --order`: 排序方式（name, time, size），默认为 name
- `-d, --desc`: 降序排列
- `-j, --json`: 输出为 JSON 格式

### 2. 上传文件 (upload)

将本地文件或目录上传到百度网盘。

```bash
# 上传单个文件
baidupan-cli upload ./local-file.txt /remote-path/file.txt

# 上传整个目录
baidupan-cli upload ./local-directory /remote/path/

# 从标准输入读取数据并上传
echo "hello world" | baidupan-cli upload - /remote/hello.txt
```

参数说明：
- `local`: 本地文件/目录路径，使用 `-` 表示从标准输入读取
- `remote`: 远程路径

### 3. 下载文件 (download)

从百度网盘下载文件到本地。

```bash
# 下载文件到当前目录
baidupan-cli download /remote/file.txt

# 下载文件到指定位置
baidupan-cli download /remote/file.txt ./local-file.txt

# 下载到指定目录
baidupan-cli download /remote/file.txt ./downloads/
```

参数说明：
- `remote`: 远程文件路径
- `local`: 本地保存路径（可选）

### 4. 其他别名

- `ls` 是 `list` 的别名
- `up` 是 `upload` 的别名
- `dl` 是 `download` 的别名

## 高级用法

### 环境变量

您可以设置以下环境变量来避免每次都需要提供认证信息：

```bash
export BAIDU_APP_KEY=your_app_key
export BAIDU_SECRET_KEY=your_secret_key
export BAIDU_ACCESS_TOKEN=your_access_token
export BAIDU_REFRESH_TOKEN=your_refresh_token
```

### 配置文件位置

认证信息默认保存在：
- Windows: `%USERPROFILE%\.baidupan-cli\config.json`
- macOS/Linux: `~/.baidupan-cli/config.json`

## 故障排除

### 授权问题

如果遇到授权问题，请检查：
1. App Key 和 Secret Key 是否正确
2. 重定向 URL 是否与百度开放平台设置一致
3. 本地端口 9876 是否被占用

### 网络问题

如果遇到网络连接问题，请确认：
1. 能够正常访问百度网盘 API
2. 没有网络代理阻止请求

### 文件操作问题

- 确保远程路径格式正确（以 `/` 开头）
- 检查是否有足够的权限访问指定路径
- 大文件上传可能需要较长时间，请耐心等待

## 示例用法

在 `example` 目录中提供了使用此工具的示例脚本，包括：

- 自动备份 MongoDB 数据库到百度网盘
- 定时执行备份任务
- 配置文件示例

更多信息请参见 `example/README.md`。

## 技术细节

该工具采用百度网盘开放平台 API，支持断点续传和秒传功能。大文件会被分割成多个块进行上传，确保上传过程的稳定性。
