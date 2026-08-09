import type { AxiosInstance } from 'axios'
import type {
  CreateFileResponse,
  FileManagerOperationType,
  FileManagerResponse,
  FileMetasResponse,
  ListFilesResponse,
  LocateUploadResponse,
  OndupType,
  PrecreateResponse,
  QuotaResponse,
  UserInfoResponse,
} from './types'
import crypto from 'node:crypto'
import axios from 'axios'
import FormData from 'form-data'
import { ApiError } from '../errors'
import { logger } from '../logger'

// 4MB chunk size for upload
const CHUNK_SIZE = 4 * 1024 * 1024
const DEFAULT_UPLOAD_SERVER = 'https://d.pcs.baidu.com'
const MAX_CHUNK_UPLOAD_ATTEMPTS = 3
const CHUNK_RETRY_BASE_DELAY = 1_000

function isRetryableChunkError(error: unknown): boolean {
  if (error instanceof ApiError) {
    return error.errno === 31034
      || error.httpStatus === 429
      || (error.httpStatus ?? 0) >= 500
  }

  if (axios.isAxiosError(error)) {
    const status = error.response?.status
    return status === undefined || status === 429 || status >= 500
  }

  return false
}

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export class BaiduPanApi {
  constructor(private client: AxiosInstance) {}

  /**
   * Get user info
   */
  async getUserInfo(): Promise<UserInfoResponse> {
    const response = await this.client.get<UserInfoResponse>('/rest/2.0/xpan/nas', {
      params: { method: 'uinfo' },
    })
    return response.data
  }

  /**
   * Get quota info
   */
  async getQuota(): Promise<QuotaResponse> {
    const response = await this.client.get<QuotaResponse>('/api/quota', {
      params: { checkfree: 1, checkexpire: 1 },
    })
    return response.data
  }

  /**
   * List files in directory
   */
  async listFiles(dir: string = '/', options: {
    order?: 'name' | 'time' | 'size'
    desc?: boolean
    start?: number
    limit?: number
  } = {}): Promise<ListFilesResponse> {
    const response = await this.client.get<ListFilesResponse>('/rest/2.0/xpan/file', {
      params: {
        method: 'list',
        dir,
        order: options.order || 'name',
        desc: options.desc ? 1 : 0,
        start: options.start || 0,
        limit: options.limit || 1000,
        web: 1,
      },
    })
    return response.data
  }

  /**
   * Get file metadata with download link
   */
  async getFileMetas(fsids: number[], dlink: boolean = true): Promise<FileMetasResponse> {
    const response = await this.client.get<FileMetasResponse>('/rest/2.0/xpan/multimedia', {
      params: {
        method: 'filemetas',
        fsids: JSON.stringify(fsids),
        dlink: dlink ? 1 : 0,
      },
    })
    return response.data
  }

  /**
   * Precreate file for upload
   */
  async precreate(
    path: string,
    size: number,
    blockList: string[],
    isdir: boolean = false,
  ): Promise<PrecreateResponse> {
    const params = new URLSearchParams()
    params.append('path', path)
    params.append('size', size.toString())
    params.append('isdir', isdir ? '1' : '0')
    params.append('autoinit', '1')
    params.append('block_list', JSON.stringify(blockList))
    params.append('rtype', '3') // 3 = overwrite if exists

    const response = await this.client.post<PrecreateResponse>(
      '/rest/2.0/xpan/file',
      params.toString(),
      {
        params: { method: 'precreate' },
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      },
    )
    return response.data
  }

  /**
   * Get the currently recommended upload server.
   * Falls back to the legacy endpoint when discovery is unavailable.
   */
  async locateUpload(path: string, uploadId: string): Promise<string> {
    try {
      const response = await this.client.get<LocateUploadResponse>(
        `${DEFAULT_UPLOAD_SERVER}/rest/2.0/pcs/file`,
        {
          params: {
            method: 'locateupload',
            appid: '250528',
            path,
            uploadid: uploadId,
            upload_version: '2.0',
          },
        },
      )
      const server = response.data.servers?.find(item => item.server.startsWith('https://'))
        ?.server
      return (server || DEFAULT_UPLOAD_SERVER).replace(/\/$/, '')
    }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logger.warn(`获取动态上传节点失败，回退到默认节点: ${message}`)
      return DEFAULT_UPLOAD_SERVER
    }
  }

  /**
   * Upload a chunk
   */
  async uploadChunk(
    uploadId: string,
    path: string,
    partseq: number,
    data: Buffer,
    uploadServer: string = DEFAULT_UPLOAD_SERVER,
  ): Promise<{ md5: string }> {
    const token = this.client.defaults.params?.access_token
    const normalizedServer = uploadServer.replace(/\/$/, '')

    for (let attempt = 1; attempt <= MAX_CHUNK_UPLOAD_ATTEMPTS; attempt++) {
      const form = new FormData()
      form.append('file', data, {
        filename: 'chunk',
        contentType: 'application/octet-stream',
      })

      try {
        const response = await this.client.post(
          `${normalizedServer}/rest/2.0/pcs/superfile2`,
          form,
          {
            'axios-retry': { retries: 0 },
            'params': {
              method: 'upload',
              access_token: token,
              type: 'tmpfile',
              path,
              uploadid: uploadId,
              partseq,
            },
            'headers': form.getHeaders(),
            'maxBodyLength': Number.POSITIVE_INFINITY,
            'maxContentLength': Number.POSITIVE_INFINITY,
          },
        )
        return response.data
      }
      catch (error) {
        if (!isRetryableChunkError(error) || attempt === MAX_CHUNK_UPLOAD_ATTEMPTS) {
          throw error
        }

        const delay = CHUNK_RETRY_BASE_DELAY * 2 ** (attempt - 1)
        const message = error instanceof Error ? error.message : String(error)
        logger.warn(
          `分块 ${partseq} 上传失败，第 ${attempt}/${MAX_CHUNK_UPLOAD_ATTEMPTS} 次尝试: ${message}；${delay / 1_000} 秒后重试`,
        )
        await wait(delay)
      }
    }

    throw new Error(`分块 ${partseq} 上传失败`)
  }

  /**
   * Create file after upload
   */
  async createFile(
    path: string,
    size: number,
    uploadId: string,
    blockList: string[],
    isdir: boolean = false,
  ): Promise<CreateFileResponse> {
    const params = new URLSearchParams()
    params.append('path', path)
    params.append('size', size.toString())
    params.append('isdir', isdir ? '1' : '0')
    params.append('uploadid', uploadId)
    params.append('block_list', JSON.stringify(blockList))
    params.append('rtype', '3')

    const response = await this.client.post<CreateFileResponse>(
      '/rest/2.0/xpan/file',
      params.toString(),
      {
        params: { method: 'create' },
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      },
    )
    return response.data
  }

  /**
   * Create directory
   */
  async createDir(path: string): Promise<CreateFileResponse> {
    return this.createFile(path, 0, '', [], true)
  }

  /**
   * File manager operations: copy, move, rename, delete
   */
  async fileManager(
    opera: FileManagerOperationType,
    fileList: Array<{
      path: string
      dest?: string
      newname?: string
    }>,
    options?: {
      async?: 0 | 1 | 2
      ondup?: OndupType
    },
  ): Promise<FileManagerResponse> {
    const params = new URLSearchParams()
    params.append('async', (options?.async ?? 0).toString())
    params.append('filelist', JSON.stringify(fileList))
    if (options?.ondup) {
      params.append('ondup', options.ondup)
    }

    const response = await this.client.post<FileManagerResponse>(
      '/rest/2.0/xpan/file',
      params.toString(),
      {
        params: { method: 'filemanager', opera },
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      },
    )
    return response.data
  }
}

/**
 * Calculate MD5 hash of a buffer
 */
export function md5(data: Buffer): string {
  return crypto.createHash('md5').update(data).digest('hex')
}

/**
 * Split buffer into chunks and return MD5 list
 */
export function splitIntoChunks(data: Buffer): { chunks: Buffer[], md5List: string[] } {
  const chunks: Buffer[] = []
  const md5List: string[] = []

  for (let i = 0; i < data.length; i += CHUNK_SIZE) {
    const chunk = data.subarray(i, Math.min(i + CHUNK_SIZE, data.length))
    chunks.push(chunk)
    md5List.push(md5(chunk))
  }

  return { chunks, md5List }
}

export { CHUNK_SIZE }
