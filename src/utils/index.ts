import fs from 'node:fs'
import path from 'node:path'

/**
 * Format file size to human readable string
 */
export function formatSize(bytes: number): string {
  if (bytes === 0)
    return '0 B'

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  const size = bytes / 1024 ** i

  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

/**
 * Format timestamp to readable date string
 */
export function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString()
}

/**
 * Normalize remote path (ensure starts with /)
 */
export function normalizePath(remotePath: string): string {
  if (!remotePath.startsWith('/')) {
    return `/${remotePath}`
  }
  return remotePath
}

/**
 * Get all files in directory recursively
 */
export function getAllFiles(dirPath: string, basePath: string = ''): { localPath: string, relativePath: string }[] {
  const files: { localPath: string, relativePath: string }[] = []
  const entries = fs.readdirSync(dirPath, { withFileTypes: true })

  for (const entry of entries) {
    const localPath = path.join(dirPath, entry.name)
    const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name

    if (entry.isDirectory()) {
      files.push(...getAllFiles(localPath, relativePath))
    }
    else if (entry.isFile()) {
      files.push({ localPath, relativePath })
    }
  }

  return files
}

/**
 * Check if path is a directory
 */
export function isDirectory(filePath: string): boolean {
  try {
    return fs.statSync(filePath).isDirectory()
  }
  catch {
    return false
  }
}

/**
 * Read file as buffer
 */
export function readFileAsBuffer(filePath: string): Buffer {
  return fs.readFileSync(filePath)
}

/**
 * Read stdin as buffer
 */
export async function readStdin(): Promise<Buffer> {
  const chunks: Buffer[] = []

  return new Promise((resolve, reject) => {
    process.stdin.on('data', (chunk: Buffer) => {
      chunks.push(chunk)
    })

    process.stdin.on('end', () => {
      resolve(Buffer.concat(chunks))
    })

    process.stdin.on('error', reject)
  })
}

/**
 * Print progress bar
 */
export function printProgress(current: number, total: number, prefix: string = ''): void {
  const percent = Math.round((current / total) * 100)
  const barLength = 30
  const filled = Math.round(barLength * (current / total))
  const bar = '█'.repeat(filled) + '░'.repeat(barLength - filled)

  process.stderr.write(`\r${prefix}[${bar}] ${percent}% (${current}/${total})`)

  if (current === total) {
    process.stderr.write('\n')
  }
}
