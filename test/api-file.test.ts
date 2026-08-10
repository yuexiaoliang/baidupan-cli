import type { AxiosInstance } from 'axios'
import { AxiosError } from 'axios'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BaiduPanApi } from '../src/api/file'
import { ApiError } from '../src/errors'

function createClient(): AxiosInstance {
  return {
    defaults: { params: { access_token: 'test-token' } },
    get: vi.fn(),
    head: vi.fn(),
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
          { server: 'https://c8.pcs.baidu.com' },
          { server: 'https://c9.pcs.baidu.com/' },
        ],
      },
    })
    const api = new BaiduPanApi(client)

    await expect(api.locateUpload('/backup.tar', 'upload-id'))
      .resolves
      .toEqual([
        'https://c9.pcs.baidu.com',
        'https://c8.pcs.baidu.com',
        'https://d.pcs.baidu.com',
      ])
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
      .toEqual(['https://d.pcs.baidu.com'])
  })

  it('falls back to the default server when discovery fails', async () => {
    const client = createClient()
    vi.mocked(client.get).mockRejectedValue(new Error('network unavailable'))
    const api = new BaiduPanApi(client)

    await expect(api.locateUpload('/backup.tar', 'upload-id'))
      .resolves
      .toEqual(['https://d.pcs.baidu.com'])
  })

  it('ranks reachable upload servers by probe latency and leaves unreachable servers last', async () => {
    vi.useFakeTimers()
    const client = createClient()
    vi.mocked(client.head).mockImplementation((url) => {
      const delay = String(url).includes('c9.') ? 30 : 5
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          if (String(url).includes('d.pcs')) {
            reject(new AxiosError('connect ETIMEDOUT', 'ETIMEDOUT'))
          }
          else {
            resolve({ data: {}, status: 400 })
          }
        }, delay)
      })
    })
    const api = new BaiduPanApi(client)

    const ranking = api.rankUploadServers([
      'https://c9.pcs.baidu.com',
      'https://c2.pcs.baidu.com',
      'https://d.pcs.baidu.com',
    ])
    await vi.advanceTimersByTimeAsync(30)

    await expect(ranking).resolves.toEqual([
      'https://c2.pcs.baidu.com',
      'https://c9.pcs.baidu.com',
      'https://d.pcs.baidu.com',
    ])
    expect(client.head).toHaveBeenCalledTimes(3)
    expect(client.head).toHaveBeenCalledWith(
      'https://c2.pcs.baidu.com/rest/2.0/pcs/superfile2',
      expect.objectContaining({
        'timeout': 5_000,
        'validateStatus': expect.any(Function),
        'axios-retry': { retries: 0 },
      }),
    )
  })

  it('refreshes the server pool and rebuilds multipart data before retrying', async () => {
    vi.useFakeTimers()
    const client = createClient()
    vi.mocked(client.get).mockResolvedValue({
      data: { servers: [{ server: 'https://c8.pcs.baidu.com' }] },
    })
    vi.mocked(client.post)
      .mockRejectedValueOnce(new ApiError('HTTP Error: 500', undefined, 500))
      .mockResolvedValueOnce({ data: { md5: 'chunk-md5' } })
    const api = new BaiduPanApi(client)

    const upload = api.uploadChunk(
      'upload-id',
      '/backup.tar',
      0,
      Buffer.from('chunk'),
      ['https://c9.pcs.baidu.com', 'https://d.pcs.baidu.com'],
    )
    await vi.advanceTimersByTimeAsync(1_000)

    await expect(upload).resolves.toEqual({ md5: 'chunk-md5' })
    expect(client.post).toHaveBeenCalledTimes(2)
    expect(vi.mocked(client.post).mock.calls[0][0])
      .toBe('https://c9.pcs.baidu.com/rest/2.0/pcs/superfile2')
    expect(vi.mocked(client.post).mock.calls[1][0])
      .toBe('https://c8.pcs.baidu.com/rest/2.0/pcs/superfile2')
    expect(vi.mocked(client.post).mock.calls[0][1])
      .not
      .toBe(vi.mocked(client.post).mock.calls[1][1])
  })

  it('switches servers after a connection timeout', async () => {
    vi.useFakeTimers()
    const client = createClient()
    vi.mocked(client.get).mockResolvedValue({
      data: { servers: [{ server: 'https://c8.pcs.baidu.com' }] },
    })
    vi.mocked(client.post)
      .mockRejectedValueOnce(new AxiosError('connect ETIMEDOUT', 'ETIMEDOUT'))
      .mockResolvedValueOnce({ data: { md5: 'chunk-md5' } })
    const api = new BaiduPanApi(client)

    const upload = api.uploadChunk(
      'upload-id',
      '/backup.tar',
      49,
      Buffer.from('chunk'),
      ['https://c9.pcs.baidu.com', 'https://d.pcs.baidu.com'],
    )
    await vi.advanceTimersByTimeAsync(1_000)

    await expect(upload).resolves.toEqual({ md5: 'chunk-md5' })
    expect(vi.mocked(client.post).mock.calls.map(call => call[0]))
      .toEqual([
        'https://c9.pcs.baidu.com/rest/2.0/pcs/superfile2',
        'https://c8.pcs.baidu.com/rest/2.0/pcs/superfile2',
      ])
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
      ['https://c9.pcs.baidu.com'],
    )).rejects.toThrow('HTTP Error: 400')
    expect(client.post).toHaveBeenCalledTimes(1)
  })
})
