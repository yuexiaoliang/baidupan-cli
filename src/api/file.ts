import type { AxiosInstance } from 'axios'
import type {
  CreateFileResponse,
  FileMetasResponse,
  ListFilesResponse,
  PrecreateResponse,
  QuotaResponse,
  UserInfoResponse,
} from './types'
import crypto from 'node:crypto'
import FormData from 'form-data'

// 4MB chunk size for upload
const CHUNK_SIZE = 4 * 1024 * 1024

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
   * Upload a chunk
   */
  async uploadChunk(
    uploadId: string,
    path: string,
    partseq: number,
    data: Buffer,
  ): Promise<{ md5: string }> {
    const form = new FormData()
    form.append('file', data, {
      filename: 'chunk',
      contentType: 'application/octet-stream',
    })

    const token = this.client.defaults.params?.access_token
    const response = await this.client.post(
      'https://d.pcs.baidu.com/rest/2.0/pcs/superfile2',
      form,
      {
        params: {
          method: 'upload',
          access_token: token,
          type: 'tmpfile',
          path,
          uploadid: uploadId,
          partseq,
        },
        headers: form.getHeaders(),
        maxBodyLength: Number.POSITIVE_INFINITY,
        maxContentLength: Number.POSITIVE_INFINITY,
      },
    )
    return response.data
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
