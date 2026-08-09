import type { AxiosInstance } from 'axios'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BaiduPanApi } from '../src/api/file'
import { ApiError } from '../src/errors'

function createClient(): AxiosInstance {
  return {
    defaults: { params: { access_token: 'test-token' } },
    get: vi.fn(),
    post: vi.fn(),
  } as unknown as AxiosInstance
}

describe('baiduPanApi upload routing', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('selects an HTTPS server returned by locateupload', async () => {
    const client = createClient()
    vi.mocked(client.get).mockResolvedValue({
      data: {
        servers: [
          { server: 'http://c1.pcs.baidu.com' },
          { server: 'https://c9.pcs.baidu.com/' },
        ],
      },
    })
    const api = new BaiduPanApi(client)

    await expect(api.locateUpload('/backup.tar', 'upload-id'))
      .resolves
      .toBe('https://c9.pcs.baidu.com')
    expect(client.get).toHaveBeenCalledWith(
      'https://d.pcs.baidu.com/rest/2.0/pcs/file',
      {
        params: {
          method: 'locateupload',
          appid: '250528',
          path: '/backup.tar',
          uploadid: 'upload-id',
          upload_version: '2.0',
        },
      },
    )
  })

  it('falls back to the default server when locateupload has no HTTPS server', async () => {
    const client = createClient()
    vi.mocked(client.get).mockResolvedValue({ data: { servers: [] } })
    const api = new BaiduPanApi(client)

    await expect(api.locateUpload('/backup.tar', 'upload-id'))
      .resolves
      .toBe('https://d.pcs.baidu.com')
  })

  it('falls back to the default server when discovery fails', async () => {
    const client = createClient()
    vi.mocked(client.get).mockRejectedValue(new Error('network unavailable'))
    const api = new BaiduPanApi(client)

    await expect(api.locateUpload('/backup.tar', 'upload-id'))
      .resolves
      .toBe('https://d.pcs.baidu.com')
  })

  it('rebuilds multipart data before retrying a transient chunk failure', async () => {
    vi.useFakeTimers()
    const client = createClient()
    vi.mocked(client.post)
      .mockRejectedValueOnce(new ApiError('HTTP Error: 500', undefined, 500))
      .mockResolvedValueOnce({ data: { md5: 'chunk-md5' } })
    const api = new BaiduPanApi(client)

    const upload = api.uploadChunk(
      'upload-id',
      '/backup.tar',
      0,
      Buffer.from('chunk'),
      'https://c9.pcs.baidu.com',
    )
    await vi.advanceTimersByTimeAsync(1_000)

    await expect(upload).resolves.toEqual({ md5: 'chunk-md5' })
    expect(client.post).toHaveBeenCalledTimes(2)
    expect(vi.mocked(client.post).mock.calls[0][0])
      .toBe('https://c9.pcs.baidu.com/rest/2.0/pcs/superfile2')
    expect(vi.mocked(client.post).mock.calls[0][1])
      .not
      .toBe(vi.mocked(client.post).mock.calls[1][1])
  })

  it('does not retry a non-retryable client error', async () => {
    const client = createClient()
    vi.mocked(client.post)
      .mockRejectedValue(new ApiError('HTTP Error: 400', undefined, 400))
    const api = new BaiduPanApi(client)

    await expect(api.uploadChunk(
      'upload-id',
      '/backup.tar',
      0,
      Buffer.from('chunk'),
      'https://c9.pcs.baidu.com',
    )).rejects.toThrow('HTTP Error: 400')
    expect(client.post).toHaveBeenCalledTimes(1)
  })
})
