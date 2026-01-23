// Baidu Pan API Response Types

export interface BaiduApiResponse<T = unknown> {
  errno: number
  request_id?: number
  errmsg?: string
  data?: T
}

// File list types
export interface FileItem {
  fs_id: number
  path: string
  server_filename: string
  size: number
  isdir: number
  category: number
  server_mtime: number
  server_ctime: number
  local_mtime: number
  local_ctime: number
  dir_empty?: number
  thumbs?: {
    url1?: string
    url2?: string
    url3?: string
  }
}

export interface ListFilesResponse extends BaiduApiResponse {
  list: FileItem[]
}

// File meta types
export interface FileMeta {
  fs_id: number
  path: string
  filename: string
  size: number
  isdir: number
  dlink?: string
  md5?: string
  category: number
  server_ctime: number
  server_mtime: number
}

export interface FileMetasResponse extends BaiduApiResponse {
  list: FileMeta[]
}

// Upload types
export interface PrecreateResponse extends BaiduApiResponse {
  uploadid: string
  return_type: number
  block_list: number[]
}

export interface UploadChunkResponse extends BaiduApiResponse {
  md5: string
}

export interface CreateFileResponse extends BaiduApiResponse {
  fs_id: number
  path: string
  size: number
  ctime: number
  mtime: number
  md5: string
  isdir: number
}

// User info types
export interface UserInfo {
  baidu_name: string
  netdisk_name: string
  avatar_url: string
  vip_type: number
  uk: number
}

export interface UserInfoResponse extends BaiduApiResponse, UserInfo {}

// Quota types
export interface QuotaResponse extends BaiduApiResponse {
  total: number
  free: number
  used: number
  expire: boolean
}

// Error codes
export const BaiduErrorCodes: Record<number, string> = {
  '0': 'Success',
  '-6': 'Invalid access token',
  '-7': 'Access denied',
  '-9': 'File not found',
  '2': 'Parameter error',
  '111': 'Access token expired',
  '31034': 'Request too frequent',
}
