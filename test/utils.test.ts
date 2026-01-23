import { describe, expect, it } from 'vitest'
import { formatDate, formatSize, normalizePath } from '../src/utils'

describe('formatSize', () => {
  it('should return "0 B" for 0 bytes', () => {
    expect(formatSize(0)).toBe('0 B')
  })

  it('should format bytes correctly', () => {
    expect(formatSize(500)).toBe('500 B')
  })

  it('should format kilobytes correctly', () => {
    expect(formatSize(1024)).toBe('1.0 KB')
    expect(formatSize(1536)).toBe('1.5 KB')
  })

  it('should format megabytes correctly', () => {
    expect(formatSize(1024 * 1024)).toBe('1.0 MB')
    expect(formatSize(1.5 * 1024 * 1024)).toBe('1.5 MB')
  })

  it('should format gigabytes correctly', () => {
    expect(formatSize(1024 * 1024 * 1024)).toBe('1.0 GB')
  })

  it('should format terabytes correctly', () => {
    expect(formatSize(1024 * 1024 * 1024 * 1024)).toBe('1.0 TB')
  })
})

describe('formatDate', () => {
  it('should format unix timestamp to locale string', () => {
    // Use a fixed timestamp for consistent testing
    const timestamp = 1700000000 // 2023-11-14
    const result = formatDate(timestamp)
    // Just check it returns a non-empty string (locale varies by system)
    expect(result).toBeTruthy()
    expect(typeof result).toBe('string')
  })
})

describe('normalizePath', () => {
  it('should add leading slash if missing', () => {
    expect(normalizePath('foo/bar')).toBe('/foo/bar')
  })

  it('should keep leading slash if present', () => {
    expect(normalizePath('/foo/bar')).toBe('/foo/bar')
  })

  it('should handle root path', () => {
    expect(normalizePath('/')).toBe('/')
  })

  it('should handle single filename', () => {
    expect(normalizePath('file.txt')).toBe('/file.txt')
  })
})
